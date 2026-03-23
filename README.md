# Prompt Palette

どこでも使えるテキスト挿入ランチャー。

グローバルホットキーで呼び出し、登録済みのテンプレート/プロンプトを検索・選択し、変数を埋めた完成テキストを現在フォーカス中の入力欄に自動ペーストするデスクトップアプリ。

## 特徴

- **どこでも動く** — ブラウザ、メモ帳、Excel、Slack等、OS上のあらゆる入力欄で使用可能
- **完全ローカル** — クラウド不要、アカウント不要、SQLiteでデータ管理
- **軽量** — Tauri v2ベースでアプリサイズ10〜20MB程度
- **変数補間** — `{{変数名}}` でテンプレートに動的な値を埋め込み
- **Import/Export** — `.ppb.json` 形式でテンプレートパックを共有

## 技術スタック

| レイヤー | 技術 |
|----------|------|
| アプリフレームワーク | Tauri v2 |
| フロントエンド | React 19 + TypeScript 5.8 |
| ビルドツール | Vite 7 |
| バックエンド | Rust (2021 edition) |
| データベース | SQLite (rusqlite) |

## 開発

### 必要な環境

- [Rust](https://rustup.rs/) (stable)
- [Node.js](https://nodejs.org/) 24+
- npm 11+

### セットアップ

```bash
npm install
npm run tauri:dev
```

### ビルド

```bash
npm run tauri:build
```

## ライセンス

Private
