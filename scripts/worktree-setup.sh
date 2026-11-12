#!/usr/bin/env sh
# T3 Code sources this from a new worktree's root (`. scripts/worktree-setup.sh`), so it stays POSIX and leaves
# the calling shell alone: no set -e, cd, or exit. Safe to rerun by hand; a rerun resets the worktree's data to
# the seed.
case "$(git branch --show-current)" in
    "" | main | master)
        echo "Set up worktrees on a feature branch, not main or a detached HEAD." >&2
        false
        ;;
    *)
        pnpm install && node scripts/setup-dev-deployment.mjs
        ;;
esac
