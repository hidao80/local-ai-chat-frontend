# Chat-FE

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Lint](https://github.com/hidao80/chat-fe/actions/workflows/lint.yml/badge.svg)
![Audit](https://github.com/hidao80/chat-fe/actions/workflows/audit.yml/badge.svg)
![Build](https://github.com/hidao80/chat-fe/actions/workflows/build.yml/badge.svg)
[![Netlify Status](https://api.netlify.com/api/v1/badges/c19cf671-7d97-4bec-a496-8d33f48b8e74/deploy-status)](https://app.netlify.com/projects/app-chat-fe/deploys)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/hidao80/chat-fe)

![Accessibility](https://img.shields.io/badge/Accessibility-91-brightgreen?style=flat-square)&emsp;![Best_Practices](https://img.shields.io/badge/Best_Practices-100-brightgreen?style=flat-square)&emsp;![Performance](https://img.shields.io/badge/Performance-96-brightgreen?style=flat-square)&emsp;![SEO](https://img.shields.io/badge/SEO-90-brightgreen?style=flat-square)

A lightweight, privacy-first chat client for LLM APIs. Built with React, TypeScript, and Vite, it runs entirely in the browser as a static application — no dedicated backend is bundled. Users are expected to provide their own LLM server (e.g. a local Ollama instance or an OpenAI-compatible API endpoint).

## Features

- **Multi-provider support** — Works with OpenAI, LM Studio, GPT4ALL, and Ollama. Point it at any OpenAI-compatible endpoint you have running.
- **Client-side storage** — API keys and endpoint configuration are persisted in IndexedDB and never leave your device.
- **Markdown rendering** — AI responses are rendered as Markdown, supporting code blocks, lists, and formatting.
- **Progressive Web App (PWA)** — Installable on desktop and mobile with offline-ready service worker caching.
- **Conversation minimap** — A compact minimap beside the scrollbar shows all messages color-coded by sender. Click any block to jump to that message instantly.
- **i18n (Japanese / English)** — The UI supports Japanese and English; language preference is persisted in IndexedDB and auto-detected from the browser on first visit.
- **Dark mode** — Toggle between light and dark themes via the nav bar; preference is persisted in IndexedDB across sessions.
- **Scroll-to-bottom button** — A jump button appears automatically when the user scrolls away from the latest message.
- **Docker-ready** — Production image serves the static build via nginx; a dev compose file is included for local development.

## Tech Stack

| Layer | Technology |
|---|---|
| UI Framework | React 19 |
| Language | TypeScript (strict) |
| Bundler | Vite 7 |
| Styling | Tailwind CSS 4 |
| Markdown | marked |
| Storage | IndexedDB (native) |
| i18n | i18next / react-i18next |
| PWA | vite-plugin-pwa / Workbox |

## Quick Start

### Run with Docker

```bash
# Development
docker compose up

# Production build
docker build -t chat-fe .
docker run -p 80:80 chat-fe
```

### Run locally

```bash
pnpm install
pnpm run dev
```
