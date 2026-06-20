# .meshi-log

個人用の食事記録ダッシュボード。チャットに食事写真を送るとエージェントが栄養成分を
推定・記録し、GitHub Pages 上のダッシュボードに反映する（メタボ管理が主目的）。

## クイックスタート

```bash
npm install
npm run dev            # http://localhost:5173/  （?mock=1 でモックプレビュー）
npm run build          # dist/ にビルド
```

- 実データ: `public/data/` の月別 JSON を読み込む
- モード切替: `?mock=1`（モック生成データ）/ パラメータ無し（実データ）
- デプロイ: `main` への push で GitHub Actions が Pages へ公開（dist はコミットしない）
- PR プレビュー: Cloudflare Pages を併用（PR ごとに固有 URL を自動生成）。設定は [docs/pr-preview.md](./docs/pr-preview.md)

詳細な設計・データモデル・運用は [CLAUDE.md](./CLAUDE.md) を参照。
