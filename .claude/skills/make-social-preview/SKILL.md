---
name: make-social-preview
description: リポジトリのsocial preview画像(social-preview.svg)を作成する。GitHub social preview、OGP画像、SNSカード画像の作成依頼時に使用。
agent: general-purpose
background: false
---

# Commands
social-preview.svg作れ。サイズは1280×640。内容(リポジトリ名・説明)はREADME等から取得。

- 絵文字はTwemojiベクターにしろ。SVGはjsDelivrの`jdecked/twemoji`から取得し、外部参照でなくpathをインライン埋込(ラスタライズ時の欠落防止)。
- GitHubのsocial preview・OGPはSVG非対応のため、同サイズのPNGも書き出す。変換手段が無ければその旨ユーザーに伝える。
