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
    const html = renderMarkdown('<img src="x" onerror="alert(1)">');
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
