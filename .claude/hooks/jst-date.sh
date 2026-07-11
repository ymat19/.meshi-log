#!/usr/bin/env bash
# SessionStart フック（日付ズレ再発防止）
# ハーネスが注入する currentDate は UTC 基準で、JST とは日付が1日ズレることがある
# （UTC 夜＝JST 翌朝）。過去に「セッション序盤に一度だけ JST を見て『昨日』を頭で
# 固定し、記録時（実際は翌日）に再計算せず 1 日ズレて記録する」失敗を繰り返した。
# これを断つため、セッション開始時に JST の「現在・今日・昨日」を機械的に算出して
# 明示し、記録の日付は常にこの値（またはユーザー指定）に従わせる。
set -euo pipefail

now="$(TZ=Asia/Tokyo date '+%Y-%m-%d (%a) %H:%M')"
today="$(TZ=Asia/Tokyo date '+%Y-%m-%d')"
yday="$(TZ=Asia/Tokyo date -d 'yesterday' '+%Y-%m-%d')"

msg="【JST基準・食事記録の日付は必ずこれを使う】現在: ${now} JST / 今日=${today} / 昨日=${yday}。"
msg="${msg}ハーネスの currentDate は UTC 基準で JST と1日ズレることがある。"
msg="${msg}記録の日付は頭で固定せず、記録・確認の瞬間に TZ=Asia/Tokyo date（-d yesterday）で再算出し、"
msg="${msg}この JST 値かユーザー指定に従うこと。AskUserQuestion の選択肢に日付を出すときも手打ちせずこの算出値を使う。"

printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "$msg"
exit 0
