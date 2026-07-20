---
name: analyzed-use-cases
description: Use case diagram covering the app's primary user interactions.
type: analysis
commit-hash: 1e98095b63fc3c649e8e1d7f4cd9e3fe5b911b34
---

# Use Cases

## Table of Contents

- [Actors](#actors)
- [Use Case Diagram](#use-case-diagram)

---

## Actors

- **User** — the sole actor; no admin/multi-user roles exist (single-browser-profile app).
- **LLM Provider** — external system (OpenAI / LM Studio / GPT4ALL / Ollama / llama.cpp), not a human actor but modeled as a secondary actor since the app integrates with it directly.

## Use Case Diagram

```mermaid
graph LR
  User((User))
  Provider((LLM Provider))

  subgraph Settings
    UC1[Configure provider & endpoint]
    UC2[Enter API key]
    UC3[Select model]
    UC4[Set reasoning effort]
    UC5[Edit system prompt]
    UC6[Copy system prompt]
  end

  subgraph Chat
    UC7[Send message]
    UC8[View AI response]
    UC9[Copy message]
    UC10[Create new chat]
    UC11[Load past session]
    UC12[Delete session]
    UC13[Scroll via minimap]
  end

  subgraph Global
    UC14[Toggle language]
    UC15[Toggle dark mode]
    UC16[Switch Settings/Chat screen]
  end

  User --> UC1
  User --> UC2
  User --> UC3
  User --> UC4
  User --> UC5
  User --> UC6
  User --> UC7
  User --> UC8
  User --> UC9
  User --> UC10
  User --> UC11
  User --> UC12
  User --> UC13
  User --> UC14
  User --> UC15
  User --> UC16

  UC3 -.fetch models.-> Provider
  UC7 -.fetch chat completion.-> Provider

  UC1 -.include.-> UC3
  UC7 -.include.-> UC8
```

See [[screens]] for the two screens these use cases map to, [[components]] for the components implementing each, and [[databases]] for what's persisted.

<!-- commit: 1e98095b63fc3c649e8e1d7f4cd9e3fe5b911b34 -->
