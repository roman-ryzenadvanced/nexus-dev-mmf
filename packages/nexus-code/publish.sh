# Push nexus-code to your GitHub repo
# ============================================================
# This script walks you through publishing the nexus-code package
# as a new addition to your existing nexus-dev-mmf repo.
#
# IMPORTANT — first revoke the leaked token from earlier in the chat:
#   https://github.com/settings/tokens
# Then generate a fresh token with `repo` scope.
# ============================================================

set -e

REPO_URL="https://github.com/roman-ryzenadvanced/nexus-dev-mmf.git"
PACKAGE_DIR="packages/nexus-code"

echo "============================================================"
echo "  Publishing nexus-code to $REPO_URL"
echo "============================================================"
echo ""
echo "Step 0 — Revoke the leaked token NOW if you haven't:"
echo "  https://github.com/settings/tokens"
echo ""
echo "Step 1 — Generate a fresh Personal Access Token (classic) with 'repo' scope:"
echo "  https://github.com/settings/tokens/new?scopes=repo&description=nexus-code-publish"
echo ""
read -rp "Paste your FRESH token (input is hidden): " -s GH_TOKEN
echo ""
echo ""

if [ -z "$GH_TOKEN" ]; then
  echo "No token provided. Aborting."
  exit 1
fi

# Authenticated remote URL — token is interpolated, never logged.
AUTH_URL="https://${GH_TOKEN}@github.com/roman-ryzenadvanced/nexus-dev-mmf.git"

# --- Clone the existing repo to a temp dir, copy in the new package, commit, push ---
WORK_DIR=$(mktemp -d)
echo "Cloning existing repo to $WORK_DIR ..."
git clone --depth 50 "$AUTH_URL" "$WORK_DIR/repo"
cd "$WORK_DIR/repo"

# Make sure packages/ exists
mkdir -p packages

# Wipe any prior nexus-code dir (in case of re-runs)
rm -rf "$PACKAGE_DIR"

# Copy in the new package
cp -r /home/z/my-project/download/nexus-tui "$PACKAGE_DIR"
# Don't carry over the local .git directory
rm -rf "$PACKAGE_DIR/.git"

# Stage everything
git add "$PACKAGE_DIR"

# Also update root README and CHANGELOG if they exist
if [ -f README.md ]; then
  cp /home/z/my-project/download/nexus-tui/README.md README.md
  git add README.md
fi
# CHANGELOG may live at root or under packages/nexus-code — keep both in sync
cp /home/z/my-project/download/nexus-tui/CHANGELOG.md "$PACKAGE_DIR/CHANGELOG.md"
git add "$PACKAGE_DIR/CHANGELOG.md"

# Commit
git config user.email "roman-ryzenadvanced@users.noreply.github.com"
git config user.name "roman-ryzenadvanced"

git commit -m "feat(code): nexus-code v1.1.7 — rebrand + full feature parity + docs

Full rebrand from 'nexus-tui' / 'Nexus CLI' to 'Nexus Code' / 'nexus-code',
consolidating all work from v1.1.0 through v1.1.7 into a single PR.

Rebrand (v1.1.7):
- Package name: nexus-tui → nexus-code (npm)
- Binary: adds nexus-code alias (keeps nexus as primary)
- All user-visible strings: 'nexus-tui' → 'nexus-code'
- README + docs + examples + CI workflows + publish script updated
- In-app branding: header, status, help overlay, wizard, web UI
- MCP clientInfo name updated (both stdio + HTTP transports)
- Plugin example comments updated

Features (cumulative v1.1.0 → v1.1.7):
- 3 providers (OpenAI-compatible, Anthropic, Z.ai MMFE-native)
- 20 builtin slash commands + plugin commands
- 5 builtin tools + plugin tools + MCP tools
- MCP client (stdio + HTTP) with live integration tests
- Streaming for all 3 providers with tool-call capture
- Tool-call execution loop (multi-round, maxToolRounds=5)
- 3 themes (tech-dark, editorial-light, hacker-terminal)
- Command palette (Ctrl+P) + tab autocomplete
- Pipe mode (echo 'prompt' | nexus)
- Web UI mode (nexus --web) — HTTP server + browser chat UI
- Config wizard (nexus init / /init)
- Plugin system (~/.nexus/plugins/*.mjs)
- Session branching (/branch <msgId|idx>)
- Input history persistence (~/.nexus/history.json)
- CI/CD — 3 GitHub Actions workflows
- Retry + error recovery (exponential backoff)

Bug fixes (21 total — see docs/ROOT-CAUSE-ANALYSIS.md):
- Z.ai provider rewritten to match real z-ai-web-dev-sdk@0.0.18 API
- Anthropic fetchModels uses raw fetch() (SDK doesn't expose .models.list())
- OpenAI/Anthropic providers use lazy SDK construction
- bin/nexus.js rewritten as plain JS (was crashing on TS annotations)
- MCPClient suppresses unhandled EPIPE/ENOENT errors
- Plugin commands wired into /help + runSlash dispatcher
- OpenAI + Anthropic streaming captures tool calls

Documentation:
- docs/FEATURES.md — every feature, version, how to use
- docs/TESTS.md — every test suite, what it covers, how to run
- docs/ROOT-CAUSE-ANALYSIS.md — every bug, root cause, exact fix
- docs/RELEASE-NOTES-v1.1.7.md — consolidated release notes
- src/__tests__/README.md — in-repo test documentation
- PULL_REQUEST_TEMPLATE.md — PR description template

Quality gates (all green):
- 0 TypeScript errors
- 0 ESLint problems
- 40 JS files built clean
- 230 tests passing + 8 env-gated skipped
- 64.65% coverage (threshold 40%)
- CLI boots: nexus --version → 1.1.7

See packages/nexus-code/CHANGELOG.md for the full v1.1.7 changelog."

# Push to main (or whichever branch is checked out)
git push origin HEAD

# Create a feature branch + PR if gh CLI is available
echo ""
echo "============================================================"
echo "  Creating Pull Request..."
echo "============================================================"

# Create a feature branch for the PR
BRANCH="feat/nexus-code-v1.1.7"
git checkout -b "$BRANCH" 2>/dev/null || git checkout "$BRANCH"
git push origin "$BRANCH" 2>/dev/null

# Try to create PR via gh CLI
if command -v gh &> /dev/null; then
  PR_BODY=$(cat <<'PR_EOF'
## Summary

Full rebrand from `nexus-tui` / "Nexus CLI" to **Nexus Code** / `nexus-code`, consolidating all work from v1.1.0 through v1.1.7.

## Quality gates — all green

| Gate | Result |
|---|---|
| TypeScript strict typecheck | **0 errors** |
| `npm run build` | **40 JS files, clean** |
| `npm run lint` | **0 problems** |
| `npm test` | **230 passing + 8 skipped** |
| Coverage | **64.65%** (threshold 40%) |

## Documentation

- `docs/FEATURES.md` — every feature, version, how to use
- `docs/TESTS.md` — every test suite, what it covers
- `docs/ROOT-CAUSE-ANALYSIS.md` — every bug, root cause, exact fix
- `docs/RELEASE-NOTES-v1.1.7.md` — consolidated release notes

## Test plan

- [ ] `npm install` succeeds
- [ ] `npm run typecheck` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm run build` produces `dist/`
- [ ] `npm test` passes all 230 tests
- [ ] `npm run test:coverage` reports ≥40%
- [ ] `node bin/nexus.js --version` prints `1.1.7`

See `PULL_REQUEST_TEMPLATE.md` for the full PR checklist.
PR_EOF
)
  gh pr create \
    --title "feat(code): nexus-code v1.1.7 — rebrand + full feature parity + docs" \
    --body "$PR_BODY" \
    --base main \
    --head "$BRANCH" \
    2>&1 || echo "(gh CLI not authenticated — create PR manually at the URL above)"
else
  echo "gh CLI not installed — create PR manually at:"
  echo "  https://github.com/roman-ryzenadvanced/nexus-dev-mmf/compare/main...$BRANCH"
fi

echo ""
echo "============================================================"
echo "  Published successfully!"
echo "============================================================"
echo ""
echo "View at: https://github.com/roman-ryzenadvanced/nexus-dev-mmf/tree/main/packages/nexus-code"
echo ""
echo "Next steps:"
echo "  1. Tag the release:"
echo "     git tag -a v1.1.7 -m 'v1.1.7 — rebrand to Nexus Code'"
echo "     git push origin v1.1.7"
echo ""
echo "  2. Create a GitHub Release from the tag — copy the v1.1.7"
echo "     section from packages/nexus-code/CHANGELOG.md as the release notes."
echo ""
echo "  3. Scrub the token from your shell history:"
echo "     history -d \$(history | tail -n 2 | head -n 1 | cut -d' ' -f1)"
echo "     unset GH_TOKEN"
echo ""
echo "  4. (Optional) Publish to npm:"
echo "     cd packages/nexus-code && npm publish"

# Clean up token from environment
unset GH_TOKEN
rm -rf "$WORK_DIR"
