---
name: creating-st-issues-app
description: Fetch a `streamlit/streamlit` GitHub issue (URL or number) and comments via the `gh` CLI, then extract the best repro code snippet into `../st-issues/issues/gh-<issue>/app.py`. Use when triaging Streamlit issues, creating local repro apps, or when given a Streamlit GitHub issue URL/number.
---

# Creating Streamlit GitHub issue repro

Create a local repro folder from a `streamlit/streamlit` GitHub issue by pulling the issue + comments via `gh`, extracting the most likely repro code, and writing it to `app.py`.

## Inputs

- Accept either:
  - A GitHub issue URL like `https://github.com/streamlit/streamlit/issues/12345`, or
  - A plain issue number like `12345`

Normalize to:

- `ISSUE_NUMBER`: the integer issue number
- `ISSUE_URL`: the canonical issue URL (useful to include as a comment header in `app.py`)

## Output location

Write into the sibling `st-issues` repo (must already exist next to this repo):

- `../st-issues/issues/gh-<ISSUE_NUMBER>/`

Write:

- `app.py` (the extracted repro)

## Workflow

### 0) Preflight: verify `st-issues` sibling repo exists

This skill assumes you have cloned `st-issues` as a sibling directory to `streamlit`:

```
<parent>/
  streamlit/   # this repo
  st-issues/   # required output location
```

If `../st-issues` does **not** exist (relative to the Streamlit repo root), **STOP** and tell the user to clone `st-issues` as a sibling to continue.

### 1) Extract the issue number

- If the input is a URL, parse the trailing number after `/issues/`.
- If it’s already a number, use it directly.

If the URL is not for `streamlit/streamlit`, do not proceed.

### 2) Fetch issue body + comments via `gh`

Some `gh` versions don’t support `gh issue view --comments-limit`, so prefer `gh api` for a reliable, paginated fetch.

```bash
# Issue (body + metadata)
ISSUE_JSON="$(gh api "repos/streamlit/streamlit/issues/$ISSUE_NUMBER" --jq '{
  number: .number,
  title: .title,
  url: .html_url,
  body: .body
}')"

# Comments (paginate until done)
COMMENTS_JSON="$(gh api "repos/streamlit/streamlit/issues/$ISSUE_NUMBER/comments" --paginate --jq '[
  .[] | {body: .body}
]')"
```

Notes:

- **`gh` must run outside any sandbox** (it may require your normal auth context).
- The output directory is **outside** this repo, inside the sibling `st-issues` repo. Prefer using fully-qualified paths derived from `git rev-parse --show-toplevel`.

### 3) Pick the best repro snippet

Scan the issue `body` and every comment `body` for fenced code blocks (triple backticks).

Build a candidate list from:

- **Python fenced blocks** (`python … `), and
- **Unlabeled fenced blocks** (`…`) if they look like Python/Streamlit code.

Pick the “best” candidate with these heuristics (in order):

- Prefer the first block containing **`import streamlit as st`**
- Otherwise prefer a block that **uses `st.`** (Streamlit API calls)
- Tie-breaker: pick the **largest** (most lines) candidate

Implementation notes for the AI agent:

- Extract fenced blocks with a regex like:
  - ````text
    ```(?P<lang>\w+)?\n(?P<code>[\s\S]*?)\n```
    ````
- Treat `lang` as optional; only accept:
  - `python`/`py` blocks, OR
  - unlabeled blocks that contain `import streamlit` or `st.` usage

### 4) Write `app.py`

Create the output directory (using a fully-qualified path):

- `<streamlit repo root>/../st-issues/issues/gh-<ISSUE_NUMBER>/` (resolve to an absolute path before writing)

Write `app.py` containing:

- A short header comment with the issue URL and title
- The extracted code block contents, without the surrounding fences

If the chosen snippet contains `st.` usage but **does not** include `import streamlit as st`, prepend that import line to make the repro runnable.

If **no repro code** is found:

- Create `app.py` with a TODO placeholder and include the issue URL so it’s easy to follow up.

## Example (end-to-end)

```bash
# From the Streamlit repo root:
ISSUE_NUMBER="12345"  # (parse from the URL)
STREAMLIT_ROOT="$(git rev-parse --show-toplevel)"
ST_ISSUES_ROOT="$STREAMLIT_ROOT/../st-issues"

if [ ! -d "$ST_ISSUES_ROOT" ]; then
  echo "Missing sibling repo: $ST_ISSUES_ROOT"
  echo "Clone st-issues as a sibling to streamlit, then re-run."
  exit 1
fi

OUT_DIR="$(cd "$ST_ISSUES_ROOT" && pwd)/issues/gh-$ISSUE_NUMBER"

mkdir -p "$OUT_DIR"

ISSUE_JSON="$(gh api "repos/streamlit/streamlit/issues/$ISSUE_NUMBER" --jq '{
  number: .number,
  title: .title,
  url: .html_url,
  body: .body
}')"

COMMENTS_JSON="$(gh api "repos/streamlit/streamlit/issues/$ISSUE_NUMBER/comments" --paginate --jq '[
  .[] | {body: .body}
]')"

# Then extract the best repro snippet and write:
#   "$OUT_DIR/app.py"
```
