---
name: log-meal
description: .meshi-log に食事を記録する。ユーザーが食事の写真を送る、または「記録して」等と依頼したときに使う。写真から栄養成分を推定し、対話で訂正し、確定後にエントリと画像をコミットして GitHub Pages にデプロイし、公開URLを提示する。
---

# 食事記録 (log-meal)

ユーザーが食事の写真を送る／記録を依頼したら、以下の手順で記録する。
**確定するまでコミットしない。** 推定値であることを必ず明示する。

## 1. 推定

写真（と本文）から推定する：

- **items**: 料理名の配列（例: 「醤油ラーメン」「半チャーハン」）
- **type**: `breakfast` / `lunch` / `dinner` / `snack`（時刻から推定。迷えば聞く）
- **datetime**: JST の ISO8601（`+09:00`）。既定は現在時刻。ユーザーが時刻を述べたらそれに従う
- **nutrition**: 1食の合計。分かる成分だけでよい（開いたレコード）。キー一覧:
  `energy_kcal` `protein_g` `fat_g` `saturated_fat_g` `carbohydrate_g`
  `sugar_g` `fiber_g` `salt_g` `alcohol_g`
- **items[].nutrition**: 料理ごとの推定値（最低でも `energy_kcal`）。後述の
  内訳報告と記録のために、**料理単位でも分かる範囲で推定しておく**
- **tags**: 例 `外食` `自炊` `中食` `麺` `揚げ物` `お酒` など

## 2. 確認・訂正（内訳を必ず報告する）

推定結果を表で提示し、ユーザーに訂正させる。料理名・時刻・区分・成分・タグの
いずれも直せるようにする。OK が出るまで次に進まない。

**内訳の報告は必須。** 合計値だけでなく、次の粒度で必ず提示する:

- **料理ごとの内訳**: 各 item の推定 `energy_kcal`（分かれば P/F/C・塩分も）を
  1行ずつ表にし、最後に1食合計を示す
- **写真ごとの内訳**: 1食を複数枚で記録する場合（例: 主菜・副菜・お酒を別撮り）、
  **どの写真に何が写っているか**を写真単位でも対応づけて示す。写真の見落とし・
  重複を防ぐため、各写真の要素を必ず列挙する

内訳に対する訂正（料理名・点数・成分）も合計と同様に反映し、再提示してから確定する。

## 3. 画像保存

画像は **WebP・長辺1000px** に最適化して `public/images/YYYY/MM/` に保存する。
最適化には同梱スクリプト（`sharp` 依存。リポジトリに記録済み）を使う:

```
node scripts/optimize-image.mjs <受け取った画像> public/images/YYYY/MM/DD-HHmm-<type>.webp
```

- `node_modules` が無ければ先に `npm ci` を実行する（リモート環境は使い捨てのため、
  ツールは npm 依存として復元する。apt/mise 等で入れても次セッションには残らない）
- `photos` には公開パス（先頭の `public/` を除いた `images/YYYY/MM/DD-HHmm-<type>.webp`）
  を入れる

## 4. データ追記

確定した MealEntry を一時ファイル（例 `/tmp/entry.json`）に書き、専用スクリプトで
月別 JSON と index に安全に追記する（JSON の手編集はしない）:

```
node scripts/add-meal.mjs /tmp/entry.json
```

MealEntry の形（`src/data/types.ts` が唯一の真実）:

```json
{
  "id": "2026-06-19T12:30:00+09:00-lunch",
  "datetime": "2026-06-19T12:30:00+09:00",
  "type": "lunch",
  "photos": ["images/2026/06/19-1230-lunch.webp"],
  "items": [{ "name": "醤油ラーメン", "nutrition": { "energy_kcal": 720, "salt_g": 6.8 } }],
  "nutrition": { "energy_kcal": 720, "protein_g": 26, "fat_g": 22, "salt_g": 6.8 },
  "memo": "",
  "tags": ["外食", "麺"],
  "estimated": true,
  "schemaVersion": 1
}
```

- `id` は `<datetime>-<type>`
- `items[].nutrition` は内訳。ステップ2で報告した料理ごとの推定値を**そのまま記録する**
  （後からダッシュボードで内訳を再現できるように）。`nutrition` は1食合計

## 5. コミット & デプロイ

`public/data/` と `public/images/` の変更を、**デプロイ対象ブランチ（既定 `main`）**
にコミットして push する。記録はデータなので PR は不要、直接 push でよい。
push で `.github/workflows/deploy.yml` が再ビルド→デプロイする（数十秒〜1分）。

## 6. 反映確認 & URL 提示

デプロイ成功と本番反映を確認したら、運用ルールどおり公開URLを必ず提示する:

- 本番: https://ymat19.github.io/.meshi-log/
- モック: https://ymat19.github.io/.meshi-log/?mock=1
