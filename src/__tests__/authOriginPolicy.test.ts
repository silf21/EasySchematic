import { expect, it } from "vitest";
import { corsOrigin, isAllowedOrigin } from "../../api/src/originPolicy";

it("allows the exact Synology frontend origin for credentialed requests and OAuth return URLs", () => {
  const origin = "https://easyschematic.silvanfrei.synology.me";
  expect(corsOrigin(origin)).toBe(origin);
  expect(isAllowedOrigin(`${origin}/?project=123#schematic`)).toBe(true);
});

it.each([
  "https://easyschematic.silvanfrei.synology.me.attacker.example",
  "https://attacker.example/easyschematic.silvanfrei.synology.me",
  "https://easyschematic.silvanfrei.synology.me@attacker.example",
  "http://easyschematic.silvanfrei.synology.me",
  "https://easyschematic.silvanfrei.synology.me:8443",
  "https://another.synology.me",
  "javascript:alert(1)",
  "//easyschematic.silvanfrei.synology.me/",
  "not a URL",
])("rejects untrusted return destinations: %s", destination => {
  expect(isAllowedOrigin(destination)).toBe(false);
});

it.each(["https://easyschematic.live", "https://devices.easyschematic.live", "http://localhost:5173", "http://127.0.0.1:8080", "http://[::1]:5173"])("retains existing trusted origins: %s", origin => {
  expect(corsOrigin(origin)).toBe(origin);
  expect(isAllowedOrigin(`${origin}/`)).toBe(true);
});
