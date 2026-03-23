# Prompt Palette — 要件定義書

## 1. プロダクト概要

### 1.1 コンセプト

「どこでも使えるテキスト挿入ランチャー」

グローバルホットキーで呼び出し、登録済みのテンプレート/プロンプトを検索・選択し、変数を埋めた完成テキストを現在フォーカス中の入力欄に自動ペーストするデスクトップアプリケーション。

### 1.2 ターゲットユーザー

- 定型文を頻繁に使うPC作業者（カスタマーサポート、開発者、ライターなど）
- テンプレートやプロンプトを整理・共有したい人
- 初期リリースは自分用、将来的に一般配布

### 1.3 対応プラットフォーム

| 優先度 | OS |
|--------|----|
| 最優先 | Windows 11 |
| 対応予定 | macOS |

### 1.4 設計原則

- **シンプル設計**: AI連携なし。テキスト挿入に徹する
- **どこでも動く**: ブラウザ、メモ帳、Excel、Slack等、OS上のあらゆる入力欄で使用可能
- **完全ローカル**: クラウド不要、アカウント不要、SQLiteでデータ管理
- **軽量**: Tauri v2ベースでアプリサイズ10〜20MB程度

---

## 2. 技術スタック

### 2.1 フレームワーク・言語

| レイヤー | 技術 | 理由 |
|----------|------|------|
| アプリフレームワーク | Tauri v2 | 軽量（Electronの1/10）、Rust製、Win/Mac両対応 |
| フロントエンド | React + TypeScript | エコシステムの豊富さ、型安全 |
| ビルドツール | Vite | 高速HMR、Tauri公式サポート |
| バックエンド | Rust | Tauriネイティブ、SQLite連携が高速 |
| データベース | SQLite | 組み込み型、ゼロ設定、配布が容易 |

### 2.2 主要クレート・ライブラリ

**Rust側:**

| クレート | 用途 |
|----------|------|
| rusqlite (or tauri-plugin-sql) | SQLiteアクセス |
| tauri-plugin-global-shortcut | グローバルホットキー登録 |
| tauri-plugin-clipboard-manager | クリップボード操作 |
| tauri-plugin-tray | システムトレイ常駐 + トレイメニュー |
| enigo | OSレベルのキーストローク送信（自動ペースト） |
| serde / serde_json | JSON シリアライズ/デシリアライズ |
| ulid | 衝突しないユニークID生成 |
| regex (or nom) | 変数テンプレートのパース |

**フロントエンド側:**

| ライブラリ | 用途 |
|------------|------|
| fuse.js | Fuzzy検索 |
| React Hook Form (任意) | 変数入力フォーム管理 |

### 2.3 CI/CD

- GitHub Actions で Windows (.msi) + macOS (.dmg) ビルドを自動化
- tauri-plugin-updater + GitHub Releases で自動アップデート配信

---

## 3. アーキテクチャ

### 3.1 レイヤー構成

```
┌─────────────────────────────────────────────┐
│  Frontend (React + TypeScript)              │
│  ┌──────────┐ ┌───────────┐ ┌──────────┐   │
│  │Launcher  │ │Template   │ │Settings  │   │
│  │UI        │ │Editor     │ │          │   │
│  └──────────┘ └───────────┘ └──────────┘   │
│  [ Fuzzy search + Tag filter + Var form ]   │
├──────────── Tauri IPC (invoke) ─────────────┤
│  Backend (Rust / Tauri v2)                  │
│  ┌──────────┐ ┌───────────┐ ┌──────────┐   │
│  │Template  │ │Variable   │ │Import /  │   │
│  │Service   │ │Engine     │ │Export    │   │
│  └──────────┘ └───────────┘ └──────────┘   │
│  [ Global hotkey + Clipboard + Keystroke + Tray ]  │
├─────────────────────────────────────────────┤
│  SQLite          │  OS Clipboard + Keyboard │
│  (templates,     │  (paste into any app)    │
│   categories,    │                          │
│   tags)          │                          │
└─────────────────────────────────────────────┘
```

### 3.2 ウィンドウ構成

| ウィンドウ | 説明 |
|------------|------|
| ランチャーウィンドウ | 枠なし(decorations: false)、always_on_top、画面中央表示。ホットキーで表示/非表示を切り替え |
| メインウィンドウ | テンプレート管理、カテゴリ/タグ管理、設定画面。通常のデスクトップウィンドウ |
| システムトレイ | タスクバー通知領域に常駐。左クリックでランチャー表示、右クリックでクイックメニュー（よく使うテンプレート、設定、終了） |

### 3.3 自動ペーストの仕組み

テキストをクリップボードにコピーした後、OSレベルでキーストロークを送信する。

```
1. ユーザーが何かしらの入力欄にフォーカスを置く
2. ホットキー（例: Ctrl+Space）でランチャーを呼び出す
   → この時点で元ウィンドウのフォーカス位置を記憶
3. テンプレ選択 → 変数入力（あれば） → 確定
4. 完成テキストをクリップボードにコピー
5. ランチャーウィンドウを非表示
6. 元のウィンドウにフォーカスを戻す
7. enigo で Ctrl+V（Mac: Cmd+V）キーストロークを自動送信
8. テキストが入力欄に挿入される
```

---

## 4. データモデル

### 4.1 テーブル一覧

全5テーブル。IDはすべてULID（インポート時のID衝突防止）。

### 4.2 TEMPLATES

テンプレート本体。アプリの中心テーブル。

| カラム | 型 | 説明 |
|--------|-----|------|
| id | TEXT PK | ULID |
| title | TEXT NOT NULL | 表示名 |
| body | TEXT NOT NULL | テンプレート本文（{{変数}}を含む） |
| category_id | TEXT FK | カテゴリへの外部キー（nullable） |
| hotkey | TEXT | 個別ショートカット（nullable） |
| use_count | INTEGER DEFAULT 0 | 使用回数（頻度ランキング用） |
| last_used_at | TEXT | 最終使用日時 ISO 8601（nullable） |
| sort_order | INTEGER DEFAULT 0 | 並び順 |
| created_at | TEXT NOT NULL | 作成日時 ISO 8601 |
| updated_at | TEXT NOT NULL | 更新日時 ISO 8601 |

### 4.3 CATEGORIES

テンプレートの分類。

| カラム | 型 | 説明 |
|--------|-----|------|
| id | TEXT PK | ULID |
| name | TEXT NOT NULL UNIQUE | カテゴリ名 |
| icon | TEXT | アイコン（emoji or コード） |
| color | TEXT | 表示色（hex） |
| sort_order | INTEGER DEFAULT 0 | 並び順 |

### 4.4 TAGS

自由タグ。テンプレートとは多対多。

| カラム | 型 | 説明 |
|--------|-----|------|
| id | TEXT PK | ULID |
| name | TEXT NOT NULL UNIQUE | タグ名 |

### 4.5 TEMPLATE_TAGS

テンプレートとタグの中間テーブル。

| カラム | 型 | 説明 |
|--------|-----|------|
| template_id | TEXT FK | TEMPLATES.id |
| tag_id | TEXT FK | TAGS.id |
| | | PK = (template_id, tag_id) |

### 4.6 VARIABLES

テンプレートに紐づく変数定義。すべての変数はコンボボックス（プルダウン選択＋自由入力の両対応）として表示される。

| カラム | 型 | 説明 |
|--------|-----|------|
| id | TEXT PK | ULID |
| template_id | TEXT FK NOT NULL | TEMPLATES.id |
| key | TEXT NOT NULL | 変数キー（例: customer_name） |
| label | TEXT NOT NULL | 表示ラベル（例: お客様名） |
| default_value | TEXT | デフォルト値（nullable） |
| options | TEXT | 選択肢 JSON配列（nullable、例: `["様","さん","御中"]`） |
| sort_order | INTEGER DEFAULT 0 | フォーム内の並び順 |

**コンボボックスの動作:**

- options が空/null → 純粋なフリーテキスト入力（通常のテキストフィールド）
- options に値あり → プルダウン選択肢を表示しつつ、自由入力も受け付けるコンボボックス
- 過去に入力した値を履歴として options に自動追加（任意設定）
- すべての変数で統一されたUIを提供し、ユーザーの学習コストをゼロにする

---

## 5. 変数補間エンジン

### 5.1 構文定義

```
{{variable_name}}              基本変数
{{variable_name|filter}}       パイプフィルター付き
{{variable_name|default:"N/A"}} デフォルト値付き
{{#if variable}}...{{/if}}     条件ブロック
{{@clipboard}}                 組み込み: 現在のクリップボード内容
{{@today}}                     組み込み: 今日の日付 (YYYY-MM-DD)
{{@now}}                       組み込み: 現在日時 (YYYY-MM-DD HH:mm)
```

**パースの正規表現パターン:**

```regex
\{\{([#@/]?\w+)(\|[^}]+)?\}\}
```

### 5.2 パイプフィルター

| フィルター | 説明 | 例 |
|-----------|------|-----|
| upper | 大文字変換 | `{{name\|upper}}` → TANAKA |
| lower | 小文字変換 | `{{name\|lower}}` → tanaka |
| trim | 前後空白除去 | `{{name\|trim}}` |
| default:"値" | 空の場合のフォールバック | `{{name\|default:"N/A"}}` |

### 5.3 組み込み変数（@プレフィックス）

ユーザー入力不要で自動的に値が埋まる変数。

| 変数 | 説明 |
|------|------|
| @clipboard | ランチャー呼び出し時点のクリップボード内容 |
| @today | 当日日付 (YYYY-MM-DD) |
| @now | 現在日時 (YYYY-MM-DD HH:mm) |

### 5.4 処理パイプライン（Rust側）

```
1. テンプレートのbodyからすべての {{...}} トークンを抽出
2. 組み込み変数（@today, @clipboard, @now）を分離
3. 残りのトークンをVARIABLESテーブルとマッチング
4. フロントエンド向けのフォームスキーマ（JSON）を生成
   → 各変数の options と default_value をフロントに渡す
   → options がある変数はコンボボックス、ない変数はテキスト入力として描画
5. フロントエンドからIPC経由で入力値を受け取る
6. パイプフィルターを適用（upper, lower, trim, default）
7. 条件ブロック（{{#if}}...{{/if}}）を評価
8. すべてのトークンを置換 → 完成文字列を返す
9. （任意）入力された新規値を該当変数の options に追記保存
```

---

## 6. ランチャーUI/UXフロー

### 6.1 起動フロー

```
[Ctrl+Space] or [トレイアイコン左クリック] → ランチャー表示
  ↓
検索バーにフォーカス（自動）
  ↓
初期表示: 最近使用 / 使用頻度順でテンプレ一覧
  ↓
文字入力 → fuse.jsでリアルタイム絞り込み
  ↓
Enter or クリック → テンプレート選択
  ↓
(A) 変数なし → 即座にクリップボードコピー + 自動ペースト
(B) 変数あり → 変数入力フォーム表示 → 入力 → 確定 → 自動ペースト
  ↓
ランチャー非表示 → 元のウィンドウにフォーカス復帰
```

### 6.2 キーボード操作

| キー | 動作 |
|------|------|
| Ctrl+Space (設定可) | ランチャー表示/非表示トグル |
| ↑↓ | 検索結果リストのカーソル移動 |
| Enter | 選択中のテンプレートを確定 |
| Esc | ランチャーを閉じる（どのステップからでも） |
| Tab | 変数フォーム内のフィールド移動 |

### 6.3 検索ロジック

fuse.jsを使用した Fuzzy search。検索対象と重み付け:

| 検索対象 | Weight |
|----------|--------|
| title | 1.0 |
| tags (名前) | 0.7 |
| body | 0.3 |

検索結果のソートは fuse.jsスコア + use_count（使用頻度）を加味。入力が空の場合は use_count DESC + last_used_at DESC で表示。

### 6.4 ウィンドウ仕様

| 項目 | 値 |
|------|-----|
| サイズ | 幅 600px、高さ可変（最大 480px） |
| 位置 | 画面中央 |
| decorations | false（枠なし） |
| always_on_top | true |
| skip_taskbar | true |
| transparent | true（角丸のため） |

---

## 7. Import / Export

### 7.1 バンドル形式

ファイル拡張子: `.ppb.json`（Prompt Palette Bundle）

```json
{
  "format": "prompt-palette-bundle",
  "version": "1.0.0",
  "exported_at": "2026-03-24T10:00:00Z",
  "author": {
    "name": "作成者名",
    "url": "https://github.com/..."
  },
  "pack": {
    "name": "パック名",
    "description": "パックの説明",
    "categories": [
      {
        "id": "ulid...",
        "name": "カテゴリ名",
        "icon": "inbox",
        "color": "#534AB7"
      }
    ],
    "tags": [
      { "id": "ulid...", "name": "タグ名" }
    ],
    "templates": [
      {
        "id": "ulid...",
        "title": "テンプレート名",
        "body": "本文 {{variable}} を含む",
        "category": "カテゴリ名",
        "tags": ["タグ名"],
        "variables": [
          {
            "key": "variable",
            "label": "表示ラベル",
            "default_value": "",
            "options": ["選択肢1", "選択肢2"]
          }
        ]
      }
    ]
  }
}
```

### 7.2 Export 仕様

- スコープ選択: 全テンプレート / カテゴリ単位 / 個別選択
- 関連するカテゴリ、タグ、変数定義を自動バンドル
- 設定情報やユーザー固有データは含めない

### 7.3 Import 仕様

- ファイル選択ダイアログ or ドラッグ&ドロップ
- URLからのインポート対応（GitHub raw file等）
- インポートプレビュー: 取り込み対象の一覧表示
- 衝突解決（同名テンプレートが既に存在する場合）:
  - スキップ（既存を維持）
  - 上書き（インポートデータで置換）
  - 両方残す（インポート側をリネーム）
- バンドルのバージョン検証（format, version フィールド）

### 7.4 配布戦略（段階的）

| Phase | 方法 | インフラ |
|-------|------|----------|
| Phase 1 | .ppb.json をSlack/Discord/メールで共有 | なし |
| Phase 2 | GitHubリポジトリに公開、アプリから URL Import | なし |
| Phase 3 | アプリ内ギャラリー（GitHub Pages上の静的JSONインデックス） | GitHub Pages |
| Phase 4 | マーケットプレイス（需要次第で検討） | 要サーバー |

---

## 8. 開発フェーズ

### Phase 0: Scaffolding

Tauri + React + SQLiteの基盤構築。エンドツーエンドでデータが通ることを確認。

- [ ] Tauri v2 + React + TypeScript + Vite プロジェクト初期化
- [ ] SQLite セットアップ（rusqlite or tauri-plugin-sql）
- [ ] DBスキーママイグレーション（バージョン管理）
- [ ] IPC ブリッジ: Rust command を React から呼び出し確認
- [ ] GitHub Actions: Windows + macOS ビルド

### Phase 1: Core — CRUD + ランチャー + 自動ペースト

ここまでで自分用ツールとして毎日使える状態を目指す。

- [ ] テンプレート CRUD（作成、読取、更新、削除）
- [ ] カテゴリ / タグ管理
- [ ] メインウィンドウ: テンプレート一覧 + エディター
- [ ] グローバルホットキー（tauri-plugin-global-shortcut）
- [ ] ランチャーウィンドウ: 枠なしフローティング検索バー
- [ ] Fuzzy検索（fuse.js）+ use_countによる頻度ランキング
- [ ] クリップボードコピー + 自動 Ctrl+V（enigo crate）
- [ ] フォーカス復帰: 元ウィンドウを記憶して戻す
- [ ] システムトレイ常駐（tauri-plugin-tray）
- [ ] トレイメニュー: よく使うテンプレート、設定を開く、終了

### Phase 2: Variable interpolation

変数補間エンジンの実装。テンプレートの表現力を向上。

- [ ] Rust パーサー: {{...}} トークン抽出
- [ ] コンボボックスUI: プルダウン選択＋自由入力の統一コンポーネント
- [ ] ランチャー内の自動生成フォーム（変数定義からコンボボックスを動的生成）
- [ ] 入力履歴の自動蓄積（過去の入力値をoptionsに追加）
- [ ] パイプフィルター: upper, lower, trim, default
- [ ] 組み込み変数: @clipboard, @today, @now
- [ ] 条件ブロック: {{#if}}...{{/if}}

### Phase 3: Import/Export + 公開リリース

配布可能なアプリとして完成。

- [ ] Export: .ppb.json バンドル生成
- [ ] Import: プレビュー、差分表示、衝突解決
- [ ] ドラッグ&ドロップ + URLインポート
- [ ] 設定UI: ホットキー設定、テーマ（ライト/ダーク）、言語
- [ ] オンボーディング: 初回チュートリアル + サンプルテンプレート
- [ ] 自動アップデート（tauri-plugin-updater）
- [ ] アプリアイコン、インストーラー、ランディングページ

---

## 9. 非機能要件

### 9.1 パフォーマンス

- ランチャー表示: ホットキーから200ms以内
- 検索レスポンス: キー入力からリスト更新まで50ms以内
- 自動ペースト: 確定からテキスト挿入まで500ms以内

### 9.2 セキュリティ

- すべてのデータは完全ローカル（外部通信なし、自動アップデート確認を除く）
- エクスポートバンドルには設定情報を含めない

### 9.3 アプリサイズ

- インストーラー: 20MB以下
- メモリ使用量: 常駐時50MB以下

### 9.4 対応言語（UI）

- 初期: 日本語 + 英語
- i18n対応の仕組みを最初から組み込む
