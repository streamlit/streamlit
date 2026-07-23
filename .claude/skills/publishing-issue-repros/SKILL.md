---
name: publishing-issue-repros
description: Publish a reproduction bundle produced by the reproducing-issues skill to the st-issues repo so it deploys to issues.streamlit.app. Copies app.py, NOTES.md, and any requirements.txt into st-issues/issues/gh-<N>/, validates them, commits, and pushes to main. Use after investigating an issue when the bundle has a working repro app ready to share.
---

# Publishing issue repros

Takes a **repro bundle** produced by the `reproducing-issues` skill (in
`$OUT_DIR/gh-<N>/`) and publishes it to the `st-issues` repo, which auto-deploys to
`https://issues.streamlit.app/?issue=gh-<N>`.

This is the **publish** phase — it performs writes. Keep it separate from investigation
so the read-only investigate phase can run anywhere (including CI). Run it once the
investigate phase has produced a working `app.py` in the bundle; any verdict is
publishable, but record it in the commit message.

## Inputs

This skill runs locally. Substitute the issue number directly as `<N>` in the commands
below (numeric only — normalize a URL to its number first). `OUT_DIR` and
`ST_ISSUES_DIR` are optional paths with the defaults shown.

| Input | Required | Default | Description |
|----------|----------|---------|-------------|
| `<N>` | yes | — | Issue number (numeric only). |
| `OUT_DIR` | no | `work-tmp/debug` | Where the bundle was written by the investigate phase. |
| `ST_ISSUES_DIR` | no | `~/dev/st-issues` | Local st-issues checkout to publish into. |

The bundle at `$OUT_DIR/gh-<N>/` must contain at least `app.py`, `NOTES.md`, and
`result.json`.

## Preconditions

Before publishing, confirm:
- `app.py` exists and compiles: `python -m py_compile "${OUT_DIR:-work-tmp/debug}/gh-<N>/app.py"`.
- `result.json` exists. Any verdict can be published — record it in the commit message
  so reviewers know the bundle's status.

If `issues/gh-<N>/` already exists in st-issues, this is a **refresh** rather than a new
repro — proceed, but say so in the commit message.

## Publish

```bash
set -e  # stop on any failure so we never commit a partial or empty bundle

SRC="${OUT_DIR:-work-tmp/debug}/gh-<N>"
DEST="${ST_ISSUES_DIR:-$HOME/dev/st-issues}/issues/gh-<N>"

# The investigate phase must have produced these — bail out if any are missing:
[ -f "$SRC/app.py" ] || { echo "Error: $SRC/app.py not found"; exit 1; }
[ -f "$SRC/NOTES.md" ] || { echo "Error: $SRC/NOTES.md not found"; exit 1; }
[ -f "$SRC/result.json" ] || { echo "Error: $SRC/result.json not found"; exit 1; }

# "Add" for a new repro, "Refresh" if the destination already exists — capture
# this before mkdir so the commit message reflects it:
VERB="Add"; [ -d "$DEST" ] && VERB="Refresh"
mkdir -p "$DEST"
cp "$SRC/app.py" "$SRC/NOTES.md" "$DEST/"
if [ -f "$SRC/requirements.txt" ]; then
  cp "$SRC/requirements.txt" "$DEST/"
else
  rm -f "$DEST/requirements.txt"  # drop stale deps when refreshing
fi

# Record the bundle's verdict from result.json so reviewers see the status:
VERDICT=$(python -c "import json,sys; print(json.load(open(sys.argv[1]))['verdict'])" "$SRC/result.json")

cd "${ST_ISSUES_DIR:-$HOME/dev/st-issues}"
python -m py_compile "issues/gh-<N>/app.py"
git add "issues/gh-<N>/"
git commit -m "$VERB reproduction for issue #<N>: <Short Title> (verdict: $VERDICT)"
git push origin main
```

The app deploys automatically to `https://issues.streamlit.app/?issue=gh-<N>` within
2–5 minutes.

## Related skills

- [reproducing-issues](../reproducing-issues/SKILL.md): produces the bundle this skill
  publishes.
- [creating-pull-requests](../creating-pull-requests/SKILL.md): PR conventions if
  opening a PR for the repro.
