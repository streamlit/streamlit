---
name: triaging-issues
description: Reproduce, triage, and optionally publish a GitHub issue end-to-end. Orchestrates the reproducing-issues skill (local-only investigation that prepares agent-wiki artifacts and result.json) and, after reviewing the verdict with the user, optionally the publishing-issue-repros skill to publish the repro through streamlit.wiki. Use when given a GitHub issue number or URL to take from investigation through verdict review to an optional live repro.
---

# Triaging issues (orchestrate)

Given a GitHub issue number or URL, run the end-to-end triage workflow: reproduce and
root-cause the bug, review the verdict, and — only with explicit confirmation — publish
a live repro through agent-wiki for discovery by issues.streamlit.app.

This skill orchestrates two focused skills so each can also be used on its own:

- [reproducing-issues](../reproducing-issues/SKILL.md) — the local-only, non-interactive
  **investigate** phase (prepares local agent-wiki artifacts and `result.json` without
  committing or pushing).
- [publishing-issue-repros](../publishing-issue-repros/SKILL.md) — the **publish** phase
  that commits and pushes the issue artifacts to streamlit.wiki.

The value this skill adds on top of those two is the **interactive glue** the investigate
phase deliberately leaves to the caller: reviewing the verdict and gating the publish
step on explicit confirmation.

## Workflow

1. **Investigate.** Follow the [reproducing-issues](../reproducing-issues/SKILL.md) skill
   for the issue (substitute the number directly as `<N>`; resolve a URL to its number
   first). It is non-interactive and prepares publishable artifacts under
   `agent-wiki/issues/<N>/`, with local evidence and `result.json` under
   `work-tmp/debug/gh-<N>/`.

2. **Review the verdict** in `result.json`, then act on it:
   - `insufficient_info` → summarize what's missing and ask the user whether to request
     more info from the reporter. Stop.
   - `cannot_reproduce` → report which versions were tested. The investigate phase still
     wrote a polished `repro_app.py`, so continue to step 3 and offer to publish it —
     deploying the repro lets the user open the live app and test the behavior.
   - `needs_human_review` → show the screenshots and findings and ask the user to confirm
     the bug before offering to publish.
   - `confirmed` → continue to step 3.

3. **Summarize** the outcome for the user: verdict, versions tested, root cause,
   recommended priority (with the one-line rationale from `investigation.md`), and the
   paths to the agent-wiki artifacts, local result, and screenshots.

4. **Ask whether to publish.** Only if the user confirms, follow the
   [publishing-issue-repros](../publishing-issue-repros/SKILL.md) skill for the
   **numeric** issue number from `result.json` (not the raw URL) to validate, commit,
   rebase, and push `agent-wiki/issues/<N>/` to wiki `master`. If the issue directory
   already exists on the wiki remote, tell the user it's a refresh and confirm before
   replacing it. Never publish without explicit confirmation.

5. **Report the published link:**
   `https://issues.streamlit.app/agent_wiki_explorer?file=issues/<N>/repro_app.py`.

## Related skills

- [reproducing-issues](../reproducing-issues/SKILL.md): the investigate phase this skill
  runs first.
- [publishing-issue-repros](../publishing-issue-repros/SKILL.md): the publish phase this
  skill runs last on confirmation.
- [debugging-streamlit](../debugging-streamlit/SKILL.md): `make debug` and Playwright
  patterns used during investigation.
