---
name: make-social-preview
description: Create or update the repository's social preview image (docs/social-preview.svg and the docs/social-preview.png used as the OGP/X card image). Use when the landing page or GitHub social preview needs an image.
---

# Commands
Create `docs/social-preview.svg` at 1280×640 (GitHub's social preview size, matching the existing `docs/social-preview.png`), with the project name and a one-line description taken from README/package.json.

- Draw emoji as Twemoji vector paths embedded in the SVG, not as emoji text.
- Also export `docs/social-preview.png` at the same size: OGP and X cards do not accept SVG, and `docs/index.html` points `og:image` / `twitter:image` at the PNG.
