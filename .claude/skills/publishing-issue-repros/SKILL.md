---
name: publishing-issue-repros
description: Publishes issue reproduction artifacts produced by the reproducing-issues skill to streamlit.wiki so issues.streamlit.app can discover them. Validates the canonical agent-wiki issue files, commits only that issue directory, rebases, and pushes wiki master. Use after investigating an issue when its local artifacts are ready to share.
---

# Publishing issue repros

Publishes the artifacts prepared by the `reproducing-issues` skill in
`agent-wiki/issues/<N>/`. The st-issues app discovers
`issues/<N>/repro_app.py` from streamlit.wiki and exposes it through
issues.streamlit.app.

This is the **publish** phase — it commits and pushes to a public repository. Keep it
separate from investigation, validate the files first, and run it only after the user
has explicitly confirmed publication.

## Inputs

Substitute the numeric issue number directly as `<N>` in the commands below. Normalize
a GitHub URL to its number first.

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `<N>` | yes | — | Numeric GitHub issue number. |
| `AGENT_WIKI_DIR` | no | `agent-wiki` | Local streamlit.wiki checkout containing the prepared artifacts. |
| `OUT_DIR` | no | `work-tmp/debug` | Local-only directory containing `result.json`. |

## Preconditions

Before publishing:

- Read and follow `${AGENT_WIKI_DIR:-agent-wiki}/AGENTS.md`.
- Confirm `issues/<N>/repro_app.py`, `repro_app_verify.py`, and `investigation.md`
  exist.
- Confirm `${OUT_DIR:-work-tmp/debug}/gh-<N>/result.json` exists.
- Review every file in `issues/<N>/`. The wiki is public; do not publish secrets,
  private data, internal-only discussion, screenshots, logs, `result.json`, or other
  generated output.
- If the issue directory already exists on `origin/master`, tell the user this is a
  refresh and confirm before replacing it.

## Publish

```bash
set -e

WIKI="${AGENT_WIKI_DIR:-agent-wiki}"
ISSUE_DIR="issues/<N>"
RESULT="${OUT_DIR:-work-tmp/debug}/gh-<N>/result.json"

[ -d "$WIKI/.git" ] || {
  echo "Error: $WIKI is not an agent-wiki checkout"
  exit 1
}
[ -f "$WIKI/$ISSUE_DIR/repro_app.py" ] || {
  echo "Error: $WIKI/$ISSUE_DIR/repro_app.py not found"
  exit 1
}
[ -f "$WIKI/$ISSUE_DIR/repro_app_verify.py" ] || {
  echo "Error: $WIKI/$ISSUE_DIR/repro_app_verify.py not found"
  exit 1
}
[ -f "$WIKI/$ISSUE_DIR/investigation.md" ] || {
  echo "Error: $WIKI/$ISSUE_DIR/investigation.md not found"
  exit 1
}
[ -f "$RESULT" ] || {
  echo "Error: $RESULT not found"
  exit 1
}

uv run python -m py_compile \
  "$WIKI/$ISSUE_DIR/repro_app.py" \
  "$WIKI/$ISSUE_DIR/repro_app_verify.py"

VERDICT=$(uv run python -c \
  "import json,sys; print(json.load(open(sys.argv[1]))['verdict'])" "$RESULT")

(
  cd "$WIKI"
  git checkout master
  git fetch origin master

  VERB="Add"
  if git cat-file -e "origin/master:$ISSUE_DIR/repro_app.py" 2>/dev/null; then
    VERB="Refresh"
  fi

  git add -- "$ISSUE_DIR"
  git diff --cached --quiet -- "$ISSUE_DIR" && {
    echo "Error: no issue artifacts changed"
    exit 1
  }

  # --only prevents unrelated files already staged in the wiki checkout from
  # being included in this commit.
  git commit --only \
    -m "$VERB reproduction for issue #<N> (verdict: $VERDICT)" \
    -- "$ISSUE_DIR"
  git pull --rebase origin master
  git push origin master
)
```

Never force-push the wiki. If a concurrent update causes the push to fail, run
`git pull --rebase origin master` inside the wiki checkout and retry the normal push.

## Result

The published app is available at:

```text
https://issues.streamlit.app/agent_wiki_explorer?file=issues/<N>/repro_app.py
```

The issue explorer also discovers the wiki reproduction automatically. A curated
`st-issues/issues/gh-<N>/app.py` takes precedence if one exists.

## Related skills

- [triaging-issues](../triaging-issues/SKILL.md): orchestrates investigation, verdict
  review, and this publish phase end-to-end.
- [reproducing-issues](../reproducing-issues/SKILL.md): prepares the issue artifacts
  and local evidence.
- [sharing-pr-agent-artifacts](../sharing-pr-agent-artifacts/SKILL.md): uses the same
  wiki repository for PR-related documents.
