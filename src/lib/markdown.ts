import DOMPurify from "dompurify";
import { marked } from "marked";

/**
 * Elements and attributes that make the browser fetch a URL (or restyle the page)
 * just by being rendered. Model output could otherwise put conversation data in
 * such a URL and send it to a third party without any user action.
 */
const FORBID_TAGS = [
  "style",
  "video",
  "audio",
  "source",
  "track",
  "picture",
  "image",
  "feimage",
  "feImage",
  "use",
  "object",
  "embed",
  "iframe",
  "form",
  "input",
  "button",
  "textarea",
  "select",
];
const FORBID_ATTR = [
  "style",
  "srcset",
  "poster",
  "background",
  "ping",
  "action",
  "formaction",
];

/** Inline images carry their own bytes, so rendering them makes no request. */
const INLINE_IMAGE = /^data:image\//i;
const HTTP_URL = /^https?:\/\//i;

/**
 * Replace every non-inline <img> with a text link, so the image is only fetched
 * if the user explicitly opens it. Runs on an inert DOMParser document, where
 * images are never loaded.
 */
function replaceExternalImages(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const images = [...doc.body.querySelectorAll("img")].filter(
    (img) => !INLINE_IMAGE.test(img.getAttribute("src") ?? ""),
  );
  if (images.length === 0) return html;
  for (const img of images) {
    const src = img.getAttribute("src") ?? "";
    const label = `🖼 ${img.getAttribute("alt") || src}`;
    if (HTTP_URL.test(src)) {
      const link = doc.createElement("a");
      link.href = src;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = label;
      img.replaceWith(link);
    } else {
      img.replaceWith(doc.createTextNode(label));
    }
  }
  return doc.body.innerHTML;
}

/** Render LLM output (Markdown) to sanitized HTML, safe for dangerouslySetInnerHTML. */
export function renderMarkdown(content: string): string {
  const sanitized = DOMPurify.sanitize(marked.parse(content) as string, {
    FORBID_TAGS,
    FORBID_ATTR,
  });
  return replaceExternalImages(sanitized);
}
