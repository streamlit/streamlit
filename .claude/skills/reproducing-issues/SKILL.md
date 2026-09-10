---
name: reproducing-issues
description: Investigate and reproduce a GitHub issue end-to-end — fetch the issue, build a canonical repro app in agent-wiki, verify the bug with Playwright across versions, root-cause it, and record local evidence and a machine-readable verdict. Local-only and non-interactive by design: it does not commit, push, or publish. Use when given a GitHub issue to reproduce, triage, or verify. To publish the resulting artifacts, use the publishing-issue-repros skill.
---

# Reproducing issues (investigate)

Given a GitHub issue number or URL, reproduce the bug, collect evidence, root-cause
it, and prepare publishable issue artifacts in the local agent-wiki checkout.

This is the **investigate** phase only. It is deliberately **local-only** (no commits
or pushes) and **deterministic** (every decision resolves to a verdict rather than
pausing for input), so the same skill can run locally or in a GitHub Actions job.

For running apps and driving Playwright, this skill builds on the
[debugging-streamlit](../debugging-streamlit/SKILL.md) skill — see it for `make debug`,
the Playwright script template, and the `e2e_playwright` helpers referenced below.

## Inputs

Locally, the agent already knows which issue it's working on — substitute the number
directly as `<N>` in the commands below (resolve a URL to its number first). Don't rely
on a persisted or exported `ISSUE`. In CI, a workflow provides these as environment
variables instead. Either way, the defaults below apply when a value isn't given.

| Input | Required | Default | Description |
|----------|----------|---------|-------------|
| `<N>` (`ISSUE` in CI) | yes | — | Issue number (e.g. `16003`) or full URL — resolve a URL to its number first. |
| `OUT_DIR` | no | `work-tmp/debug` | Local-only directory for screenshots, logs, and `result.json`. |
| `AGENT_WIKI_DIR` | no | `agent-wiki` | Local checkout of `streamlit/streamlit.wiki`. |
| `REPORTED_VERSION` | no | parsed from issue | Streamlit version to confirm the bug on. |
| `STREAMLIT_APP_URL` | no | see Step 3 | URL the Playwright script connects to. |

## Outputs

Publishable artifacts are written under `$AGENT_WIKI_DIR/issues/<N>/`, following the
wiki's canonical issue layout. Generated evidence stays under `$OUT_DIR/gh-<N>/`.
Nothing is committed or pushed.

| File | Description |
|------|-------------|
| `agent-wiki/issues/<N>/repro_app.py` | Canonical, self-contained app used for verification and publication. |
| `agent-wiki/issues/<N>/repro_app_verify.py` | Canonical Playwright companion script. |
| `agent-wiki/issues/<N>/investigation.md` | Findings, root cause, classification, and priority. |
| `work-tmp/debug/gh-<N>/result.json` | Machine-readable verdict and metadata — the source of truth. |
| `work-tmp/debug/gh-<N>/*.png` | Local-only screenshots captured as evidence. |

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
    "app": "agent-wiki/issues/16003/repro_app.py",
    "notes": "agent-wiki/issues/16003/investigation.md",
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
- Git access to the public `streamlit/streamlit.wiki` repository

## Workflow

### Step 1: Fetch & analyze the issue

```bash
gh issue view <N> --repo streamlit/streamlit --json number,title,body,comments,labels,author
mkdir -p "${OUT_DIR:-work-tmp/debug}/gh-<N>"
```

Extract: code snippets, steps to reproduce, expected vs. actual behavior, environment
(Streamlit/Python/OS/browser), and any error messages.

**Decision gate (non-interactive):**
- Has code or a clear enough description to infer code → proceed to Step 2.
- Too vague / missing critical info → write
  `${OUT_DIR:-work-tmp/debug}/gh-<N>/result.json` with `verdict:
  insufficient_info`, note what's missing, and stop. Do not ask for input.

### Step 2: Set up agent-wiki and build the repro app

Prepare the local wiki checkout before creating artifacts:

```bash
if [ -d "${AGENT_WIKI_DIR:-agent-wiki}/.git" ]; then
  (
    cd "${AGENT_WIKI_DIR:-agent-wiki}"
    git checkout master
    git pull --rebase origin master
  )
else
  git clone https://github.com/streamlit/streamlit.wiki.git \
    "${AGENT_WIKI_DIR:-agent-wiki}"
fi
```

Read `${AGENT_WIKI_DIR:-agent-wiki}/AGENTS.md` and follow its issue-artifact rules.
The wiki is public: never include secrets, private data, internal-only discussion,
debug logs, or generated test output.

Create `${AGENT_WIKI_DIR:-agent-wiki}/issues/<N>/repro_app.py` — the smallest
self-contained app that triggers the reported behavior. This one canonical app is
both the app under test and the publishable app. See [reference.md](reference.md).

- Self-contained, minimal, and clearly labeled (`st.write`/`st.header`).
- If the reporter's snippet works as-is, use it directly with light cleanup.
- Use only Streamlit's required or optional dependencies; do not add a per-issue
  `requirements.txt`.

Validate syntax:
```bash
uv run python -m py_compile \
  "${AGENT_WIKI_DIR:-agent-wiki}/issues/<N>/repro_app.py"
```

### Step 3: Verify with Playwright

Verify the bug programmatically with a Playwright script. This reuses the Playwright
patterns from the [debugging-streamlit](../debugging-streamlit/SKILL.md) skill — see it
for the script template, the `e2e_playwright` helpers, and screenshot tips. Only the
reproduction-specific parts are covered here and in [reference.md](reference.md).

**Which version to test:** always confirm on the reporter's `REPORTED_VERSION` at
minimum — do not let the current dev build stand in for it. Prefer testing a
**released wheel** in a throwaway environment, which behaves identically locally and in
CI and avoids protobuf-version mismatches. For **regressions**, also test the
last-working release to bracket the range.

Start the app server first — run it in a background task so the shell is free for the
Playwright script:

```bash
uv venv /tmp/st-<version> --python 3.13
uv pip install --python /tmp/st-<version>/bin/python "streamlit==<version>"
/tmp/st-<version>/bin/streamlit run \
  "${AGENT_WIKI_DIR:-agent-wiki}/issues/<N>/repro_app.py" \
  --server.port 8600 --server.headless true
```

**App URL:** point Playwright at the server via `STREAMLIT_APP_URL`. Default to
`http://localhost:8600` for a released wheel, or `http://localhost:3001` when using
`make debug` for the `develop` build.

Write `${AGENT_WIKI_DIR:-agent-wiki}/issues/<N>/repro_app_verify.py` — a script that
navigates to the app, drives the widgets to trigger the bug, screenshots evidence into
`${OUT_DIR:-work-tmp/debug}/gh-<N>/`, and asserts expected vs. actual (assertions FAIL
when the bug exists). See [reference.md](reference.md) for the template. Keep the
script portable and free of generated output. It runs in the repo's environment, so it
can import `e2e_playwright` helpers even when the app under test is a separately
installed released wheel.

Run it once the app server is up:
```bash
OUT_DIR="${OUT_DIR:-work-tmp/debug}" \
STREAMLIT_APP_URL="${STREAMLIT_APP_URL:-http://localhost:8600}" \
PYTHONPATH=. uv run python \
  "${AGENT_WIKI_DIR:-agent-wiki}/issues/<N>/repro_app_verify.py"
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
record the fixing release/commit in `investigation.md`.

### Step 5: Finalize the publishable artifacts

For every verdict except `insufficient_info` (which stops at Step 1), finalize these
files in `${AGENT_WIKI_DIR:-agent-wiki}/issues/<N>/`:

- `repro_app.py` — polish the same app used during verification. Include
  Expected/Actual sections, a workaround when available, environment information, and
  a link to the issue. For `cannot_reproduce`, explain which versions were tested.
- `repro_app_verify.py` — retain the portable verification script used in Step 3.
- `investigation.md` — record the finding, versions tested, root cause with code
  pointers, verification evidence, and classification. See [reference.md].

Do not add screenshots, logs, `result.json`, dependency files, or other generated
output to agent-wiki. Keep those under `${OUT_DIR:-work-tmp/debug}/gh-<N>/`.

For **priority** in `investigation.md`, read `wiki/issue-prioritization.md` first, then
recommend a level (P0–P4) grounded in its criteria — not an ad-hoc judgment. In
particular, measure reach by the *broken behavior*, not the affected surface.

Validate:
```bash
uv run python -m py_compile \
  "${AGENT_WIKI_DIR:-agent-wiki}/issues/<N>/repro_app.py" \
  "${AGENT_WIKI_DIR:-agent-wiki}/issues/<N>/repro_app_verify.py"
```

### Step 6: Write result.json

Write `${OUT_DIR:-work-tmp/debug}/gh-<N>/result.json` using the schema above. This is
the machine-readable summary the caller consumes to decide whether and how to publish.

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

- [triaging-issues](../triaging-issues/SKILL.md): orchestrates this investigate phase
  with verdict review and optional publishing.
- [publishing-issue-repros](../publishing-issue-repros/SKILL.md): publish the bundle to
  agent-wiki for discovery by issues.streamlit.app.
- [debugging-streamlit](../debugging-streamlit/SKILL.md): `make debug` and Playwright
  patterns.
- [fixing-flaky-e2e-tests](../fixing-flaky-e2e-tests/SKILL.md): Playwright best
  practices and utilities.
