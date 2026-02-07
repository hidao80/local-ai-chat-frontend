# Chat-FE

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Lint](https://github.com/hidao80/chat-fe/actions/workflows/lint.yml/badge.svg)
![Audit](https://github.com/hidao80/chat-fe/actions/workflows/audit.yml/badge.svg)
![Build](https://github.com/hidao80/chat-fe/actions/workflows/build.yml/badge.svg)
[![Netlify Status](https://api.netlify.com/api/v1/badges/c19cf671-7d97-4bec-a496-8d33f48b8e74/deploy-status)](https://app.netlify.com/projects/app-chat-fe/deploys)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/hidao80/chat-fe)

![Accessibility](https://img.shields.io/badge/Accessibility-91-brightgreen?style=flat-square)&emsp;![Best_Practices](https://img.shields.io/badge/Best_Practices-100-brightgreen?style=flat-square)&emsp;![Performance](https://img.shields.io/badge/Performance-96-brightgreen?style=flat-square)&emsp;![SEO](https://img.shields.io/badge/SEO-90-brightgreen?style=flat-square)

> **Technical Limitation**: HTTPS deployments (Netlify, Vercel, etc.) cannot access local HTTP LLM providers due to mixed content restrictions. Use development mode (`pnpm dev`) or self-host on HTTP for local LLM access.

## Overview

A privacy-first, browser-based chat interface for local LLMs (Ollama, GPT4ALL, LM Studio) and cloud providers. No backend required.

## Issues & Reasons

Local LLM providers lack easy-to-deploy, cross-platform GUIs. Chat-FE runs in any browser (Win/macOS/Linux/Android/iOS/iPadOS), connecting instantly to your local network providers.

<img width="30%" alt="Config Screen" src="https://github.com/user-attachments/assets/c29e1f02-bd8e-4996-af37-a130e78abf5d" />&emsp;
<img width="30%" alt="Chat Screen" src="https://github.com/user-attachments/assets/e2aa651b-6ec8-4bac-90f2-299c5830523e" />&emsp;
<img width="30%" alt="Chat History Menu" src="https://github.com/user-attachments/assets/132f6ac9-8b38-4799-a9b7-2c3044abeeaa" />

## Features

### Core Functionality

- **Multi-provider support** — Works with OpenAI, LM Studio, GPT4ALL, and Ollama. Point it at any OpenAI-compatible endpoint you have running.
- **Dynamic model selection** — Available models are fetched from the server when you select a provider. No manual configuration needed.
- **Reasoning model support** — For advanced reasoning models (o1, GPT-OSS, DeepSeek-R1), configure reasoning depth (low/medium/high). The app automatically detects reasoning-capable models.
- **System prompts per model** — System prompts are saved separately for each provider-model combination. Switch between models and your custom prompts are automatically restored.

### Chat Management

- **Chat history** — All conversations are stored in IndexedDB and persist across sessions. Browse past chats from the sidebar.
- **Sidebar navigation** — Desktop users see a persistent sidebar; mobile users access it via hamburger menu.
- **Delete with confirmation** — Remove unwanted chats with a confirmation modal to prevent accidental deletion.
- **Message copy** — Copy any message to clipboard with one click. Visual feedback confirms the action.

### User Experience

- **Client-side storage** — API keys and endpoint configuration are persisted in IndexedDB and never leave your device.
- **Markdown rendering** — AI responses are rendered as Markdown, supporting code blocks, lists, and formatting.
- **Performance metrics** — See tokens per second and timestamp for each AI response.
- **Conversation minimap** — A compact minimap beside the scrollbar shows all messages color-coded by sender. Click any block to jump to that message instantly.
- **Scroll-to-bottom button** — A jump button appears automatically when the user scrolls away from the latest message.

### Internationalization & Accessibility

- **i18n (Japanese / English)** — The UI supports Japanese and English; language preference is persisted in IndexedDB and auto-detected from the browser on first visit.
- **Dark mode** — Toggle between light and dark themes via the nav bar; preference is persisted in IndexedDB across sessions.
- **Responsive design** — Optimized layouts for mobile (hamburger menu) and desktop (persistent sidebar).

### Deployment

- **Progressive Web App (PWA)** — Installable on desktop and mobile with offline-ready service worker caching.
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

### Key Technologies

- **State Management**: React hooks (useState, useEffect, useRef)
- **Storage**: IndexedDB for chat history and system prompts
- **Routing**: Single-page app with conditional rendering (no router)
- **API Integration**: OpenAI-compatible REST APIs with fetch
- **Styling**: Tailwind CSS with dark mode support

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

## Configuration

### Supported Providers

The application supports multiple LLM providers with automatic model discovery:

| Provider | Default Endpoint | Authentication | Reasoning Support | Notes |
|----------|-----------------|----------------|-------------------|-------|
| **OpenAI** | `https://api.openai.com` | API Key required | Yes (o1 models with `reasoning_effort`) | Official OpenAI API |
| **Ollama** | `http://localhost:11434` | No auth | Yes (with `think` parameter) | Local models via Ollama |
| **GPT4ALL** | `http://localhost:4891` | No auth | No | Local OpenAI-compatible endpoint |
| **LM Studio** | `http://localhost:1234` | Optional | No | Local OpenAI-compatible endpoint |

### Provider-Specific Features

- **OpenAI**: Supports `reasoning_effort` parameter for o1 models (low/medium/high)
- **Ollama**: Supports `think` parameter for reasoning models like GPT-OSS and DeepSeek-R1
- **GPT4ALL / LM Studio**: OpenAI-compatible but without reasoning parameters

### CORS Configuration

**GPT4ALL**: Uses Vite proxy in development mode (no CORS configuration needed). In production, deploy with a reverse proxy.

**Ollama**: Set environment variable before starting:
```bash
# Windows
set OLLAMA_ORIGINS=*
ollama serve

# Linux/Mac
OLLAMA_ORIGINS=* ollama serve
```

**LM Studio**: Enable CORS in Server Settings

## Development

### Build

```bash
pnpm run build
```

### Type Check

```bash
pnpm exec tsc --noEmit
```

### Project Structure

```
src/
├── components/
│   └── ChatAndSettings.tsx  # Main UI components
├── locales/
│   ├── en.json             # English translations
│   └── ja.json             # Japanese translations
├── App.tsx                 # Root component
└── main.tsx                # Entry point
```
