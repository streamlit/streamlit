# UV Migration - Next Steps

This document tracks potential follow-up items from the UV migration. These are optional improvements that could enhance the development experience but are not blocking.

## Status Summary

The core UV migration is **complete**. All essential items have been addressed:

| Item | Status |
|------|--------|
| `lib/setup.py` → `lib/pyproject.toml` | ✅ Complete |
| Tool configs consolidated to root `pyproject.toml` | ✅ Complete |
| Old config files removed | ✅ `.ruff.toml`, `mypy.ini`, `ty.toml`, `lib/pytest.ini`, `lib/.coveragerc` |
| Makefile updated for `uv sync` | ✅ Complete |
| CI/CD workflows updated | ✅ Complete |
| `.python-version` file | ✅ Exists |
| Conda recipe updated | ✅ Uses `load_file_data` from pyproject.toml |
| Dependabot uses `uv` ecosystem | ✅ Complete |
| `required-version` enforcement | ✅ `>=0.9.0` in pyproject.toml |
| AGENTS.md updated | ✅ Uses `uv run` commands |
| Scripts updated | ✅ `update_version.py`, `sync_ruff_version.py` work with pyproject.toml |

---

## Potential Follow-ups

### 1. Lock File Strategy (Low Priority)

**Current state:** No `uv.lock` committed (floating versions strategy for early compatibility detection)

**Consideration:** FastAPI commits `uv.lock` for reproducibility. Options:

- **Option A (Current):** Keep floating versions - catches compatibility issues early
- **Option B:** Commit `uv.lock` - reproducible CI, faster installs
- **Option C:** Hybrid - add a separate CI job with locked deps for stability testing

**Decision needed:** Whether reproducibility benefits outweigh early compatibility detection.

**If adopting lock file:**
```bash
# Generate lock file
uv lock

# Add to .pre-commit-config.yaml
- repo: https://github.com/astral-sh/uv-pre-commit
  hooks:
    - id: uv-lock
```

---

### 2. Windows CLI Script Cleanup (Low Priority)

**Current state:** `lib/bin/streamlit.cmd` still exists

**Consideration:** Modern pip/uv creates platform-appropriate entry points automatically via `[project.scripts]`. The batch script may be redundant.

**Action items:**
- [ ] Test Windows installation with just `[project.scripts]`
- [ ] If works, remove `lib/bin/streamlit.cmd`
- [ ] Update `MANIFEST.in` if it references the file

---

### 3. Dependabot Grouping for Python Deps (Nice to Have)

**Current state:** Python deps are not grouped (unlike npm deps which have groups like `deck-gl`, `vega`, etc.)

**Suggested groups to add to `.github/dependabot.yml`:**

```yaml
- package-ecosystem: "uv"
  directory: "/"
  # ... existing config ...
  groups:
    pytest:
      patterns:
        - "pytest*"
    type-stubs:
      patterns:
        - "types-*"
        - "*-stubs"
    playwright:
      patterns:
        - "playwright"
        - "pytest-playwright"
    mypy:
      patterns:
        - "mypy*"
```

**Benefits:** Fewer, more cohesive dependency update PRs.

---

### 4. Pre-commit UV Hooks (Optional)

**Current state:** No uv-specific pre-commit hooks

**Available hooks from `astral-sh/uv-pre-commit`:**
- `uv-lock` - Keeps `uv.lock` in sync with `pyproject.toml` (requires lock file adoption)
- `uv-export` - Export to requirements.txt format

**Only relevant if lock file is adopted.**

---

### 5. Scripts Verification (Complete)

**Status:** ✅ Already verified and working

Both scripts have been updated and work correctly with pyproject.toml:

- **`scripts/update_version.py`** - Uses `lib/pyproject.toml` regex pattern:
  ```python
  PYTHON = {"lib/pyproject.toml": r'(?P<pre>^version = ").*(?P<post>"$)'}
  ```

- **`scripts/sync_ruff_version.py`** - Reads from root `pyproject.toml` dependency groups and syncs to `.pre-commit-config.yaml`

**Verification:**
```bash
$ uv run python scripts/sync_ruff_version.py --check
🔍 Checking ruff version sync...
✅ Ruff versions are in sync: 0.14.11
```

---

## Additional UV Features to Consider (Future)

These features from the UV documentation could be useful in the future:

### Exclude Newer (Debugging Regressions)

Limit package versions to those published before a specific date:

```toml
[tool.uv]
exclude-newer = "2026-01-15T00:00:00Z"
```

Useful for investigating when a regression was introduced.

### Override Dependencies

Force specific versions regardless of other requirements:

```toml
[tool.uv]
override-dependencies = [
    "numpy==1.26.4",  # Pin for compatibility
]
```

### Constraint Dependencies

Set upper bounds without requiring installation:

```toml
[tool.uv]
constraint-dependencies = [
    "protobuf<5",  # Avoid breaking changes
]
```

### Environment Targeting

Restrict resolution to specific platforms for faster resolution:

```toml
[tool.uv]
environments = [
    "sys_platform == 'linux'",
    "sys_platform == 'darwin'",
    "sys_platform == 'win32'",
]
```

---

## References

- [UV Documentation](https://docs.astral.sh/uv/)
- [FastAPI UV Migration PR #14676](https://github.com/fastapi/fastapi/pull/14676)
- [Original migration plan](./uv-migration.md)
