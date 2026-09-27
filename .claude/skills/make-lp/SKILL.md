---
name: make-lp
description: Pico CSSベースのLP(index.html)を作成・更新する。ランディングページ、プロジェクト紹介ページ、GitHub Pages用トップページ作成依頼時に使用。
agent: general-purpose
background: false
---

# Commands

index.html をpico.cssベースでLPとして作成して。既存のindex.htmlがあれば読んでから更新。LPの内容(製品名・説明・URL等)はREADME等リポジトリから取得、不明点はユーザーに確認。

1) ライト/ダークテーマ対応。
2) OGP(X.comも)対応。`og:url`・`og:image`は絶対URL、X用に`twitter:card`も設定。
3) JSON-LDスキーマ対応。
4) ファビコンはtwemojiのSVGから設定。SVGはjsDelivrの`jdecked/twemoji`から取得(旧MaxCDNは提供終了)。
