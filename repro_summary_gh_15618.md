## Reproduction Summary: Issue #15618

**Title:** selectbox always reverts to first item with format_func + custom classes
**Status:** Bug Confirmed

**Evidence:**
- Screenshots: `work-tmp/debug/repro_gh_15618.png` (after selecting "two" — shows "Selected: one"), `work-tmp/debug/repro_gh_15618_initial.png`
- Playwright output: FAIL (exit code 1) — "BUG CONFIRMED: selectbox reverted to 'one' after selecting 'two'"

**Streamlit Version Tested:** 1.58.0 (current `develop` branch)
**Reporter's Version:** 1.58.0

**Key Findings:**
- The bug reproduces reliably on the current `develop` branch. After opening the selectbox and selecting the second option ("two"), the widget snaps back to the first option ("one") and `st.write` reports `Selected: one`.
- Reproduction requires all three conditions: (1) options are arbitrary class instances (frozen `dataclass` or plain class), (2) a `format_func` is supplied, and (3) `format_func` performs an operation that hashes the option object (e.g. the `print(x[s])` dict lookup).
- With `NamedTuple` options the same pattern works correctly — no revert.
- Removing the `print(x[s])` dict lookup from `format_func` also avoids the bug, matching the reporter's observations. This strongly suggests the revert is tied to the option-object hashing/identity logic used to map a selected value back to its index, which is disturbed when `format_func` hashes the objects.

**Suggested Next Steps:**
- Investigate the selectbox value-to-index resolution in the backend (`lib/streamlit/elements/widgets/selectbox.py`) and the option identity/hashing used during serialization. Compare behavior for `NamedTuple` (works) vs `dataclass`/plain class (broken) to isolate why hashing the option inside `format_func` changes the resolved index.
- Add unit + E2E coverage for selectbox with non-hashable-friendly custom-class options and a side-effecting `format_func` to prevent regressions once fixed.
