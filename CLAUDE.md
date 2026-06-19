# .meshi-log

個人用の食事記録ダッシュボード。チャットに食事の写真を送ると、エージェントが
栄養成分を推定 → 対話で訂正 → JSON としてリポジトリにコミットし、GitHub Pages
上のダッシュボードに反映される。メタボリックシンドローム管理のため、栄養成分の
記録・集計・統計を主目的とする。

## 技術スタック

- Vite + React + TypeScript
- **デプロイは GitHub Actions**（`actions/deploy-pages`）。push のたびに CI が
  ビルドして Pages に公開する。**ビルド成果物（dist/）はコミットしない**
  （`.gitignore` 済み）。生成物を Git 管理しないため source/dist の drift が
  起きない、というのが標準プラクティス。
- データ（月別 JSON・画像）は `public/` に置き、ビルド時に dist へコピーされる。
  記録を追加 → push すると Actions が再デプロイ（数十秒〜1分のラグ）。

## ディレクトリ構成

```
index.html               Vite エントリ
.github/workflows/deploy.yml   Pages へのビルド&デプロイ
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
npm run preview      # ビルド結果をローカル確認
```

## GitHub Pages の設定

リポジトリは public。Settings → Pages → **Source を「GitHub Actions」** に設定する。
`main` への push で `.github/workflows/deploy.yml` が動き、ビルドして公開する。
（「Deploy from a branch」は使わない。ビルド成果物をコミットしない方針のため。）
