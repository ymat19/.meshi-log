# PR プレビュー（Cloudflare Pages）

PR ごとに固有 URL のプレビューサイトを自動生成するための設定。

## なぜ GitHub Pages ではなく Cloudflare Pages か

GitHub Pages は 1 リポジトリにつき本番サイトを 1 つしか配信できず、PR ごとの
プレビュー URL を出すネイティブ機能がない。唯一の回避策（`pr-preview-action`）は
Pages の Source を「Deploy from branch」に戻し、ビルド成果物を `gh-pages`
ブランチにコミットすることを要求する。これは本プロジェクトの方針（成果物を
コミットしない／Source は GitHub Actions）に反するため採用しない。

Cloudflare Pages は Git 連携するだけで、push / PR のたびに自動ビルドし、
プレビューごとに固有 URL を発行する。成果物のコミットは不要で帯域も無制限。

**本番（https://ymat19.github.io/.meshi-log/）はそのまま GitHub Pages を使い続け、
Cloudflare はプレビュー用途として併用する。**

### コード改修が不要な理由

アプリ内のパス参照はすべて相対：

- アセット: `vite.config.ts` の `base: './'`
- データ fetch: `import.meta.env.BASE_URL`（= `./`）→ `./data/...`
- 画像: JSON 内のパスが `images/...`（先頭スラッシュなし）

このため github.io のサブパス配信でも、Cloudflare のサブドメイン直下配信でも、
どちらでも同じように解決される。プレビュー用に追加のコードや設定ファイルは要らない。

## セットアップ手順（ダッシュボード操作）

1. https://dash.cloudflare.com/ にログイン（無料アカウントを作成）
2. **Workers & Pages → Create → Pages → Connect to Git**
3. GitHub アカウントを連携し、`ymat19/.meshi-log` を選択
4. ビルド設定を以下にする：

   | 項目 | 値 |
   | --- | --- |
   | Framework preset | Vite |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Production branch | `main` |
   | Node version | 20（環境変数 `NODE_VERSION=20` で固定推奨） |

5. **Save and Deploy**

以降、`main` 以外のブランチへの push / PR ごとにプレビューがビルドされ、
`https://<hash>.<project>.pages.dev` という固有 URL が割り当てられる。
GitHub の PR 画面にも Cloudflare のデプロイステータスが表示される。

## 補足

- `npm run build` は `tsc --noEmit && npm run validate && vite build`。型チェックと
  データ検証に失敗するとプレビュービルドも失敗するので、壊れた PR はプレビューされない。
- 無料枠: ビルド 500 回/月・帯域無制限（2026 時点）。個人利用では十分。
- production branch を `main` にすると Cloudflare 側にも本番デプロイ
  （`*.pages.dev`）が生成されるが、正本は github.io のままで構わない。Cloudflare の
  本番 URL は無視してよい（プレビュー機能のためにこの設定が必要）。
