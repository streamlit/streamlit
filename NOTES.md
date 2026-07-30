# Investigation: reproduce #12514 immediately before fix #16171

**Issue:** [#12514](https://github.com/streamlit/streamlit/issues/12514) — "Fragments within container disappearing on rerender"
**Fix PR:** [#16171](https://github.com/streamlit/streamlit/pull/16171) — "[fix] Preserve fragment children across container reruns"
**Pre-fix commit (primary target):** `82765622d32f1198218d8556c0c68e695a8c4c8e` (parent of the fix merge)
**Fix commit:** `e6a40f8bd8069228db5480197807be883805866d`

## Verdict

**Confirmed — the bug was still present immediately before David Byttow's fix.**
On `82765622…`, after the parent fragment reruns, sibling nested fragment `b(1)`'s
markdown `1` disappears (it is clobbered by `b(2)`); on the fix commit `e6a40f8…`
both `1` and `2` survive.

## Environment constraint (why this is a backend delta-level repro, not a browser repro)

This VM has **restricted network egress**: only `github.com` is reachable. `pypi.org`,
`files.pythonhosted.org`, `registry.npmjs.org`, and `registry.yarnpkg.com` are all
blocked (connection reset). Consequently neither `make frontend-fast` (needs npm/yarn
packages) nor a fresh `uv sync` could complete, so a full Playwright browser repro was
not possible here.

Instead I reconstructed a working **backend** Streamlit environment from the pre-populated
`~/.cache/uv` archive (which already contained unpacked wheels for numpy/pandas/protobuf/
starlette/etc.), hardlinked those packages into `.venv`, generated the Python protobufs with
the system `protoc` (`libprotoc 3.21.12`, ≥ `MIN_PROTOC_VERSION 3.20`), and ran Streamlit's
real `ScriptRunner` directly against the pre-fix source tree (via `PYTHONPATH=lib`).

This is appropriate because **the fix is 100% backend Python** (`lib/streamlit/runtime/fragment.py`
only). The bug is a fragment-id / cursor bookkeeping collision that manifests in the
`ForwardMsg` delta stream (two siblings writing to the same `delta_path`), so it is fully
observable at the backend/delta level without rendering in a browser.

## Why `AppTest` alone does NOT reproduce it

`AppTest.run()` always issues a **full** script rerun (`fragment_ids_this_run = None`).
I verified this by instrumenting the app (`work-tmp/ctx_log.txt` showed `fragment_ids_this_run=None`
on both the initial run and the post-button-click run). The buggy branch in `fragment.py`
(the snapshot restore guarded by `if ctx.fragment_ids_this_run:`) only executes during a
**fragment-scoped** rerun, which `AppTest` never triggers. So a naive `AppTest` button click
shows both `1` and `2` even on the pre-fix tree — it simply does not exercise the bug.

## Faithful reproduction

A live Streamlit server keeps one `MemoryFragmentStorage` on the `AppSession` across script
runs. When a button *inside* fragment `a` is clicked, it issues `RerunData(fragment_id_queue=[<a's id>])`;
the `ScriptRunner` then does **not** run the whole script — it looks up `a`'s registered
`wrapped_fragment` and runs it, which calls `b(1)`/`b(2)` inline via the fragment `wrap`.

The driver `repro_12514/drive_fragment_rerun.py` replicates exactly this with two
`LocalScriptRunner`s that share one fragment storage + session state:

1. A normal full run to register fragments `a`, `b(1)`, `b(2)`.
2. A fragment-scoped rerun of `a` (`fragment_id_queue=[a_id]`) — the button click.

The app under test (`repro_12514/repro_app.py`) is the issue's exact minimal repro (plus one
line that records `a`'s fragment id). The unmodified issue snippet is at
`repro_12514/issue_repro_app.py`.

### Result — PRE-FIX `82765622…` (bug reproduces)

```
INITIAL markdown deltas:    ['[0, 0, 1, 0, 0]=1', '[0, 0, 1, 1, 0]=2']
AFTER-rerun markdown deltas: ['[0, 0, 1, 0, 0]=2']
AFTER-rerun markdown tree values: ['2']
BUG_PRESENT: True
```

Initially the two siblings occupy distinct delta paths `[0,0,1,0,0]` (=`1`) and
`[0,0,1,1,0]` (=`2`). After the fragment rerun, only a single markdown remains, and it sits
at `[0,0,1,0,0]` with value `2`: the container cursor never advanced between the sibling
`with container: b(i)` calls, so `b(2)` overwrote `b(1)`'s delta and `1` disappeared —
exactly the disappearance reported in #12514.

### Result — FIX `e6a40f8…` (bug gone)

```
INITIAL markdown deltas:    ['[0, 0, 1, 0, 0]=1', '[0, 0, 1, 1, 0]=2']
AFTER-rerun markdown deltas: ['[0, 0, 1, 0, 0]=1', '[0, 0, 1, 1, 0]=2']
AFTER-rerun markdown tree values: ['1', '2']
BUG_PRESENT: False
```

Both siblings keep their distinct delta paths after the fragment rerun; `1` and `2` both
survive.

## Confirmation of pre-fix tree identity

- `git rev-parse e6a40f8bd8069228db5480197807be883805866d^` → `82765622d32f1198218d8556c0c68e695a8c4c8e` (pre-fix is the merge parent).
- `grep is_queued_toplevel_rerun lib/streamlit/runtime/fragment.py` on `82765622…` → **not found** (the fix's sentinel is absent); the pre-fix restore guard is the broad `if ctx.fragment_ids_this_run:` at line 505.

## Commands run (abridged)

```bash
git checkout 82765622d32f1198218d8556c0c68e695a8c4c8e
protoc --proto_path=proto --python_out=lib proto/streamlit/proto/*.proto
PYTHONPATH=lib .venv/bin/python repro_12514/drive_fragment_rerun.py   # -> BUG_PRESENT: True
git checkout e6a40f8bd8069228db5480197807be883805866d
protoc --proto_path=proto --python_out=lib proto/streamlit/proto/*.proto
PYTHONPATH=lib .venv/bin/python repro_12514/drive_fragment_rerun.py   # -> BUG_PRESENT: False
```

## Artifacts (repo root)

- `repro_12514_evidence.png` — before/after visual comparison of pre-fix vs fixed.
- `repro_12514/repro_app.py` — instrumented issue repro app (captures `a`'s fragment id).
- `repro_12514/issue_repro_app.py` — the issue's exact snippet, unmodified.
- `repro_12514/drive_fragment_rerun.py` — the driver that issues the fragment-scoped rerun.
- `repro_12514/prefix_output.txt` — raw console output on `82765622…` (bug present).
- `repro_12514/fix_output.txt` — raw console output on `e6a40f8…` (bug gone).

## One-line confirmation

Issue #12514 was still present immediately before #16171: on pre-fix commit
`82765622d32f1198218d8556c0c68e695a8c4c8e`, a fragment-scoped rerun of the parent fragment
clobbers sibling `b(1)`'s markdown `1`, and the fix commit `e6a40f8…` preserves both.
