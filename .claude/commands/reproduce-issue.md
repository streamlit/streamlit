---
description: Reproduce a GitHub issue locally, then optionally publish the repro to st-issues
---

Reproduce GitHub issue **$ARGUMENTS** end-to-end for local triage.

This command orchestrates two skills. Run them in order:

1. **Investigate** — follow the `reproducing-issues` skill with `ISSUE=$ARGUMENTS`.
   Use the local default (`OUT_DIR=work-tmp/debug`). The skill is non-interactive and
   writes a repro bundle to `work-tmp/debug/gh-<N>/`, including `result.json`.

2. **Review the verdict** in `result.json`, then act based on it (this is the
   interactive part the skill deliberately leaves to the caller):
   - `insufficient_info` → summarize what's missing and ask me whether to request more
     info from the reporter. Stop.
   - `cannot_reproduce` → report which versions were tested. The investigate phase
     still wrote a polished `app.py`, so continue to step 3 and offer to publish it —
     deploying the repro lets me open the live app and test the behavior myself.
   - `needs_human_review` → show the screenshots and findings and ask me to confirm the
     bug before offering to publish.
   - `confirmed` → continue to step 3.

3. **Summarize** the outcome for me: verdict, versions tested, root cause, recommended
   priority (with the one-line rationale from `NOTES.md`), and the paths to the bundle
   and screenshots.

4. **Ask whether to publish.** Only if I confirm, follow the `publishing-issue-repros`
   skill with `ISSUE` set to the **numeric** issue number from `result.json` (not the
   raw URL, so the `gh-<N>` paths resolve correctly), plus the same
   `OUT_DIR`/`ST_ISSUES_DIR`, to copy the bundle into st-issues, commit, and push. If a
   repro for this issue already exists there, tell me it's a refresh and confirm before
   overwriting. Never publish without my confirmation.
