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

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ISSUE` | yes | — | Issue number `<N>` (numeric only — normalize a URL to its number first). |
| `OUT_DIR` | no | `work-tmp/debug` | Where the bundle was written by the investigate phase. |
| `ST_ISSUES_DIR` | no | `~/dev/st-issues` | Local st-issues checkout to publish into. |

The bundle at `$OUT_DIR/gh-<N>/` must contain at least `app.py`, `NOTES.md`, and
`result.json`.

## Preconditions

Before publishing, confirm:
- `app.py` exists and compiles: `python -m py_compile "$OUT_DIR/gh-<N>/app.py"`.
- `result.json` exists. Any verdict can be published — record it in the commit message
  so reviewers know the bundle's status.

If `issues/gh-<N>/` already exists in st-issues, this is a **refresh** rather than a new
repro — proceed, but say so in the commit message.

## Publish

```bash
N="${ISSUE}"
SRC="${OUT_DIR:-work-tmp/debug}/gh-${N}"
DEST="${ST_ISSUES_DIR:-$HOME/dev/st-issues}/issues/gh-${N}"

[ -d "$DEST" ] && echo "Refreshing existing repro for gh-${N}"
mkdir -p "$DEST"
cp "$SRC/app.py" "$SRC/NOTES.md" "$DEST/"
if [ -f "$SRC/requirements.txt" ]; then
  cp "$SRC/requirements.txt" "$DEST/"
else
  rm -f "$DEST/requirements.txt"  # drop stale deps when refreshing
fi

cd "${ST_ISSUES_DIR:-$HOME/dev/st-issues}"
python -m py_compile "issues/gh-${N}/app.py"
git add "issues/gh-${N}/"
git commit -m "Add reproduction for issue #${N}: <Short Title>"
git push origin main
```

The app deploys automatically to `https://issues.streamlit.app/?issue=gh-<N>` within
2–5 minutes.

## Related skills

- [reproducing-issues](../reproducing-issues/SKILL.md): produces the bundle this skill
  publishes.
- [creating-pull-requests](../creating-pull-requests/SKILL.md): PR conventions if
  opening a PR for the repro.
