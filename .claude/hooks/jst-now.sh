#!/usr/bin/env bash
# JST clock injector (UserPromptSubmit hook)
#
# 再発防止（2026-08-12/13 の失敗から）:
# ハーネスが注入する currentDate は UTC 基準で、しかも「セッション開始時の値」なので
# 日をまたいでも更新されない。過去に、セッション序盤に一度 `TZ=Asia/Tokyo date` を
# 実行した結果を数時間後まで使い回し、日付が変わったことに気づかずに
# ユーザーの「昨日」を1日ズラして解釈し、既存記録との矛盾として質問し返す、という
# 事故を起こした（ユーザーに二度同じことを言わせた）。
#
# 対策: ユーザーが発言するたびに、その時点の JST の今日／昨日／一昨日を計算して
# コンテキストへ注入する。これによりモデル側が時刻を「覚えておく」必要が無くなり、
# 古い値の使い回しが構造的に起きなくなる。

set -euo pipefail

now="$(TZ=Asia/Tokyo date '+%Y-%m-%d %H:%M:%S (%a)')"
today="$(TZ=Asia/Tokyo date '+%Y-%m-%d')"
yesterday="$(TZ=Asia/Tokyo date -d 'yesterday' '+%Y-%m-%d' 2>/dev/null || TZ=Asia/Tokyo date -v-1d '+%Y-%m-%d')"
day_before="$(TZ=Asia/Tokyo date -d '2 days ago' '+%Y-%m-%d' 2>/dev/null || TZ=Asia/Tokyo date -v-2d '+%Y-%m-%d')"

cat <<EOF
<jst-clock>
現在時刻（日本時間・このユーザー発言の時点で再計算された値）: ${now}
  今日   = ${today}
  昨日   = ${yesterday}
  一昨日 = ${day_before}

これが日付判断の唯一の基準。ハーネスの currentDate（UTC・セッション開始時点で固定）や、
会話の前の方で自分が実行した \`date\` の結果は古い可能性があるので使わない。
ユーザーが「今日／昨日／今朝／昨日夜」と言ったら、必ず上の値で解釈すること。
</jst-clock>
EOF
