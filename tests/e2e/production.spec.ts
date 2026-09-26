import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import {
  mockLmStudio,
  openLmStudioSettings,
  openWithUnreadableDatabase,
  sendChatMessage,
} from "./support/app";

const securityHeaders: Record<string, string> = JSON.parse(
  readFileSync("bin/security-headers.json", "utf8"),
);

test.describe("Production server (bin/start.js)", () => {
  test("sends the security headers on every response", async ({ request }) => {
    for (const path of ["/", "/some/spa/route", "/favicon.png"]) {
      const response = await request.get(path);
      expect(response.ok(), path).toBe(true);
      const headers = response.headers();
      for (const [name, value] of Object.entries(securityHeaders)) {
        expect(headers[name.toLowerCase()], `${path} ${name}`).toBe(value);
      }
    }
  });

  test("blocks framing and does not allow cross-origin reads", async ({
    request,
  }) => {
    const headers = (await request.get("/")).headers();
    expect(headers["content-security-policy"]).toContain(
      "frame-ancestors 'none'",
    );
    expect(headers["x-frame-options"]).toBe("DENY");
    // --cors was removed, so other origins cannot read the served files
    expect(headers["access-control-allow-origin"]).toBeUndefined();
  });

  test("serves index.html for unknown SPA paths", async ({ request }) => {
    const response = await request.get("/some/spa/route");
    expect(response.headers()["content-type"]).toContain("text/html");
    expect(await response.text()).toContain('<div id="root">');
  });

  test("the app works under the production CSP", async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (m) => {
      if (m.text().includes("Content Security Policy"))
        violations.push(m.text());
    });
    const mock = await mockLmStudio(page, {
      models: [{ key: "google/gemma-4-e4b", allowed_options: ["off", "on"] }],
      reply: "**hello** from the model",
    });

    await openLmStudioSettings(page);
    await sendChatMessage(page, "hi");

    await expect(page.locator("strong", { hasText: "hello" })).toBeVisible();
    expect(mock.chatBodies).toHaveLength(1);
    expect(violations).toEqual([]);
  });

  test("toasts render under the production CSP", async ({ page }) => {
    const toast = await openWithUnreadableDatabase(page, "ai-chat-config");
    await expect(toast).toContainText("Couldn't load settings");
    // sonner injects a <style>, so the toast is positioned only if style-src allows it
    expect(await toast.evaluate((el) => getComputedStyle(el).position)).toBe(
      "absolute",
    );
  });
});

test.describe("bin/start.js environment validation", () => {
  // No shell is involved, but invalid values are still rejected before starting
  const invalid = [
    ["PORT", "abc"],
    ["PORT", "0"],
    ["PORT", "70000"],
    ["PORT", "3000;whoami"],
    ["HOST", "a&b"],
    ["HOST", "$(id)"],
    ["HOST", "host name"],
  ];
  for (const [name, value] of invalid) {
    test(`rejects ${name}=${value}`, () => {
      const result = spawnSync(process.execPath, ["bin/start.js"], {
        env: { ...process.env, PORT: "4175", HOST: "localhost", [name]: value },
        encoding: "utf8",
        timeout: 10_000,
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(`Invalid ${name}`);
    });
  }
});

test("nginx.conf sends the same security headers", () => {
  const nginx = readFileSync("nginx.conf", "utf8");
  const nginxHeaders = Object.fromEntries(
    [...nginx.matchAll(/add_header\s+(\S+)\s+"([^"]*)"\s+always;/g)].map(
      (m) => [m[1], m[2]],
    ),
  );
  expect(nginxHeaders).toEqual(securityHeaders);
});
