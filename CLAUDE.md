# .meshi-log

個人用の食事記録ダッシュボード。チャットに食事の写真を送ると、エージェントが
栄養成分を推定 → 対話で訂正 → JSON としてリポジトリにコミットし、Cloudflare
Workers 上のダッシュボードに反映される。メタボリックシンドローム管理のため、
栄養成分の記録・集計・統計を主目的とする。

## 技術スタック

- Vite + React + TypeScript
- **デプロイは Cloudflare Workers**（静的アセット配信、`wrangler.jsonc`）。
  リポジトリを Cloudflare に連携しており、`main` への push のたびに Workers Builds
  がビルドして公開する。**ビルド成果物（dist/）はコミットしない**（`.gitignore`
  済み）。生成物を Git 管理しないため source/dist の drift が起きない、という
  のが標準プラクティス。
- データ（月別 JSON・画像）は `public/` に置き、ビルド時に dist へコピーされ、
  Workers の静的アセットとして配信される。記録を追加 → push すると Cloudflare が
  再デプロイ（数十秒〜1分のラグ）。
- CI（`.github/workflows/ci.yml`）は PR でビルドを検証するのみ（デプロイはしない）。
  `@cloudflare/vite-plugin` は Node 22+ を要求するため、CI も Node 22 を使う。

## ディレクトリ構成

```
index.html               Vite エントリ
wrangler.jsonc           Cloudflare Workers の設定（静的アセット配信）
.github/workflows/ci.yml       PR でのビルド検証（デプロイはしない）
src/                      アプリ本体（mock/real を一切意識しない）
  data/
    types.ts              全データの型（唯一の真実）
    config.ts             栄養素・食事区分の定義（両ソースが返す）
    MealDataSource.ts     データソースのインターフェース
    HttpDataSource.ts     実データ実装（public/data を fetch）
    createDataSource.ts   ★唯一の分岐点（?mock を見て実装を選ぶ）
    DataSourceContext.tsx Provider と useMealData フック
    mock/
      MockDataSource.ts   モック実装
      generator.ts        シード付き決定論的データ生成器
      sampleImages.ts     SVG data URI のダミー写真
  lib/nutrition.ts        集計ユーティリティ
  components/             DailySummary / Timeline
public/                   ビルドに含める静的ファイル（ランタイムデータ）
  data/index.json         存在する月のリスト {"months": ["YYYY-MM"]}
  data/YYYY-MM.json       その月の MealEntry 配列
  images/YYYY/MM/...       食事写真
dist/                     ビルド出力（git 管理外）
```

## モックモード

- `?mock=1` を付けるとモック、無ければ実データ。**切り替えは `createDataSource()`
  の 1 箇所だけ**。アプリ本体・コンポーネントには mock/real の分岐を一切書かない。
- モックはシード付き生成器で約 90 日分を決定論的に生成。データが少なくても
  ダッシュボードをフルにプレビューできる。
- 原則：**モックと実データはデータソース以外まったく同一**。新機能を追加するときも
  この不変条件を壊さないこと（アプリ層に mock 判定を持ち込まない）。

## データモデル（MealEntry）

`src/data/types.ts` を参照。要点：
- `nutrition` は省略可能フィールドの開いたレコード（成分は後から追加できる）
- `schemaVersion` を持たせ、将来のフォーマット変更に備える
- `datetime` は JST オフセット付き ISO8601（例 `2026-06-19T12:30:00+09:00`）

## 開発コマンド

```
npm install
npm run dev          # 開発サーバ。?mock=1 でモックプレビュー
npm run build        # dist/ にビルド（型チェック込み）
npm run preview      # ビルドして wrangler dev でローカル確認（Workers 相当）
npm run deploy       # ビルドして wrangler deploy で本番公開（通常は CI に任せる）
```

## Cloudflare Workers の設定

リポジトリを Cloudflare の Workers Builds に連携している。`main` への push で
自動的にビルド＆公開される（GitHub Actions ではデプロイしない）。Worker 設定は
`wrangler.jsonc`（`assets.not_found_handling: single-page-application` で SPA 配信）。
`@cloudflare/vite-plugin` は Node 22+ を要求するので、ローカル・CI とも Node 22 以上を使う。

公開URL: https://meshi-log.ymat19.workers.dev

## 運用ルール

### 記録時の絶対ルール（過去の失敗から）

- **「今日／昨日／今朝」は必ず日本時間（JST）で判断する。** ハーネスが注入する
  `currentDate` は **UTC 基準**で、日本時間とは日付が1日ズレることがある（UTC 夜＝
  JST 翌朝）。日付に関わる記録をする前に、必ず実時刻を `TZ=Asia/Tokyo date` で確認し、
  JST の「今日」を確定してから「昨日」を逆算する。`currentDate` を鵜呑みにしない。
- **ユーザーへの確認・選択肢は必ず `AskUserQuestion`（サジェスト UI）で出す。**
  本文テキストに質問を箇条書きで書いて答えを待つのは禁止。具材・時刻・区分・重複の
  扱いなど、訂正を求めるものはすべてサジェストで提示する。
- **質問の前に必ず自分で調査する。** 既存データ・JST 実時刻・ファイル等で確認できる
  ことは確認してから聞く。確認すれば自明なことを質問に化けさせない（例：日付ズレを
  検証せずに「重複かも」と聞く、は禁止）。

### push 先のルール

- **`main` への push が許されるのは「食事記録の追加」だけ**（`public/data/**`・
  `public/images/**` への記録追加と、それに付随する `index.json` 更新）。記録は
  即デプロイして本番に反映したいので `main` 直 push でよい。
- **アプリのコード変更（`src/`・設定・スタイル等の開発作業）は `main` に push しない。**
  必ずフィーチャーブランチで作業し、プレビューで確認する。

### 開発作業の DoD（完了の定義）

**手順は固定。迷う余地はない。ユーザーに選択肢を聞くな。**

1. フィーチャーブランチで作業し、push する。
2. **必ず PR を立てる**（コード変更で PR を立てない選択肢は無い。プレビュー URL は
   Cloudflare が PR 上に出すので、PR 無しでは DoD を満たせない）。
3. Cloudflare のプレビューデプロイ URL を PR から拾い、ユーザーに報告する。
   このとき **`?mock=1` 付きの URL も必ず併記する**。
4. プレビュー URL を報告した時点で開発作業は完了。本番＝`main` への反映は
   ユーザーがマージで判断する（こちらからは `main` に push しない）。
5. **PR を立てたら、言われなくても必ずその PR を監視する**（`subscribe_pr_activity`
   を即座に呼ぶ）。「監視しますか？」とは聞かない。CI 失敗・レビューコメントには
   投稿された方針に従って自動対応し、PR が merge / close されるまで監視を続ける。

やってはいけないこと：「PR を立てるか」「設定を確認するか」「監視するか」等をユーザー
に質問すること。Cloudflare ダッシュボードがこの環境から見えない等の事情を長々と説明
すること。黙って PR を立て、監視を開始し、URL を報告すればよい。

### 食事記録のデプロイ報告

- **記録の追加が本番サイトに反映（デプロイ成功＆反映確認）できたら、毎回その公開URLを
  ユーザーに提示する。** その際、**モックプレビュー用の `?mock=1` 付き URL も必ず併記する。**
  - 本番: https://meshi-log.ymat19.workers.dev
  - モック: https://meshi-log.ymat19.workers.dev/?mock=1
