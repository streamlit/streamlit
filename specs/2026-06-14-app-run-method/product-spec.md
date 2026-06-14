---
author: lukasmasuch
created: 2026-06-14
---

# Run an app as a plain Python script (`App.run()`)

## Summary

Add a `run()` method to `st.App` so a launcher module that defines an `st.App` instance
can be launched directly with `python app.py`, without `streamlit run app.py` or an
external ASGI server. The method starts the same embedded ASGI server runner that
`streamlit run` uses for ASGI apps, so `python app.py` and `streamlit run app.py` have
the same runtime behavior for `st.App` launcher modules.

> [!NOTE]
> This is a follow-up to [`st.App`](../2025-12-23-st-app/product-spec.md) (ASGI entry
> point). It only applies to apps built with `st.App`; it does not change how
> traditional (non-`st.App`) scripts run.

## Problem

[#9450](https://github.com/streamlit/streamlit/issues/9450) asks to run a Streamlit app
with `python app.py` instead of `streamlit run app.py`. The main motivation is shareable
apps with inline dependencies and a single launch command that "just work" via
`uv run app.py`, with no extra setup.

Today this is only possible with a brittle workaround that reaches into Streamlit
internals:

```python
import streamlit as st

st.write("Hello")

if __name__ == "__main__":
    # Hacky: relies on private internals
    from streamlit.runtime.scriptrunner import get_script_run_ctx
    if get_script_run_ctx() is None:
        import sys
        from streamlit.web.cli import main
        sys.argv = ["streamlit", "run", __file__]
        main()
```

This is undiscoverable, fragile, and not part of the public API. `st.App` gives us a
clean place to expose this as a first-class capability, because the file that defines
the `st.App` object is a *launcher module* (it is imported, not exec'd as `__main__`,
under `streamlit run` and `uvicorn`). That means `if __name__ == "__main__"` is true
for the launcher only under `python app.py`, so there is no risk of double-starting a
server under the other launcher modes.

This proposal intentionally focuses on launcher modules such as `app = st.App("dashboard.py")`.
A true same-file pattern such as `app = st.App(__file__)` needs additional protection:
Streamlit's script runner executes user scripts in a fake `__main__` module, so the
`if __name__ == "__main__": app.run()` guard would otherwise run again during app
execution.

## Proposal

### API

```python
class App:
    def run(self, *, config: Mapping[str, Any] | None = None) -> None:
        """Start a local Streamlit server for this app and block until stopped.

        Intended for launching an st.App launcher module directly, e.g.
        `python app.py`. Reuses the same embedded ASGI server runner that
        `streamlit run` uses for st.App scripts.

        Parameters
        ----------
        config : Mapping[str, Any] or None
            Config option overrides, keyed by dotted config name (e.g.
            ``{"server.port": 8502}``). This is the programmatic equivalent of the
            config flags accepted by ``streamlit run`` (e.g. ``--server.port 8502``).
            Sensitive options and unknown options are rejected. If this is ``None``
            (default), config comes from ``config.toml`` and environment variables
            as usual.
        """
```

Usage — simplest first, then with config overrides. In this example, `app.py` is the
launcher module and `dashboard.py` is the Streamlit script executed by the runtime:

```python
import streamlit as st

app = st.App("dashboard.py")

if __name__ == "__main__":
    app.run()
```

```python
if __name__ == "__main__":
    # Self-contained launcher that pins its own server settings,
    # with no config.toml or env vars required.
    app.run(config={"server.port": 8502, "server.address": "0.0.0.0"})
```

Now all launcher modes are equivalent:

```bash
python app.py            # new: App.run() on the existing `app` object
uv run app.py            # new: App.run() (the primary motivating use case)
streamlit run app.py     # unchanged: AST discovery finds `app`
uvicorn app:app          # unchanged: external ASGI server
```

### Configuring server settings: options considered

Standalone `python app.py` has no CLI to pass `--server.port`, so the question is how a
self-contained launcher sets deployment settings.

**Option A: No programmatic config — rely on `config.toml` / env vars only**
- Pros: Smallest API; keeps deployment settings out of code per "Config vs Code".
- Cons: Breaks the self-contained launcher motivation of #9450 — a shareable `app.py`
  can't pin its own port/address without shipping an extra `config.toml` or requiring
  `STREAMLIT_SERVER_PORT=...`.

**Option B: `config` dict keyed by dotted config names** ✅ PREFERRED
- Pros: Full parity with the `streamlit run` config-flag surface in one parameter; makes
  launcher modules fully self-contained; after explicit `App.run()` validation, flows
  through the existing `config.get_config_options(options_from_flags=...)` loading path;
  matches `uvicorn.run(...)` / Flask `app.run(...)` precedent of setting server options
  in code.
- Cons: Stringly-typed keys (no autocompletion); overlaps with `config.toml` (resolved by
  documented precedence below).

**Option C: Explicit kwargs (`host=`, `port=`, ...)**
- Pros: Discoverable, typed for the common case.
- Cons: Duplicates the config schema; only covers a handful of options; risks "two ways
  to set the port" if combined with a dict. Can be added later as ergonomic shortcuts.

We adopt **Option B**. Common-case shortcuts (Option C) are deferred (see Out of Scope).

### Behavior

`run()` performs the same process-level setup the CLI does for ASGI apps today: fixes
`sys.path`/`sys.argv`, loads config options (overlaying the `config` argument as flag
options), installs config watchers, sets the `starlette-app` server mode, prints the app
URL, and runs the embedded uvicorn server until interrupted (Ctrl-C / SIGTERM).

Implementation note: `streamlit run` uses `bootstrap.run_asgi_app` with an import string
because the CLI discovers the app from a file path. `App.run()` should reuse the same
setup helpers and `UvicornRunner`, but pass the existing `App` instance into the runner
instead of re-importing the launcher module. Re-importing would create a second launcher
module instance and could duplicate user module-level side effects.

**Command-line arguments (`python app.py foo bar`):**

Positional arguments are forwarded to the app script so that `python app.py foo bar`
behaves identically to `streamlit run app.py -- foo bar` for script arguments. `run()`
sets `sys.argv = [<launcher>, *sys.argv[1:]]` via the existing `_fix_sys_argv`, so the
executed Streamlit script reads its arguments from `sys.argv` exactly as it does under
`streamlit run`.

This gives a clean split with no `--` separator (which `streamlit run` needs to separate
config flags from script args): under `python app.py`, positional args go to the app via
`sys.argv`, and config overrides go through the `config` argument (there is no Click flag
parser to collide with). Example:

```python
import sys
import streamlit as st

app = st.App("dashboard.py")

if __name__ == "__main__":
    app.run()

# `python app.py --date 2026-06-14 extra` -> dashboard.py sees
# sys.argv == ["app.py", "--date", "2026-06-14", "extra"]
```

**`config` handling:**

- **Precedence:** `config` argument > environment variables > `config.toml` > defaults —
  the same precedence the CLI's config flags use (the argument is passed as
  `options_from_flags`).
- **Sensitive options are rejected before config loading** (e.g. options marked
  `sensitive`, like auth cookie secrets), matching the CLI, which refuses
  `--<sensitive>` flags and directs users to a config file or environment variable.
  `run()` raises a clear `StreamlitAPIException` with the same guidance. This validation
  must be explicit because the low-level `options_from_flags` path does not itself apply
  Click's sensitive-option callback.
- **Unknown / invalid keys fail fast before config loading** with a
  `StreamlitAPIException` naming the offending key, rather than being silently ignored or
  logged as a warning by lower-level config helpers.

**What happens if a server is already running?** Two distinct cases:

1. **A Streamlit runtime already exists in this process.** The `Runtime` is a
   process-wide singleton. This happens if `run()` is called twice, or if `run()` is
   called after the same (or another) `st.App` was already mounted/started (e.g. via
   `.lifespan()` for FastAPI mounting). `run()` detects this via `streamlit.runtime.exists()`
   and raises a clear `StreamlitAPIException` ("A Streamlit server is already running in
   this process; call `App.run()` only once, and not when the app is also served via
   `streamlit run`/`uvicorn`/mounted on another framework.") instead of surfacing the
   cryptic internal `RuntimeError("Runtime instance already exists!")`. This is a key
   reason to gate startup on `runtime.exists()` rather than blindly constructing a runtime.

2. **The OS port is already in use** (a different process holds the port). This is handled
   by the existing uvicorn server's port-retry logic: it increments to the next free port
   and prints the chosen URL. No new behavior needed.

Note that under `streamlit run app.py` / `uvicorn app:app`, the launcher module is
*imported* (module name is the file stem, not `"__main__"`), so the guarded
`if __name__ == "__main__": app.run()` block does not execute and there is no
double-start. The `runtime.exists()` guard is the safety net for the rarer in-process
cases above.

### Why a method on `st.App` (vs. alternatives)

`st.App` is the natural anchor: it is already an ASGI-callable object that builds the full
Starlette + `Runtime` stack, and its launcher-module semantics eliminate the
`__name__ == "__main__"` double-start ambiguity that affects bare scripts. `run()` mirrors
the `uvicorn`/FastAPI mental model (`app` object + `.run()`), so it reads as idiomatic.

## Out of Scope (Future Work)

- **Explicit `host=` / `port=` kwargs** — the `config` dict already covers these; add
  typed shortcuts for the most common settings only if users ask (Option C above).
- **Explicit `args=` parameter** — positional args are auto-forwarded from `sys.argv`;
  add an explicit override only if a launcher needs to consume some of its own arguments
  before handing the rest to the app.
- **Same-file `st.App(__file__)` launchers** — out of scope for v1 unless the
  implementation adds an explicit re-entry guard for Streamlit's fake `__main__` script
  execution. Without that guard, the app script would call `app.run()` again when the
  runtime executes it.
- **Auto-start without `if __name__ == "__main__": app.run()`** — implicitly starting a
  server whenever a script defining `st.App` is run with `python app.py` is more magical
  and risks firing in notebooks, tests, subprocesses, and mounting setups. Could be added
  later behind a config flag if there is demand.
- **`python app.py` for traditional (non-`st.App`) scripts** — out of scope; the
  double-exec ambiguity makes this materially harder and `st.App` covers the motivating
  use case.
- **`App.start()` (non-blocking) / programmatic stop** — `run()` is blocking by design;
  background/threaded serving is not part of v1.

## Checklist

| Item | ✅ or comment |
|------|---------------|
| Works on SiS, Cloud, etc? | N/A — `run()` is for local/self-hosted launching; hosted platforms use their own server entry points. |
| No breaking API changes | ✅ Additive method on `st.App`. |
| No new dependencies | ✅ Reuses the existing uvicorn/Starlette stack. |
| Metrics collected | Reuses existing `server_mode` tracking (`starlette-app`). Could add a flag to distinguish direct `python app.py` launches. |
| Any security/legal impact? | ✅ None beyond existing `st.App` / `streamlit run`. |
| Any docs changes needed? | Add to the "Advanced Deployment with st.App" docs: a "Run with `python app.py`" subsection. |
| Any other risks? | Clear errors are needed for existing runtimes and invalid `config` keys; same-file launchers need an explicit re-entry guard or must remain out of scope. |
