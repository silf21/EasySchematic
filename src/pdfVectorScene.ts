import type { PdfStubReference } from "./pdfStubReferences";
import { scrubXmlIllegalChars } from "./exportCapturePrep";

const NS = "http://www.w3.org/2000/svg";
export interface VectorLink { x: number; y: number; width: number; height: number; targetPage: number }

/** Project rendered DOM geometry to SVG primitives. HTML never goes into a
 * foreignObject (which would rasterize); text remains selectable PDF text.
 * Positions come from browser layout, including nested rooms and routed paths. */
export function buildPdfVectorScene(viewport: HTMLElement, container: HTMLElement, width: number, height: number, references: Map<Element, PdfStubReference>) {
  const origin = container.getBoundingClientRect();
  const zoom = Math.hypot(new DOMMatrix(getComputedStyle(viewport).transform).a, new DOMMatrix(getComputedStyle(viewport).transform).b);
  const scene = document.createElementNS(NS, "svg");
  scene.setAttribute("xmlns", NS);
  scene.setAttribute("width", String(width)); scene.setAttribute("height", String(height));
  scene.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const defs = document.createElementNS(NS, "defs"); scene.append(defs);
  const links: VectorLink[] = [];
  let counter = 0;
  const shape = (name: string, attrs: Record<string, string | number>, parent: Element = scene) => {
    const el = document.createElementNS(NS, name);
    for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
    parent.append(el); return el;
  };
  const visible = (el: Element) => {
    const style = getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0;
  };
  const colorVisible = (color: string) => color !== "transparent" && color !== "rgba(0, 0, 0, 0)";
  const box = (el: Element) => {
    const r = el.getBoundingClientRect();
    return { x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height };
  };
  const intersects = (b: { x: number; y: number; w: number; h: number }) => b.x + b.w > 0 && b.y + b.h > 0 && b.x < width && b.y < height;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d")!;

  function svgGeometry(svg: SVGSVGElement, parent: Element) {
    for (const def of svg.querySelectorAll("defs")) defs.append(...Array.from(def.children).map(n => n.cloneNode(true)));
    for (const el of svg.querySelectorAll<SVGGraphicsElement>("path,rect,circle,ellipse,line,polyline,polygon,text,image,use")) {
      if (el.closest("defs") || !visible(el) || el.classList.contains("react-flow__edge-interaction")) continue;
      const style = getComputedStyle(el);
      const matrix = el.getScreenCTM();
      if (!matrix) continue;
      const clone = el.cloneNode(true) as SVGElement;
      clone.removeAttribute("class"); clone.removeAttribute("style");
      clone.setAttribute("transform", `matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e - origin.left} ${matrix.f - origin.top})`);
      for (const key of ["fill", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "stroke-linejoin", "fill-opacity", "stroke-opacity", "opacity", "fill-rule"]) clone.setAttribute(key, style.getPropertyValue(key));
      if (el.tagName.toLowerCase() === "text") {
        clone.setAttribute("font-family", "Inter"); clone.setAttribute("font-size", style.fontSize); clone.setAttribute("font-weight", style.fontWeight);
      }
      parent.append(clone);
    }
  }

  function reference(el: Element, ref: PdfStubReference, parent: Element) {
    const b = box(el); if (!intersects(b)) return;
    const css = getComputedStyle(el);
    const size = parseFloat(css.fontSize) * zoom;
    context.font = `${css.fontWeight} ${size}px Inter`;
    const pad = 4 * zoom;
    const desired = context.measureText(ref.text).width + 2 * pad;
    // Keep the end facing the port anchored. Long references wrap at the sheet
    // edge rather than moving any device, wire, or saved stub node.
    const anchor = Math.max(0, Math.min(width, ref.align === "right" ? b.x + b.w : b.x));
    const available = Math.max(8, ref.align === "right" ? anchor : width - anchor);
    const w = Math.min(desired, available);
    const words = ref.text.split(" "); const lines: string[] = []; let line = "";
    for (const word of words) {
      if (context.measureText(word).width > w - 2 * pad) {
        if (line) { lines.push(line); line = ""; }
        for (const char of word) {
          if (line && context.measureText(line + char).width > w - 2 * pad) { lines.push(line); line = char; }
          else line += char;
        }
        continue;
      }
      const candidate = line ? `${line} ${word}` : word;
      if (line && context.measureText(candidate).width > w - 2 * pad) { lines.push(line); line = word; } else line = candidate;
    }
    if (line) lines.push(line);
    const h = Math.max(b.h, lines.length * size * 1.25 + 4 * zoom);
    const x = ref.align === "right" ? anchor - w : anchor;
    const y = Math.max(0, Math.min(height - h, b.y + (b.h - h) / 2));
    shape("rect", { x, y, width: w, height: h, rx: 2 * zoom, fill: css.backgroundColor, stroke: css.borderTopColor, "stroke-width": Math.max(0.5, parseFloat(css.borderTopWidth) * zoom) }, parent);
    lines.forEach((text, i) => { const t = shape("text", { x: x + pad, y: y + 2 * zoom + size + i * size * 1.25, "font-family": "Inter", "font-size": size, fill: css.color }, parent); t.textContent = scrubXmlIllegalChars(text); });
    if (ref.targetPage > 0) links.push({ x, y, width: w, height: h, targetPage: ref.targetPage });
  }

  function text(node: Text, parent: Element) {
    if (!node.textContent?.trim()) return;
    const host = node.parentElement!;
    const css = getComputedStyle(host);
    const size = parseFloat(css.fontSize) * zoom;
    // Browser ranges provide line wrapping and clipping without a second layout.
    const lines: { text: string; x: number; y: number; h: number }[] = [];
    const range = document.createRange();
    const content = node.textContent;
    for (let i = 0; i < content.length; i++) {
      range.setStart(node, i); range.setEnd(node, i + 1);
      const r = range.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const x = r.left - origin.left; const y = r.top - origin.top;
      const last = lines.at(-1);
      if (last && Math.abs(last.y - y) < 1 && x >= last.x) last.text += content[i];
      else lines.push({ text: content[i], x, y, h: r.height });
    }
    const hostBox = box(host);
    const clamp = Number(css.webkitLineClamp);
    const visibleLines = clamp > 0 ? lines.filter(line => line.y < hostBox.y + hostBox.h) : lines;
    for (const [index, line] of visibleLines.entries()) {
      if (css.textTransform === "uppercase") line.text = line.text.toUpperCase();
      if (css.textTransform === "lowercase") line.text = line.text.toLowerCase();
      if (css.textTransform === "capitalize") line.text = line.text.replace(/(^|[\s-])(\p{L})/gu, (_match, space: string, letter: string) => space + letter.toUpperCase());
      if (css.textOverflow === "ellipsis" || (clamp > 0 && index === visibleLines.length - 1)) {
        context.font = `${Number(css.fontWeight) >= 600 ? "bold" : "normal"} ${size}px Inter`;
        const available = hostBox.x + hostBox.w - line.x - parseFloat(css.paddingRight) * zoom;
        if (context.measureText(line.text).width > available || (clamp > 0 && lines.length > visibleLines.length)) {
          while (line.text && context.measureText(line.text + "…").width > available) line.text = line.text.slice(0, -1);
          line.text += "…";
        }
      }
      context.font = `${Number(css.fontWeight) >= 600 ? "bold" : "normal"} ${size}px Inter`;
      const metrics = context.measureText(line.text);
      const ascent = metrics.fontBoundingBoxAscent ?? size * 0.83;
      const descent = metrics.fontBoundingBoxDescent ?? size * 0.2;
      const baseline = line.y + (line.h - ascent - descent) / 2 + ascent;
      const t = shape("text", { x: line.x, y: baseline, "font-family": "Inter", "font-size": size, "font-weight": Number(css.fontWeight) >= 600 ? "bold" : "normal", fill: css.color, "xml:space": "preserve" }, parent);
      t.textContent = scrubXmlIllegalChars(line.text);
    }
  }

  function html(el: Element, parent: Element) {
    if (!visible(el) || el.hasAttribute("data-print-hide")) return;
    if (el instanceof SVGSVGElement) { svgGeometry(el, parent); return; }
    const ref = references.get(el);
    if (ref) { reference(el, ref, parent); return; }
    const css = getComputedStyle(el); const b = box(el);
    if (!intersects(b)) return;
    let group = parent;
    if (Number(css.opacity) < 1) group = shape("g", { opacity: css.opacity }, parent);
    const radius = parseFloat(css.borderTopLeftRadius) * zoom || 0;
    if (colorVisible(css.backgroundColor)) shape("rect", { x: b.x, y: b.y, width: b.w, height: b.h, rx: radius, fill: css.backgroundColor }, group);
    const sides = ["Top", "Right", "Bottom", "Left"] as const;
    const widths = sides.map(side => parseFloat(css[`border${side}Width`]) * zoom);
    if (widths.every(w => w === widths[0]) && widths[0] > 0) {
      shape("rect", { x: b.x + widths[0] / 2, y: b.y + widths[0] / 2, width: Math.max(0, b.w - widths[0]), height: Math.max(0, b.h - widths[0]), rx: radius, fill: "none", stroke: css.borderTopColor, "stroke-width": widths[0], ...(css.borderTopStyle === "dashed" ? { "stroke-dasharray": `${4 * zoom} ${3 * zoom}` } : {}) }, group);
    } else sides.forEach((side, i) => {
      if (!widths[i]) return;
      const coords = [[b.x, b.y, b.x + b.w, b.y], [b.x + b.w, b.y, b.x + b.w, b.y + b.h], [b.x, b.y + b.h, b.x + b.w, b.y + b.h], [b.x, b.y, b.x, b.y + b.h]][i];
      shape("line", { x1: coords[0], y1: coords[1], x2: coords[2], y2: coords[3], stroke: css[`border${side}Color`], "stroke-width": widths[i] }, group);
    });
    if (el instanceof HTMLImageElement) { shape("image", { x: b.x, y: b.y, width: b.w, height: b.h, href: el.currentSrc || el.src }, group); return; }
    if ([css.overflow, css.overflowX, css.overflowY].some(value => value === "hidden" || value === "clip")) {
      const id = `pdf-clip-${counter++}`; const clip = shape("clipPath", { id }, defs);
      shape("rect", { x: b.x, y: b.y, width: b.w, height: b.h, rx: radius }, clip);
      group = shape("g", { "clip-path": `url(#${id})` }, group);
    }
    for (const child of el.childNodes) {
      if (child instanceof Text) text(child, group);
      else if (child instanceof Element) html(child, group);
    }
  }
  // React Flow uses stacking contexts: rooms behind wires; device boxes above
  // wires; labels above both. Preserve those layers rather than DOM sibling order.
  for (const node of viewport.querySelectorAll(".react-flow__node-room")) html(node, scene);
  for (const svg of viewport.querySelectorAll<SVGSVGElement>(".react-flow__edges svg, svg.react-flow__edges")) if (visible(svg)) svgGeometry(svg, scene);
  for (const node of viewport.querySelectorAll(".react-flow__node:not(.react-flow__node-room)")) html(node, scene);
  const labels = viewport.querySelector(".react-flow__edgelabel-renderer");
  if (labels) for (const label of labels.children) html(label, scene);
  return { scene, links };
}
