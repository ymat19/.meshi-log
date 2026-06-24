# .meshi-log

個人用の食事記録ダッシュボード。チャットに食事写真を送るとエージェントが栄養成分を
推定・記録し、Cloudflare Workers 上のダッシュボードに反映する（メタボ管理が主目的）。

## クイックスタート

```bash
npm install
npm run dev            # http://localhost:5173/  （?mock=1 でモックプレビュー）
npm run build          # dist/ にビルド
```

- 実データ: `public/data/` の月別 JSON を読み込む
- モード切替: `?mock=1`（モック生成データ）/ パラメータ無し（実データ）
- デプロイ: `main` への push で Cloudflare Workers Builds が自動公開（dist はコミットしない）
- 公開URL: https://meshi-log.ymat19.workers.dev

詳細な設計・データモデル・運用は [CLAUDE.md](./CLAUDE.md) を参照。
