---
author: lukasmasuch
created: 2026-04-11
---

# Run Streamlit apps as Python modules

## Summary

Add support for running Streamlit apps as Python modules via `streamlit run mypackage.app`.
When the target doesn't exist as a file and doesn't have a `.py` extension, Streamlit
automatically resolves it as a Python module. This enables pip-installable apps, better build
tool integration, and proper Python package semantics—with zero new syntax.

## Problem

Streamlit currently requires a file path or URL to run an app. Users cannot run apps that are
packaged as Python modules, which creates friction for several common workflows:

**Requests:**

- [#662](https://github.com/streamlit/streamlit/issues/662) — Add option to run modules (216+ reactions, opened 2019)
- [#12972](https://github.com/streamlit/streamlit/issues/12972) — Launch by module redux (2025)

**Use cases:**

1. **Pip-installable apps**: Package a Streamlit app as a wheel, `pip install` it, and run without
   needing the source checkout or knowing the installation path.

   ```bash
   pip install my-streamlit-app
   streamlit run my_streamlit_app
   ```

2. **Build tool integration**: Modern build systems like Pants, Bazel, and Poetry create binaries
   where the final file paths are unknown at configuration time, but module names are stable.

   ```python
   # Pants BUILD file - file paths unknown, but module name is known
   pex_binary(
       entry_point="streamlit",
       args=["run", "my.dash.module"],
   )
   ```

3. **Proper Python package semantics**: Running via module executes `__init__.py` files throughout
   the package hierarchy, enabling proper initialization and relative imports.

4. **Docker/container deployment**: Install the app wheel and run by module name without copying
   additional assets or knowing installation directories.

**Current workarounds (and their limitations):**

| Workaround | Limitation |
|------------|------------|
| `python -m streamlit run path/to/file.py` | Requires knowing the file path |
| `runpy.run_module()` shim | Doesn't work with multipage apps |
| Wrapper script with `importlib` | Extra boilerplate, fragile |
| `sys.modules[module].__file__` hack | Requires custom entry point per app |

## Proposal

### Module fallback — minimal change to existing resolution

Add module resolution as a fallback when the target doesn't exist as a file. This preserves
the existing resolution order exactly and only changes the final error case.

**Current resolution order:**

1. Is a URL → download and run
2. Is a directory → append `streamlit_app.py` and run
3. Check extension → must be `.py` or `.py3` (else error)
4. Check exists → must exist on disk (else error) ← **change this step**

**New resolution order:**

1. Is a URL → download and run *(unchanged)*
2. Is a directory → append `streamlit_app.py` and run *(unchanged)*
3. Check extension → must be `.py` or `.py3` (else **try module resolution**)
4. Check exists → must exist on disk (else **try module resolution**)

**Why this is safe:**

- 100% backwards compatible — any target that works today continues to work identically
- Files with `.py` extension that don't exist still error (no module fallback for `.py` targets)
- Only targets without `.py` extension that don't exist as files trigger module resolution

### API

```bash
# Module (fallback when file doesn't exist)
streamlit run mypackage.app
streamlit run mypackage.streamlit_app
streamlit run mycompany.tools.dashboard.app -- --debug

# File (existing behavior, unchanged)
streamlit run app.py
streamlit run path/to/app.py
streamlit run ./myapp

# URL (existing behavior, unchanged)
streamlit run https://example.com/app.py
```

### Behavior

1. **Module resolution**: Use `importlib.util.find_spec(module_path)` to resolve the module to a
   file path. If the module cannot be found, raise a clear error.

2. **Package support**: If the module is a package (directory with `__init__.py`), look for
   `__main__.py` within the package. This mirrors `python -m` behavior.

3. **File execution**: Once resolved to a file path, execute using the existing Streamlit runner.
   The resolved path becomes the main script path.

4. **Working directory**: The current working directory remains unchanged (user's shell cwd).
   This is consistent with `python -m` behavior.

5. **Multipage apps**: The `pages/` directory is resolved relative to the main script's location
   (the resolved module file), maintaining existing multipage app behavior.

6. **Error handling**:
   - Target has `.py` extension but doesn't exist: `File does not exist: app.py` *(unchanged)*
   - Module not found: `ModuleNotFoundError: No module named 'mypackage'`
   - Module has no `__file__`: `StreamlitAPIException: Module 'mypackage' has no associated file`
   - Package without `__main__.py`: Check for `streamlit_app.py` in package, else error

### Examples

**Basic module:**

```bash
# Project structure (installed or in PYTHONPATH)
myapp/
├── __init__.py
└── streamlit_app.py

# Run
streamlit run myapp.streamlit_app
```

**Package with `__main__.py`:**

```bash
# Project structure
myapp/
├── __init__.py
├── __main__.py  # Contains Streamlit app code
└── utils.py

# Run (executes __main__.py)
streamlit run myapp
```

**Installed package:**

```bash
pip install my-streamlit-app
streamlit run my_streamlit_app
```

**With multipage apps:**

```bash
# Project structure
myapp/
├── __init__.py
├── app.py
└── pages/
    ├── page1.py
    └── page2.py

# Run — pages/ discovered relative to app.py
streamlit run myapp.app
```

### Edge cases

| Scenario | Behavior |
|----------|----------|
| `app.py` doesn't exist | `File does not exist: app.py` — no module fallback for `.py` targets |
| `mypackage.app` doesn't exist as file | Try module resolution |
| Module not installed | `ModuleNotFoundError` with module name |
| Namespace package (no `__init__.py`) | Supported if module file has `__file__` attribute |
| Built-in module (no file) | `StreamlitAPIException` — cannot run modules without files |
| Frozen/compiled module | Supported if `__file__` points to valid Python source |
| Module in `.pth` path | Supported — uses standard import machinery |
| Local dir `myapp` exists + module `myapp` installed | Local directory takes priority (existing behavior) |

## Out of Scope (Future Work)

- **Entry point discovery**: Auto-discovering Streamlit apps via `[project.scripts]` or
  `[project.entry-points]` in `pyproject.toml`
- **ASGI app module support**: Running `st.App` instances from modules (would need additional
  discovery logic)
- **Module hot-reload**: Watching for changes in installed packages (complex due to import caching)

## Checklist

| Item | Status |
|------|--------|
| Works on SiS, Cloud, etc? | Requires module to be installed in environment |
| No breaking API changes | Yes — file-first priority preserves all existing behavior |
| No new dependencies | Uses `importlib` (stdlib) |
| Metrics collected | Add `run_target_type: "module"` to telemetry |
| Any security/legal impact | No — same execution model as file paths |
| Any docs changes needed | Document module resolution in CLI reference |
