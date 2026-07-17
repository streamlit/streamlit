---
name: reproducing-issues
description: Investigate and reproduce a GitHub issue end-to-end — fetch the issue, build a minimal Streamlit app, verify the bug with Playwright across versions, root-cause it, and produce a self-contained repro bundle (app.py, NOTES.md, screenshots, result.json) in a staging directory. Read-only and non-interactive by design: it does not commit, push, or publish. Use when given a GitHub issue to reproduce, triage, or verify. To publish the resulting bundle to st-issues, use the publishing-issue-repros skill.
---

# Reproducing issues (investigate)

Given a GitHub issue number or URL, reproduce the bug, collect evidence, root-cause
it, and write a self-contained **repro bundle** to a staging directory.

This is the **investigate** phase only. It is deliberately **read-only** (no commits,
no pushes, no cross-repo writes) and **deterministic** (every decision resolves to a
verdict rather than pausing for input), so the same skill can run locally or in a
GitHub Actions job.

## Inputs

Inputs are read from environment variables so the same flow works locally and in CI.
Sensible local defaults are provided.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ISSUE` | yes | — | Issue number (e.g. `16003`) or full URL. |
| `OUT_DIR` | no | `work-tmp/debug` | Staging directory for the repro bundle and working files. |
| `REPORTED_VERSION` | no | parsed from issue | Streamlit version to confirm the bug on. |
| `STREAMLIT_APP_URL` | no | see Step 3 | URL the Playwright script connects to. |

If `ISSUE` is not set, the invoking caller (command or workflow) is expected to pass
the issue as an argument; resolve it to a number `<N>` before proceeding.

## Outputs

Everything is written under `$OUT_DIR/gh-<N>/`. Nothing is written outside this
directory or to any remote.

| File | Description |
|------|-------------|
| `result.json` | Machine-readable verdict and metadata (schema below) — the source of truth. |
| `app.py` | Polished, self-contained repro app ready to publish to st-issues. |
| `NOTES.md` | Investigation notes for maintainers (root cause, classification, priority). |
| `requirements.txt` | Only if the repro needs packages outside st-issues' base env. |
| `*.png` | Screenshots captured as evidence. |
| `repro_gh_<N>.py`, `verify_gh_<N>.py` | Minimal app and Playwright script used during verification. |

### `result.json` schema

```json
{
  "issue": 16003,
  "verdict": "confirmed",
  "reported_version": "1.59.0",
  "versions_tested": ["1.59.0", "1.58.0", "develop"],
  "introducing_commit": null,
  "root_cause": "One-line summary of the cause, or null if unknown.",
  "code_pointers": ["frontend/lib/src/components/shared/Dropdown/Selectbox.tsx:486"],
  "priority": "P2",
  "priority_rationale": "One sentence grounded in wiki/issue-prioritization.md.",
  "confidence": "high",
  "artifacts": {
    "app": "app.py",
    "notes": "NOTES.md",
    "screenshots": ["ape.png", "aple.png"]
  }
}
```

`verdict` is one of: `confirmed`, `cannot_reproduce`, `needs_human_review`,
`insufficient_info`. `confidence` is one of `high`, `medium`, `low`.

## Prerequisites

- `gh` CLI authenticated with access to `streamlit/streamlit`
- Streamlit dev environment set up (`make debug` works) if testing the `develop` build
- `uv` available for throwaway environments (released-version testing)

## Workflow

### Step 1: Fetch & analyze the issue

```bash
gh issue view <N> --repo streamlit/streamlit --json number,title,body,comments,labels,author
```

Extract: code snippets, steps to reproduce, expected vs. actual behavior, environment
(Streamlit/Python/OS/browser), and any error messages.

**Decision gate (non-interactive):**
- Has code or a clear enough description to infer code → proceed to Step 2.
- Too vague / missing critical info → write `result.json` with `verdict:
  insufficient_info`, note what's missing, and stop. Do not ask for input.

### Step 2: Build a minimal repro app

Write `$OUT_DIR/gh-<N>/repro_gh_<N>.py` — the smallest app that triggers the reported
behavior. See [reference.md](reference.md) for the template.

- Self-contained, minimal, and clearly labeled (`st.write`/`st.header`).
- If the reporter's snippet works as-is, use it directly with light cleanup.

Validate syntax:
```bash
python -m py_compile "$OUT_DIR/gh-<N>/repro_gh_<N>.py"
```

### Step 3: Verify with Playwright

Run the repro app and verify the bug programmatically.

**Which version to test:** always confirm on the reporter's `REPORTED_VERSION` at
minimum — do not let the current dev build stand in for it. Prefer testing a
**released wheel** in a throwaway environment, which behaves identically locally and in
CI and avoids protobuf-version mismatches:

```bash
uv venv /tmp/st-<version> --python 3.13
uv pip install --python /tmp/st-<version>/bin/python "streamlit==<version>"
/tmp/st-<version>/bin/streamlit run "$OUT_DIR/gh-<N>/repro_gh_<N>.py" \
  --server.port 8600 --server.headless true
```

For **regressions**, also test the last-working release to bracket the range.

**App URL:** point Playwright at the server via `STREAMLIT_APP_URL`. Default to
`http://localhost:8600` for a released wheel, or `http://localhost:3001` when using
`make debug` for the `develop` build.

Write `$OUT_DIR/gh-<N>/verify_gh_<N>.py` — a standalone script that navigates to the
app, drives the widgets to trigger the bug, screenshots evidence, and asserts expected
vs. actual (assertions FAIL when the bug exists). See [reference.md](reference.md). When
testing a released wheel, keep the script self-contained (no `streamlit` or
`e2e_playwright` imports).

Run it:
```bash
OUT_DIR="${OUT_DIR:-work-tmp/debug}" \
STREAMLIT_APP_URL="${STREAMLIT_APP_URL:-http://localhost:8600}" \
PYTHONPATH=. uv run python "$OUT_DIR/gh-<N>/verify_gh_<N>.py"
```

### Step 4: Interpret results → verdict

| Result | `verdict` |
|--------|-----------|
| Assertion failed + screenshot shows bug | `confirmed` |
| Assertion passed, no bug on the reported version | `cannot_reproduce` |
| Bug is purely visual (styling/animation) | `needs_human_review` |
| Script errors / inconclusive | fix the script and retry; if still stuck, `needs_human_review` |

For `cannot_reproduce`: confirm you tested `REPORTED_VERSION`, not just `develop`. A bug
that reproduces on the reported version but not on `develop` is **already fixed** —
record the fixing release/commit in `NOTES.md`.

### Step 5: Produce the repro bundle

For every verdict except `insufficient_info` (which stops at Step 1), write the
publish-ready files **into `$OUT_DIR/gh-<N>/`**.

- `app.py` — polished, self-contained app with Expected/Actual sections, workaround,
  and environment info. See [reference.md](reference.md). For `cannot_reproduce`, frame
  it around the reported behavior and note the agent could not trigger the bug (and on
  which versions).
- `NOTES.md` — findings, root cause with code pointers, and classification. See
  [reference.md](reference.md).
- `requirements.txt` — only for packages outside st-issues' base environment.

For **priority** in `NOTES.md`, read `wiki/issue-prioritization.md` first, then
recommend a level (P0–P3 or Won't Fix) grounded in its criteria — not an ad-hoc
judgment. In particular, measure reach by the *broken behavior*, not the affected
surface.

Validate:
```bash
python -m py_compile "$OUT_DIR/gh-<N>/app.py"
```

### Step 6: Write result.json

Write `$OUT_DIR/gh-<N>/result.json` using the schema above. This is the machine-readable
summary the caller (command or workflow post-job) consumes to decide whether and how to
publish.

## Handling edge cases

- **Feature request, not a bug:** stop after Step 1 with `verdict: insufficient_info`
  and a note that it is an enhancement.
- **Version-specific bug:** confirm on the reported version, then bracket adjacent
  releases.
- **Needs specific data/services:** synthesize data that triggers the same behavior; if
  impossible, note it as a limitation and set `verdict: needs_human_review`.
- **Frontend (TS/React) bug:** the repro app still demonstrates it through the Python
  API; use Playwright to verify DOM/visual state.

## Related skills

- [publishing-issue-repros](../publishing-issue-repros/SKILL.md): publish the bundle to
  st-issues.
- [debugging-streamlit](../debugging-streamlit/SKILL.md): `make debug` and Playwright
  patterns.
- [fixing-flaky-e2e-tests](../fixing-flaky-e2e-tests/SKILL.md): Playwright best
  practices and utilities.
