import DOMPurify from "dompurify";
import { marked } from "marked";

/** Render LLM output (Markdown) to sanitized HTML, safe for dangerouslySetInnerHTML. */
export function renderMarkdown(content: string): string {
  return DOMPurify.sanitize(marked.parse(content) as string);
}
