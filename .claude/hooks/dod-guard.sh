#!/usr/bin/env bash
# DoD guard (Stop hook)
# 開発作業（src/・.claude/・設定・スタイル等）の変更を、コミット／push／PR／
# プレビューURL報告／PR監視まで終えずにターンを閉じるのを防ぐための再発防止フック。
#
# 仕組み: ターンを閉じようとした時に、フィーチャーブランチ上で「未コミット」または
# 「未pushのコミット」がある開発作業を検出したら、一度だけ DoD チェックリストを
# 注入してターンを継続させる。食事記録（public/data・public/images のみの変更）と
# main ブランチは対象外。stop_hook_active 時は再発火しない（無限ループ防止）。

set -euo pipefail

input="$(cat || true)"

# 既にこのフック起因で継続中なら何もしない（ループ防止）
if printf '%s' "$input" | grep -q '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

branch="$(git branch --show-current 2>/dev/null || true)"
# main は食事記録の直 push 用。開発作業の DoD 対象外。
[ -z "$branch" ] && exit 0
[ "$branch" = "main" ] && exit 0

# 変更ファイル一覧 = 未コミット + 未pushコミット分
uncommitted="$(git status --porcelain 2>/dev/null | awk '{print $2}')"
if git rev-parse --verify --quiet "origin/$branch" >/dev/null 2>&1; then
  unpushed="$(git diff --name-only "origin/$branch"..HEAD 2>/dev/null || true)"
else
  unpushed="$(git diff --name-only HEAD 2>/dev/null || true; git show --name-only --pretty=format: HEAD 2>/dev/null || true)"
fi

changed="$(printf '%s\n%s\n' "$uncommitted" "$unpushed" | sed '/^$/d' | sort -u)"
[ -z "$changed" ] && exit 0

# 食事記録だけ（public/data, public/images）なら対象外
devpaths="$(printf '%s\n' "$changed" | grep -vE '^public/(data|images)/' || true)"
[ -z "$devpaths" ] && exit 0

has_uncommitted="$(git status --porcelain 2>/dev/null | grep -vE ' public/(data|images)/' || true)"

reason="開発作業の DoD（CLAUDE.md「開発作業の DoD」）が未達のままターンを閉じようとしている。"
reason="$reason ブランチ '$branch' に未処理の開発変更がある:\n"
reason="$reason$(printf '%s\n' "$devpaths" | sed 's/^/  - /')\n\n"
reason="${reason}終える前に次を全て満たせ（聞かずに実行する）:\n"
reason="${reason}  1. フィーチャーブランチに commit\n"
reason="${reason}  2. git push -u origin $branch\n"
reason="${reason}  3. 必ず PR を立てる（PR 無しでは DoD 未達）\n"
reason="${reason}  4. Cloudflare のプレビューURL を PR から拾い、?mock=1 付きと併せてユーザーに報告\n"
reason="${reason}  5. subscribe_pr_activity で即座に PR 監視を開始\n"
if [ -n "$has_uncommitted" ]; then
  reason="${reason}\n※未コミットの変更が残っている。まず commit すること。"
fi

# Stop をブロックして reason を Claude に渡す
printf '{"decision":"block","reason":"%s"}\n' \
  "$(printf '%b' "$reason" | sed 's/\\/\\\\/g; s/"/\\"/g' | awk '{printf "%s\\n", $0}')"
exit 0
