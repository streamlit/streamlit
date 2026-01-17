# UV Migration Plan for Streamlit

This document outlines considerations and recommendations for migrating the Streamlit repository to use [uv](https://docs.astral.sh/uv/) as the primary Python package manager.

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Migration Options](#migration-options)
3. [Recommended Approach](#recommended-approach)
4. [Migration Steps](#migration-steps)
5. [Tool Configuration Consolidation](#tool-configuration-consolidation)
6. [CI/CD Updates](#cicd-updates)
7. [Learnings from FastAPI Migration](#learnings-from-fastapi-migration-pr-14676)
8. [AGENTS.md Updates](#agentsmd-updates)
9. [Risks and Mitigations](#risks-and-mitigations)
10. [Future Considerations](#future-considerations)
11. [Additional UV Features to Consider](#additional-uv-features-to-consider)
12. [Dependabot Configuration](#dependabot-configuration)
13. [Setup.py and Release CI Migration Issues](#setuppy-and-release-ci-migration-issues)

---

## Current State Analysis

### Package Management

| Aspect | Current State |
|--------|---------------|
| **Package definition** | `lib/setup.py` (setuptools) |
| **Dependencies** | Defined in `setup.py` (`INSTALL_REQUIRES`, `EXTRA_REQUIRES`) |
| **Dev dependencies** | `lib/dev-requirements.txt` |
| **Test dependencies** | `lib/test-requirements.txt` |
| **Integration deps** | `lib/integration-requirements.txt` |
| **Lock file** | None (floating versions with bounds) |
| **Min version constraints** | Auto-generated via `scripts/get_min_versions.py` → `scripts/assets/min-constraints-gen.txt` |

### Tool Configurations

| Tool | Config Location | Format |
|------|-----------------|--------|
| **Ruff** | `.ruff.toml` (root) | TOML |
| **Mypy** | `mypy.ini` (root) | INI |
| **Ty** | `ty.toml` (root) | TOML |
| **Pytest** | `lib/pytest.ini` | INI |
| **Coverage** | `lib/.coveragerc` | INI |
| **Pre-commit** | `.pre-commit-config.yaml` (root) | YAML |

### UV Usage Today

UV is **already partially adopted**:

- **Makefile**: Conditionally uses `uv pip install` if `uv` is available (line 133-139)
- **CI**: `pip install uv` in `make_init` action, then uses `uv pip install` for specific operations
- **Workflows**: Direct `uv pip install` calls for integration deps and min-deps tests

---

## Migration Options

### Option A: Minimal Migration (UV as pip replacement)

Keep `setup.py` and requirements files, but make `uv` the default package manager.

**Pros:**
- Minimal changes required
- No impact on PyPI/Conda distribution
- Lower risk
- Faster adoption

**Cons:**
- No lock file benefits
- Doesn't leverage uv's project management features
- Config files remain scattered

### Option B: Full Migration (pyproject.toml + uv workspace)

Convert to `pyproject.toml` with uv as the project manager, potentially using uv workspaces.

**Pros:**
- Modern Python packaging (PEP 517/518/621)
- Lock file support (`uv.lock`)
- Consolidated configuration
- Better dependency resolution
- Reproducible environments

**Cons:**
- Larger migration effort
- Need to decide on config file locations
- May require adjustments for Conda builds
- More complex monorepo setup

### Option C: Hybrid Approach (Recommended)

Migrate `lib/setup.py` to `lib/pyproject.toml` for package definition, consolidate tool configs to root `pyproject.toml`, and use `uv` as the primary package manager without a lock file (initially).

**Pros:**
- Modern packaging standards
- Consolidated configuration
- Maintains compatibility with existing workflows
- Can add lock file later if needed
- Preserves current floating-version testing strategy

**Cons:**
- Requires careful config file organization
- Dual location for some configs (package vs tools)

---

## Recommended Approach

We recommend **Option C: Hybrid Approach** with the following structure:

```
streamlit/
├── pyproject.toml          # Tool configs + dev/test dependency groups
├── lib/
│   ├── pyproject.toml      # Package definition only (replaces setup.py)
│   └── streamlit/
└── ...
```

### Rationale

1. **Package in `lib/pyproject.toml`**: The package definition (runtime dependencies, extras, metadata) stays with the package source. This is what gets published to PyPI.

2. **Tools AND dev deps in root `pyproject.toml`**: Tool configs AND dependency groups are placed in the root because:
   - Dev tools (ruff, mypy, pytest) operate on the entire repository (lib, e2e_playwright, scripts)
   - Root is the natural working directory for development (`uv sync`, `uv run` from repo root)
   - Aligns with where `.ruff.toml`, `mypy.ini`, `ty.toml` already live
   - Clear separation: root = development environment, lib = published package

3. **No lock file initially**: Streamlit's testing strategy relies on floating versions to catch compatibility issues early. A lock file can be added later for reproducible CI if needed.

4. **Migrate requirements files to root**: Dev/test dependencies move from `lib/*.txt` to `[dependency-groups]` in root `pyproject.toml`.

---

## Migration Steps

### Phase 1: Convert lib/setup.py to lib/pyproject.toml

Create `lib/pyproject.toml`:

```toml
[build-system]
requires = ["setuptools>=65.5.1", "wheel"]
build-backend = "setuptools.build_meta"

[project]
name = "streamlit"
version = "1.53.0"
description = "A faster way to build and share data apps"
readme = "../README.md"
license = "Apache-2.0"
requires-python = ">=3.10"
authors = [
    { name = "Snowflake Inc", email = "hello@streamlit.io" }
]
classifiers = [
    "Development Status :: 5 - Production/Stable",
    "Environment :: Console",
    "Environment :: Web Environment",
    "Intended Audience :: Developers",
    "Intended Audience :: Science/Research",
    "License :: OSI Approved :: Apache Software License",
    "Programming Language :: Python :: 3.10",
    "Programming Language :: Python :: 3.11",
    "Programming Language :: Python :: 3.12",
    "Programming Language :: Python :: 3.13",
    "Programming Language :: Python :: 3.14",
    "Topic :: Database :: Front-Ends",
    "Topic :: Office/Business :: Financial :: Spreadsheet",
    "Topic :: Scientific/Engineering :: Information Analysis",
    "Topic :: Scientific/Engineering :: Visualization",
    "Topic :: Software Development :: Libraries :: Application Frameworks",
    "Topic :: Software Development :: Widget Sets",
]
dependencies = [
    "altair>=4.0,<7,!=5.4.0,!=5.4.1",
    "blinker>=1.5.0,<2",
    "cachetools>=5.5,<7",
    "click>=7.0,<9",
    "gitpython>=3.0.7,<4,!=3.1.19",
    "numpy>=1.23,<3",
    "packaging>=20",
    "pandas>=1.4.0,<3",
    "pillow>=7.1.0,<13",
    "protobuf>=3.20,<7",
    "pyarrow>=7.0",
    "pydeck>=0.8.0b4,<1",
    "requests>=2.27,<3",
    "tenacity>=8.1.0,<10",
    "toml>=0.10.1,<2",
    "tornado>=6.0.3,<7,!=6.5.0",
    "typing-extensions>=4.10.0,<5",
    "watchdog>=2.1.5,<7; platform_system != 'Darwin'",
]

[project.optional-dependencies]
snowflake = [
    "snowflake-snowpark-python[modin]>=1.17.0; python_version<'3.12'",
    "snowflake-connector-python>=3.3.0; python_version<'3.12'",
]
starlette = [
    "starlette>=0.40.0",
    "uvicorn>=0.30.0",
    "anyio>=4.0.0",
    "python-multipart>=0.0.10",
    "websockets>=12.0.0",
    "itsdangerous>=2.1.2",
]
pdf = ["streamlit-pdf>=1.0.0"]
auth = ["Authlib>=1.3.2"]
charts = [
    "matplotlib>=3.0.0",
    "graphviz>=0.19.0",
    "plotly>=4.0.0",
    "orjson>=3.5.0",
]
sql = ["SQLAlchemy>=2.0.0"]
performance = [
    "orjson>=3.5.0",
    "uvloop>=0.15.2; sys_platform != 'win32' and sys_platform != 'cygwin' and platform_python_implementation != 'PyPy'",
    "httptools>=0.6.3",
]
all = [
    "streamlit[auth,charts,snowflake,sql,pdf,performance]",
    "rich>=11.0.0",
]

[project.scripts]
streamlit = "streamlit.web.cli:main"

[project.urls]
Homepage = "https://streamlit.io"
Documentation = "https://docs.streamlit.io/"
"Source Code" = "https://github.com/streamlit/streamlit"
"Bug Tracker" = "https://github.com/streamlit/streamlit/issues"
"Release Notes" = "https://docs.streamlit.io/develop/quick-reference/changelog"
Community = "https://discuss.streamlit.io/"

[tool.setuptools]
zip-safe = false
include-package-data = true

[tool.setuptools.packages.find]
exclude = ["tests", "tests.*"]

[tool.setuptools.package-data]
streamlit = ["py.typed", "hello/**/*.py"]
```

**Note:** The `SNOWPARK_CONDA_BUILD` environment variable logic for excluding certain dependencies would need to be handled differently - either via build-time configuration or separate Conda recipe.

### Phase 2: Consolidate Tool Configs AND Dev Dependencies to Root pyproject.toml

Create/update root `pyproject.toml`:

```toml
# Root pyproject.toml - Tool configurations + dev/test dependencies
# The actual streamlit package is defined in lib/pyproject.toml

# Note: This is NOT a package, just a uv project for development
[project]
name = "streamlit-dev"
version = "0.0.0"
requires-python = ">=3.10"
# Reference the actual package as a dev dependency
dependencies = []

[tool.uv.sources]
# Install the local streamlit package in editable mode
streamlit = { path = "lib", editable = true }

[dependency-groups]
# Dev group includes everything needed for development
dev = [
    { include-group = "test" },
    "streamlit",  # The local package
    "pre-commit",
    "ty==0.0.11",
    "ruff==0.14.11",
    "mypy>=1.16.1,<1.20",
    "mypy-protobuf>=3.2",
    "semver>=3",
    "setuptools>=65.5.1",
    "twine",
    "wheel",
    "pytz",
    "emoji",
    # mypy type stubs
    "types-protobuf",
    "types-pytz",
    "types-requests",
    "types-setuptools",
    "types-toml",
    "types-cachetools",
    "types-Authlib",
    "pandas-stubs>=2.3.3.251219",
]
test = [
    "streamlit",  # The local package
    # Test infrastructure
    "pytest>=8.3.5",
    "pytest-cov",
    "hypothesis>=6.17.4",
    "parameterized",
    "requests-mock",
    "testfixtures",
    # Playwright
    "playwright==1.57.*",
    "pytest-playwright>=0.3.3",
    "pixelmatch>=0.3.0",
    "pytest-xdist>=3.6.1",
    "pytest-rerunfailures>=15.0,!=16.0",
    "pytest-github-actions-annotate-failures",
    "pytest-benchmark>=5.1.0",
    "pytest-repeat>=0.9.3",
    "pytest-timeout>=2.3.1",
    # Test dependencies for optional features
    "Authlib>=1.3.2",
    "graphviz>=0.17",
    "matplotlib>=3.3.4",
    "plotly>=5.3.1",
    "seaborn>=0.11.2",
    "watchdog>=2.1.5",
    "streamlit-pdf>=1.0.0",
    "uvloop>=0.15.2",
    "rich>=10.14.0",
    "vega_datasets",
    # Starlette support
    "starlette>=0.40.0",
    "uvicorn>=0.30.0",
    "python-multipart>=0.0.10",
    "websockets>=12.0.0",
    "itsdangerous>=2.1.2",
    "httpx>=0.24.1",
]
integration = [
    "streamlit",
    "snowflake-snowpark-python[modin]>=1.17.0",
    "snowflake-connector-python>=3.3.0",
    "langchain>=0.2.0,<0.4",
    "langchain-community>=0.2.0,<0.4",
    "polars",
    "xarray",
    "dask",
    "ray",
    "duckdb",
    "sqlalchemy[mypy]>=2.0.0",
    "scipy>=1.7.3",
    "pydantic>=2.0.0",
]

[tool.ruff]
# Migrate from .ruff.toml
target-version = "py310"
line-length = 88
extend-exclude = [
    "lib/streamlit/proto",
    "lib/streamlit/emojis.py",
    "lib/streamlit/material_icon_names.py",
    "e2e_playwright/compilation_error_dialog.py",
    "frontend/**",
]

[tool.ruff.format]
docstring-code-format = true
docstring-code-line-length = "dynamic"
line-ending = "lf"

[tool.ruff.lint]
preview = true
explicit-preview-rules = false
select = ["ALL"]
ignore = [
    # ... (keep existing ignore list from .ruff.toml)
]
# ... rest of ruff config

[tool.mypy]
# Migrate from mypy.ini
python_version = "3.10"
cache_dir = ".mypy_cache"
incremental = true
files = ["lib/streamlit/", "lib/tests/streamlit/typing/", "scripts/", "e2e_playwright/"]
exclude = ["^e2e_playwright/compilation_error_dialog\\.py$"]
# ... rest of mypy strict mode settings

[tool.ty]
# Migrate from ty.toml (if ty supports pyproject.toml)
# Note: ty is still in beta - check current config support

[tool.pytest.ini_options]
# Migrate from lib/pytest.ini
asyncio_default_fixture_loop_scope = "function"
markers = [
    "slow: marks tests as slow",
    "require_integration: marks tests that require integration dependencies",
    "performance: performance tests",
]
filterwarnings = [
    "ignore::UserWarning:altair.*:",
    "ignore::DeprecationWarning:flatbuffers.*:",
    "ignore::DeprecationWarning:keras_preprocessing.*:",
]
addopts = "--cov=streamlit --cov-config=lib/.coveragerc --cov-report=html"
testpaths = ["lib/tests"]

[tool.coverage.run]
# Migrate from lib/.coveragerc
source = ["streamlit"]
omit = [
    "**/proto/*",
    "**/vendor/*",
    "**/hello/*",
    "**/static/*",
]

[tool.coverage.report]
exclude_lines = [
    "pragma: no cover",
    "if TYPE_CHECKING:",
    "raise NotImplementedError",
]
```

**Key points:**
- Root `pyproject.toml` defines a "virtual" project (`streamlit-dev`) just for development
- Uses `[tool.uv.sources]` to reference the local package in editable mode
- All dev/test/integration dependencies are in `[dependency-groups]`
- Groups can include other groups with `{ include-group = "test" }`
- After migration, delete `lib/dev-requirements.txt`, `lib/test-requirements.txt`, `lib/integration-requirements.txt`

### Phase 3: Update Makefile

Update `python-init` target to use `uv` as default:

```makefile
.PHONY: python-init
# Install Python dependencies and Streamlit in editable mode.
python-init:
	@# Check if uv is installed
	@if ! command -v uv > /dev/null 2>&1; then \
		echo "Installing uv..."; \
		pip install uv; \
	fi
	pip_args=("--editable" "./lib");\
	if [ "${INSTALL_DEV_REQS}" = "true" ] ; then\
		pip_args+=("--requirement" "lib/dev-requirements.txt"); \
	fi;\
	if [ "${INSTALL_TEST_REQS}" = "true" ] ; then\
		pip_args+=("--requirement" "lib/test-requirements.txt"); \
	fi;\
	echo "Running command: uv pip install $${pip_args[@]}"; \
	uv pip install $${pip_args[@]}; \
	if [ "${INSTALL_TEST_REQS}" = "true" ] && [ "${INSTALL_PLAYWRIGHT}" = "true" ] ; then\
		python -m playwright install --with-deps; \
	fi;
```

Optionally add new targets for uv-specific workflows:

```makefile
.PHONY: sync
# Sync Python environment using uv.
sync:
	uv pip sync lib/dev-requirements.txt lib/test-requirements.txt
	uv pip install --editable ./lib

.PHONY: upgrade-deps
# Upgrade all Python dependencies to latest compatible versions.
upgrade-deps:
	uv pip install --upgrade -r lib/dev-requirements.txt -r lib/test-requirements.txt
	uv pip install --editable ./lib --upgrade
```

### Phase 4: Update CI/CD

Update `.github/actions/make_init/action.yml`:

```yaml
- if: steps.cache-virtualenv.outputs.cache-hit != 'true'
  name: Create Virtual Env
  run: |
    python -m venv venv
    source venv/bin/activate
    pip install --upgrade pip uv
    INSTALL_PLAYWRIGHT=false make python-init
    # Ensure local streamlit module takes precedence
    uv pip install --editable ./lib --no-deps
  shell: bash
```

Consider using `uv venv` instead of `python -m venv`:

```yaml
- name: Create Virtual Env with uv
  run: |
    pip install uv
    uv venv venv
    source venv/bin/activate
    INSTALL_PLAYWRIGHT=false make python-init
    uv pip install --editable ./lib --no-deps
  shell: bash
```

### Phase 5: Documentation Updates

1. Update `CONTRIBUTING.md` (if exists) with new setup instructions
2. Update all `AGENTS.md` files to use `uv run` for Python commands (see [AGENTS.md Updates](#agentsmd-updates) section)
3. Add uv to the project's development requirements or installation instructions
4. Update any other documentation that references `pip install` or direct Python tool invocations

---

## Tool Configuration Consolidation

### Current Locations → Proposed Locations

| Tool | Current | Proposed | Notes |
|------|---------|----------|-------|
| Ruff | `.ruff.toml` (root) | `pyproject.toml` `[tool.ruff]` | Full migration |
| Mypy | `mypy.ini` (root) | `pyproject.toml` `[tool.mypy]` | Full migration |
| Ty | `ty.toml` (root) | Keep `ty.toml` | ty is in beta, limited pyproject.toml support |
| Pytest | `lib/pytest.ini` | `pyproject.toml` `[tool.pytest.ini_options]` | Update testpaths |
| Coverage | `lib/.coveragerc` | `pyproject.toml` `[tool.coverage.*]` | Full migration |
| Pre-commit | `.pre-commit-config.yaml` | Keep as-is | YAML format required |

### Files to Remove After Migration

After confirming everything works:
- `.ruff.toml`
- `mypy.ini`
- `lib/pytest.ini`
- `lib/.coveragerc`
- `lib/setup.py`
- `lib/dev-requirements.txt` (moved to root `[dependency-groups]`)
- `lib/test-requirements.txt` (moved to root `[dependency-groups]`)
- `lib/integration-requirements.txt` (moved to root `[dependency-groups]`)

### Files to Keep

- `ty.toml` - Beta tool, limited pyproject.toml support
- `.pre-commit-config.yaml` - Pre-commit requires YAML

---

## CI/CD Updates

### GitHub Actions Cache Key

Update cache key to reference root `pyproject.toml` (which now contains dependency groups):

```yaml
- name: Create Python environment cache key
  run: |
    md5sum $(which python) > $GITHUB_WORKSPACE/python_cache_key.md5
    md5sum pyproject.toml >> $GITHUB_WORKSPACE/python_cache_key.md5
    md5sum lib/pyproject.toml >> $GITHUB_WORKSPACE/python_cache_key.md5
    md5sum Makefile >> $GITHUB_WORKSPACE/python_cache_key.md5
    date +%F >> $GITHUB_WORKSPACE/python_cache_key.md5
```

### UV Version Pinning

Consider pinning uv version in CI for reproducibility:

```yaml
- name: Install uv
  run: pip install uv==0.5.x  # Pin to minor version
```

Or use the official uv GitHub Action:

```yaml
- name: Install uv
  uses: astral-sh/setup-uv@v4
  with:
    version: "0.5.x"
```

---

## Learnings from FastAPI Migration (PR #14676)

FastAPI recently completed a comprehensive uv migration ([PR #14676](https://github.com/fastapi/fastapi/pull/14676)). Here are the key patterns and decisions to consider for Streamlit:

### Key Decisions Made by FastAPI

#### 1. Dependency Groups (PEP 735)

FastAPI moved **all** requirements files into `[dependency-groups]` in `pyproject.toml`:

```toml
[dependency-groups]
dev = [
    { include-group = "tests" },
    { include-group = "docs" },
    "playwright>=1.57.0",
]
tests = [
    "pytest>=7.1.3,<9.0.0",
    "coverage[toml]>=6.5.0,<8.0",
    "mypy==1.14.1",
    # ... more test deps
]
docs = [
    { include-group = "docs-tests" },
    "mkdocs-material==9.7.0",
    # ... more docs deps
]
```

**Key pattern**: Groups can include other groups using `{ include-group = "tests" }`.

#### 2. Lock File Commitment

FastAPI **added `uv.lock`** to version control (previously in `.gitignore`):
- Enables reproducible builds across all environments
- CI uses `--locked` flag to ensure lock file is respected
- Cache key now includes `uv.lock` instead of requirements files

#### 3. `uv sync` Instead of `uv pip install`

All dependency installation changed to:

```bash
# Old approach
uv pip install -r requirements-tests.txt

# New approach
uv sync --locked --no-dev --group tests --extra all
```

Flags explained:
- `--locked`: Fail if `uv.lock` is out of sync with `pyproject.toml`
- `--no-dev`: Don't install dev group (install specific groups instead)
- `--group tests`: Install the tests dependency group
- `--extra all`: Install all optional dependencies

#### 4. `uv run` for All Python Commands

Every Python command is now wrapped with `uv run`:

```bash
# Running scripts
uv run python ./scripts/docs.py build-lang

# Running bash scripts that use Python
uv run bash scripts/test.sh

# Running tools
uv run coverage combine coverage
uv run coverage report --fail-under=100
```

#### 5. GitHub Actions Updates

**Setup action** - Uses latest `astral-sh/setup-uv` without version pinning:

```yaml
- name: Setup uv
  uses: astral-sh/setup-uv@v7
  with:
    enable-cache: true
    cache-dependency-glob: |
      pyproject.toml
      uv.lock
```

**Environment variables**:
```yaml
env:
  UV_NO_SYNC: true  # Replaced UV_SYSTEM_PYTHON: 1
  UV_PYTHON: ${{ matrix.python-version }}  # For matrix builds
```

**Python version file** - Uses `.python-version` file:
```yaml
- uses: actions/setup-python@v6
  with:
    python-version-file: ".python-version"
```

#### 6. `.python-version` File

Added a `.python-version` file at repo root containing the default Python version:
```
3.11
```

This is used by both uv and `actions/setup-python`.

#### 7. Pre-commit Updates

Excluded `uv.lock` from large file checks:
```yaml
- id: check-added-large-files
  exclude: ^uv.lock$
```

#### 8. Simplified Contributing Docs

Removed dual pip/uv instructions, now just:
```markdown
Create a virtual environment and install the required packages with uv:

$ uv sync
```

### Recommendations for Streamlit Based on FastAPI

> **Note:** These recommendations have been incorporated into the main migration phases above.

#### Add to Phase 1: `.python-version` File

Create `.python-version` at repo root:
```
3.10
```

#### Dependency Groups in Root pyproject.toml (Phase 2)

As shown in Phase 2 above, dependency groups go in the **root** `pyproject.toml`, not `lib/pyproject.toml`:

```toml
# In root pyproject.toml (NOT lib/pyproject.toml)
[dependency-groups]
dev = [
    { include-group = "test" },
    "streamlit",  # Local package via [tool.uv.sources]
    "pre-commit",
    "ruff==0.14.11",
    # ... rest of dev-requirements.txt
]
test = [
    "streamlit",
    "pytest>=8.3.5",
    "pytest-cov",
    # ... rest of test-requirements.txt
]
```

**Why root?** Dev dependencies are repo-wide (lint/test entire codebase), and `uv sync` runs from repo root.

#### Alternative Phase 3: Makefile with `uv sync`

If adopting dependency groups, use `uv sync` pattern:

```makefile
.PHONY: python-init
python-init:
	@if ! command -v uv > /dev/null 2>&1; then \
		echo "Installing uv..."; \
		pip install uv; \
	fi
	@if [ "${INSTALL_DEV_REQS}" = "true" ] && [ "${INSTALL_TEST_REQS}" = "true" ]; then \
		uv sync --group dev; \
	elif [ "${INSTALL_DEV_REQS}" = "true" ]; then \
		uv sync --no-dev --group dev; \
	elif [ "${INSTALL_TEST_REQS}" = "true" ]; then \
		uv sync --no-dev --group test; \
	else \
		uv sync --no-dev; \
	fi
	@if [ "${INSTALL_TEST_REQS}" = "true" ] && [ "${INSTALL_PLAYWRIGHT}" = "true" ]; then \
		uv run python -m playwright install --with-deps; \
	fi
```

#### Alternative Phase 4: CI/CD with FastAPI Patterns

Use the FastAPI patterns for CI:

```yaml
env:
  UV_NO_SYNC: true

jobs:
  test:
    env:
      UV_PYTHON: ${{ matrix.python-version }}
    steps:
      - uses: actions/setup-python@v6
        with:
          python-version-file: ".python-version"
      - uses: astral-sh/setup-uv@v7
        with:
          enable-cache: true
          cache-dependency-glob: |
            pyproject.toml
            uv.lock
      - run: uv sync --locked --group test
      - run: uv run pytest lib/tests/
```

#### Pre-commit Config Update

Add to `.pre-commit-config.yaml` if committing `uv.lock`:

```yaml
- id: check-added-large-files
  exclude: ^uv.lock$
```

### Decision: Lock File Strategy

FastAPI chose to **commit `uv.lock`** for reproducibility. For Streamlit, there are two options:

**Option A: Commit `uv.lock` (FastAPI approach)**
- Pros: Reproducible CI, faster installs (no resolution), catches lock drift
- Cons: Changes current floating-version testing philosophy, larger diffs on updates

**Option B: Don't commit `uv.lock` (keep current philosophy)**
- Pros: Maintains floating-version testing to catch compatibility issues early
- Cons: Less reproducible, potentially slower CI (resolution on each run)

**Recommendation**: Start with Option B (no lock file) to maintain current testing philosophy. Add a separate CI job with a lock file for reproducibility testing if needed later.

---

## AGENTS.md Updates

All `AGENTS.md` files should be updated to use `uv run ...` for Python commands. This provides consistent environment management and ensures tools run with the correct dependencies.

### Files to Update

There are 7 `AGENTS.md` files in the repository:

| File | Content Type | Changes Needed |
|------|--------------|----------------|
| `AGENTS.md` (root) | Repo overview, make commands | Minor - mostly uses `make` targets |
| `lib/AGENTS.md` | Python development guide | Minor - mostly uses `make` targets |
| `lib/tests/AGENTS.md` | Unit test guide | **Major** - has direct `pytest` commands |
| `lib/streamlit/AGENTS.md` | Package structure | None expected |
| `e2e_playwright/AGENTS.md` | E2E test guide | Minor - mostly uses `make` targets |
| `frontend/AGENTS.md` | Frontend guide | None - TypeScript focused |
| `proto/streamlit/proto/AGENTS.md` | Protobuf guide | None expected |

### Specific Changes

#### `lib/tests/AGENTS.md`

Update the "Running tests" section:

**Current:**
```bash
# Run a specific test file with:
PYTHONPATH=lib pytest lib/tests/streamlit/my_example_test.py

# Run a specific test inside a test file with:
PYTHONPATH=lib pytest lib/tests/streamlit/my_example_test.py -k test_that_something_works
```

**Updated:**
```bash
# Run a specific test file with:
uv run pytest lib/tests/streamlit/my_example_test.py

# Run a specific test inside a test file with:
uv run pytest lib/tests/streamlit/my_example_test.py -k test_that_something_works
```

**Note:** With `uv run`, the `PYTHONPATH` environment variable is no longer needed as uv handles the environment setup.

#### `AGENTS.md` (root)

Update the Shell & Build Policy section to mention uv:

**Add:**
```markdown
### Shell & Build Policy (AI Agents)

- Prefer `make` targets for all dev tasks (tests, lint, format, builds).
- For Python unit tests: `uv run pytest` commands are allowed and encouraged for running specific tests during development.
- For running Python scripts: Use `uv run python script.py` or `uv run <tool>` for tools like ruff, mypy, etc.
- For E2E tests: `pytest` commands targeting `e2e_playwright/` files are blocked by policy.
  Use `make run-e2e-test <filename>` instead.
```

#### `lib/AGENTS.md`

Add a note about uv in the package structure section:

**Update `setup.py` reference:**
```markdown
- `pyproject.toml`: Package configuration of the Streamlit library (replaces setup.py).
```

**Add development commands section:**
```markdown
## Running Python Tools Directly

When not using `make` targets, prefer `uv run` to execute Python tools:

```bash
# Run linter
uv run ruff check lib/

# Run formatter
uv run ruff format lib/

# Run type checker
uv run mypy --config-file=mypy.ini

# Run tests
uv run pytest lib/tests/

# Run a script
uv run python scripts/my_script.py
```
```

#### `e2e_playwright/AGENTS.md`

The E2E guide mostly uses `make` commands which is correct. Add a note about uv:

**Add to "Running tests" section:**
```markdown
**Note:** Direct `pytest` commands for E2E tests should use `uv run`:
```bash
# If you need to run pytest directly (not recommended):
uv run pytest e2e_playwright/name_of_the_test.py
```
However, prefer the `make` targets as they handle additional setup.
```

### Benefits of `uv run`

1. **No manual venv activation**: `uv run` automatically uses the project's virtual environment
2. **Consistent environment**: Ensures the correct Python version and dependencies are used
3. **No PYTHONPATH hacks**: uv handles package discovery correctly
4. **Cross-platform**: Works the same on all operating systems
5. **Faster execution**: uv's optimized dependency resolution

### Example Transformations

| Current Command | Updated Command |
|----------------|-----------------|
| `PYTHONPATH=lib pytest lib/tests/...` | `uv run pytest lib/tests/...` |
| `python scripts/my_script.py` | `uv run python scripts/my_script.py` |
| `ruff check .` | `uv run ruff check .` |
| `mypy --config-file=mypy.ini` | `uv run mypy --config-file=mypy.ini` |
| `python -m playwright install` | `uv run python -m playwright install` |

### Phase 5 Checklist

As part of Phase 5 (Documentation Updates), update all AGENTS.md files:

- [ ] `AGENTS.md` (root) - Add uv to Shell & Build Policy
- [ ] `lib/AGENTS.md` - Update setup.py reference, add uv run examples
- [ ] `lib/tests/AGENTS.md` - Update pytest commands to use `uv run`
- [ ] `lib/streamlit/AGENTS.md` - Review for any Python command references
- [ ] `e2e_playwright/AGENTS.md` - Add note about uv run for direct pytest
- [ ] `frontend/AGENTS.md` - No changes needed (TypeScript focused)
- [ ] `proto/streamlit/proto/AGENTS.md` - Review for any Python command references

---

## Risks and Mitigations

### Risk 1: Conda Build Compatibility

**Risk:** `pyproject.toml` may require adjustments for Conda builds, especially the `SNOWPARK_CONDA_BUILD` logic.

**Mitigation:**
- Test Conda builds early in migration
- Keep conditional dependency logic in Conda recipe (`meta.yaml`) rather than `pyproject.toml`
- Consider using `setuptools` dynamic version/dependency features if needed

### Risk 2: Tool Config Migration Errors

**Risk:** Migrating INI-style configs to TOML may introduce subtle syntax differences.

**Mitigation:**
- Migrate one tool at a time
- Run full CI suite after each migration step
- Keep old config files until migration is verified

### Risk 3: Developer Environment Disruption

**Risk:** Developers may have muscle memory for old workflows.

**Mitigation:**
- Keep Makefile targets stable
- Document changes clearly
- Provide migration guide for existing contributors

### Risk 4: Editable Install Behavior

**Risk:** `uv pip install -e` may behave differently than `pip install -e`.

**Mitigation:**
- Test editable installs thoroughly
- Verify `streamlit` CLI works correctly after install
- Check that code changes are reflected without reinstall

---

## Future Considerations

### Lock File Addition

If reproducible CI becomes a priority, consider adding `uv.lock`:

```bash
# Generate lock file
uv lock

# Install from lock file in CI
uv sync --locked
```

**Trade-off:** This would change the current testing strategy where floating versions catch compatibility issues early. Consider maintaining both locked and floating CI jobs.

### UV Workspaces

If the repository evolves to have multiple Python packages, uv workspaces could manage them together:

```toml
# Root pyproject.toml
[tool.uv.workspace]
members = ["lib", "component-lib/python"]
exclude = ["scripts/tmp"]
```

Workspace features:
- Single `uv.lock` for all packages
- Shared dependency resolution
- Run commands in specific packages: `uv run --package streamlit pytest`

---

## Additional UV Features to Consider

Based on the [uv documentation](https://docs.astral.sh/uv/getting-started/features/), here are additional features that may benefit the Streamlit repository:

### 1. Python Version Management

**`.python-version` file** - Pin default Python version at repo root:
```
3.10
```

**Commands:**
```bash
# Install specific Python version
uv python install 3.12

# List available versions
uv python list

# Pin version for project
uv python pin 3.10
```

**Benefit:** Ensures consistent Python version across all developers and CI without relying on system Python.

### 2. `uvx` for Development Tools

Run tools without installing them into the project:

```bash
# Run ruff without adding to dependencies
uvx ruff check lib/

# Run specific version
uvx ruff@0.14.11 check lib/

# Run tool with extras
uvx --from 'mypy[faster-cache]' mypy lib/streamlit/
```

**Use case:** One-off tool runs, testing new tool versions, or tools not in dev dependencies.

### 3. Exclude Newer (Reproducible Builds)

Limit package versions to those published before a specific date:

```toml
[tool.uv]
exclude-newer = "2026-01-15T00:00:00Z"
```

**Use case:** Investigate regressions by testing against dependency versions from a known-good date.

### 4. Required Version Enforcement

Enforce minimum uv version for the project:

```toml
[tool.uv]
required-version = ">=0.5.0"
```

**Benefit:** Prevents issues from outdated uv installations.

### 5. Override Dependencies

Force specific versions regardless of other requirements:

```toml
[tool.uv]
override-dependencies = [
    "numpy==1.26.4",  # Pin for compatibility
]
```

**Use case:** Work around dependency conflicts or pin versions for security.

### 6. Constraint Dependencies

Limit versions without requiring installation:

```toml
[tool.uv]
constraint-dependencies = [
    "protobuf<5",  # Avoid breaking changes
]
```

**Use case:** Set upper bounds across all dependencies using a package.

### 7. Cache Configuration

Optimize CI caching:

```toml
[tool.uv]
cache-keys = [
    { file = "pyproject.toml" },
    { file = "lib/pyproject.toml" },
]
```

**Benefit:** Better cache invalidation control.

### 8. Pre-commit Integration

Use the official uv pre-commit hooks:

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/astral-sh/uv-pre-commit
    rev: 0.5.x
    hooks:
      - id: uv-lock
        # Keeps uv.lock in sync with pyproject.toml
```

**Hooks available:**
- `uv-lock` - Sync lock file when pyproject.toml changes
- `uv-export` - Export to requirements.txt format
- `pip-compile` - Compile requirements files

### 9. Conflict Declaration

Declare mutually exclusive extras or dependency groups:

```toml
[tool.uv]
conflicts = [
    [
        { extra = "snowflake" },
        { group = "integration" },
    ],
]
```

**Use case:** Prevent installing incompatible dependency combinations.

### 10. Environment Targeting

Restrict resolution to specific platforms:

```toml
[tool.uv]
environments = [
    "sys_platform == 'linux'",
    "sys_platform == 'darwin'",
    "sys_platform == 'win32'",
]
```

**Benefit:** Faster resolution by only considering relevant platforms.

---

## Dependabot Configuration

After migration, update `.github/dependabot.yml` to use uv instead of pip:

### Current Configuration

```yaml
# Keep python dependencies up to date
- package-ecosystem: "pip"
  directory: "/lib"
  schedule:
    interval: "daily"
```

### Updated Configuration

```yaml
# Keep python dependencies up to date (via uv)
- package-ecosystem: "uv"
  directory: "/"  # Root since pyproject.toml is at root
  schedule:
    interval: "daily"
  open-pull-requests-limit: 3
  cooldown:
    default-days: 5
  labels:
    - "change:chore"
    - "impact:internal"
    - "autofix"
  ignore:
    - dependency-name: "langchain"
      versions: [">=0.3.21"]
    - dependency-name: "langchain-community"
      versions: [">=0.3.14"]
  groups:
    # Group related test dependencies
    pytest:
      patterns:
        - "pytest*"
    # Group type stubs
    type-stubs:
      patterns:
        - "types-*"
        - "*-stubs"
    # Group Playwright dependencies
    playwright:
      patterns:
        - "playwright"
        - "pytest-playwright"
```

### Key Changes

1. **Package ecosystem**: `"pip"` → `"uv"`
2. **Directory**: `"/lib"` → `"/"` (root, where main pyproject.toml lives)
3. **Add dependency groups**: Group related packages for cleaner PRs

### Dependabot with `uv.lock`

If using a lock file, Dependabot will:
- Detect `uv.lock` and `pyproject.toml`
- Update versions in both files
- Create PRs with lock file changes

### Migration Checklist for Dependabot

- [ ] Change `package-ecosystem` from `"pip"` to `"uv"`
- [ ] Update `directory` from `"/lib"` to `"/"`
- [ ] Review and update `ignore` rules (dependency names may change)
- [ ] Add `groups` for related dependencies
- [ ] Test by manually triggering Dependabot after migration

---

## Setup.py and Release CI Migration Issues

This section documents all identified issues when migrating from `lib/setup.py` to `lib/pyproject.toml`, with solutions for each.

### Issue 1: VERSION Constant Migration

**Current Location:** `lib/setup.py` line 40

```python
VERSION = "1.53.0"  # PEP-440
```

**Problem:** Version is defined as a Python constant, used by:
- Release scripts for version bumping
- Conda recipe for version extraction
- Custom `VerifyVersionCommand` for validation

**Solution:**

In `lib/pyproject.toml`:
```toml
[project]
version = "1.53.0"
```

**Scripts to Update:**
- `scripts/update_version.py` - Update regex pattern (see Issue 8)
- `lib/streamlit/version.py` - Already uses `importlib.metadata`, no changes needed

---

### Issue 2: SNOWPARK_CONDA_BUILD Dynamic Dependencies

**Current Location:** `lib/setup.py` lines 96-101

```python
SNOWPARK_CONDA_EXCLUDED_DEPENDENCIES = [
    "watchdog>=2.1.5,<7",
]

if not os.getenv("SNOWPARK_CONDA_BUILD"):
    INSTALL_REQUIRES.extend(SNOWPARK_CONDA_EXCLUDED_DEPENDENCIES)
```

**Problem:** Conda builds exclude `watchdog` dependency dynamically at build time based on environment variable.

**Solutions:**

**Option A: Platform markers in pyproject.toml (Recommended)**
```toml
[project]
dependencies = [
    # ... other deps ...
    "watchdog>=2.1.5,<7; platform_system != 'Darwin'",
    # Note: This already exists for Darwin exclusion
]
```

For Conda-specific exclusion, handle in `meta.yaml` recipe instead.

**Option B: Handle in Conda recipe**
```yaml
# lib/conda-recipe/meta.yaml
requirements:
  run:
    - python >=3.10,<3.14
    # List all dependencies explicitly, excluding watchdog
    - altair >=4.0,<7,!=5.4.0,!=5.4.1
    # ... etc
```

**Recommendation:** Option B - Keep the Conda-specific logic in the Conda recipe where it belongs, rather than polluting the standard package definition.

---

### Issue 3: VerifyVersionCommand Custom Command

**Current Location:** `lib/setup.py` lines 155-175

```python
class VerifyVersionCommand(install):
    """Custom command to verify that the git tag matches VERSION."""

    def run(self):
        tag = os.getenv("CIRCLE_TAG") or os.getenv("TAG")
        if tag != VERSION:
            sys.exit(f"Git tag: {tag} != VERSION: {VERSION}")
```

**Problem:** Custom setuptools command used by CI to verify release version matches git tag.

**Solution:**

Create a standalone script `scripts/verify_version.py`:

```python
#!/usr/bin/env python
"""Verify that the git tag matches the package version."""

from __future__ import annotations

import os
import sys

if sys.version_info >= (3, 11):
    import tomllib
else:
    import tomli as tomllib


def main() -> None:
    """Verify git tag matches pyproject.toml version."""
    tag = os.getenv("CIRCLE_TAG") or os.getenv("TAG")
    if not tag:
        sys.exit("No CIRCLE_TAG or TAG environment variable set")

    with open("lib/pyproject.toml", "rb") as f:
        pyproject = tomllib.load(f)

    version = pyproject["project"]["version"]

    if tag != version:
        sys.exit(f"Git tag: {tag} != version: {version}")

    print(f"Version verified: {version}")


if __name__ == "__main__":
    main()
```

**Update release workflow** (`.github/workflows/release.yml`):
```yaml
# Replace:
# python setup.py verify
# With:
uv run python scripts/verify_version.py
```

---

### Issue 4: README.md Path Handling

**Current Location:** `lib/setup.py` lines 44-52

```python
THIS_DIR = os.path.abspath(os.path.dirname(__file__))

# Only set long_description if README exists (e.g. might not when installing)
readme_path = os.path.join(THIS_DIR, "..", "README.md")
if os.path.isfile(readme_path):
    with open(readme_path) as fh:
        LONG_DESCRIPTION = fh.read()
else:
    LONG_DESCRIPTION = DESCRIPTION
```

**Problem:** README.md is in the repo root but package is in `lib/`. The code handles missing README gracefully.

**Solution:**

In `lib/pyproject.toml`:
```toml
[project]
readme = { file = "../README.md", content-type = "text/markdown" }
```

**Note:** Modern build backends (setuptools >= 61) handle relative paths correctly. If issues occur during build, use `setuptools`'s `file:` directive or ensure build is run from correct directory.

**Alternative:** Copy README.md to lib/ during build:
```yaml
# In release workflow
- name: Prepare package
  run: |
    cp README.md lib/README.md
```

Then in `lib/pyproject.toml`:
```toml
readme = "README.md"
```

---

### Issue 5: Windows Script (bin/streamlit.cmd)

**Current Location:** `lib/setup.py` lines 187-189

```python
setup(
    # ...
    scripts=["bin/streamlit.cmd"] if platform.system() == "Windows" else [],
)
```

**Problem:** Windows batch script for CLI entry point is conditionally included.

**Solution:**

In `lib/pyproject.toml`, the `[project.scripts]` entry handles this:

```toml
[project.scripts]
streamlit = "streamlit.web.cli:main"
```

**Note:** Modern pip/uv creates platform-appropriate entry points automatically. The `bin/streamlit.cmd` is likely legacy and can be removed if `[project.scripts]` works correctly on Windows.

**Migration Steps:**
1. Test Windows installation with just `[project.scripts]`
2. If works, remove `lib/bin/streamlit.cmd` entirely
3. If still needed, add to package data:
   ```toml
   [tool.setuptools.package-data]
   streamlit = ["py.typed", "hello/**/*.py", "../bin/streamlit.cmd"]
   ```

---

### Issue 6: MANIFEST.in Conversion

**Current Location:** `lib/MANIFEST.in`

```
include lib/bin/streamlit.cmd
prune lib/streamlit/proto
prune lib/streamlit/vendor
```

**Problem:** MANIFEST.in controls source distribution contents; needs equivalent in pyproject.toml.

**Solution:**

For setuptools backend in `lib/pyproject.toml`:

```toml
[tool.setuptools]
include-package-data = true

[tool.setuptools.packages.find]
where = ["."]
include = ["streamlit*"]
exclude = ["tests", "tests.*"]

[tool.setuptools.package-data]
streamlit = [
    "py.typed",
    "hello/**/*.py",
    "static/**/*",
]

# Exclude proto source files from sdist (compiled .py files are included)
[tool.setuptools.exclude-package-data]
"*" = ["*.proto"]
```

**Alternative:** Keep `MANIFEST.in` - setuptools still respects it alongside pyproject.toml.

---

### Issue 7: Conda Recipe (`meta.yaml`) - CRITICAL

**Current Location:** `lib/conda-recipe/meta.yaml` lines 1-7

```yaml
{% set package_data = load_setup_py_data() %}

package:
  name: streamlit
  version: {{ package_data.get('version') }}
```

**Problem:** The Conda recipe uses `load_setup_py_data()` Jinja function to extract version and dependencies from `setup.py`. This will **break** when setup.py is removed.

**Solutions:**

**Option A: Use `load_file_data` with pyproject.toml (Recommended)**

```yaml
{% set pyproject = load_file_data('pyproject.toml', from_recipe_dir=True) %}
{% set version = pyproject.get('project', {}).get('version') %}

package:
  name: streamlit
  version: {{ version }}

requirements:
  host:
    - python >=3.10,<3.15
    - pip
    - setuptools >=65.5.1
  run:
    - python >=3.10,<3.15
    # List dependencies explicitly (see Option C for automation)
    - altair >=4.0,<7,!=5.4.0,!=5.4.1
    - blinker >=1.5.0,<2
    # ... all other runtime deps
```

**Option B: Hardcode version, use script for sync**

```yaml
{% set version = "1.53.0" %}

package:
  name: streamlit
  version: {{ version }}
```

Create `scripts/sync_conda_version.py` to update during release:
```python
# Update version in meta.yaml from pyproject.toml
```

**Option C: Generate requirements from pyproject.toml**

Create a script that reads `lib/pyproject.toml` and generates Conda-compatible requirements:

```python
# scripts/generate_conda_requirements.py
import tomllib

with open("lib/pyproject.toml", "rb") as f:
    pyproject = tomllib.load(f)

deps = pyproject["project"]["dependencies"]
# Convert pip syntax to conda syntax and output
```

**Recommendation:** Option A with explicit dependencies, plus a CI check that verifies Conda dependencies match pyproject.toml.

---

### Issue 8: update_version.py Script

**Current Location:** `scripts/update_version.py` lines 17-20

```python
PYTHON = {"lib/setup.py": r"(?P<pre>.*VERSION = \").*(?P<post>\"  # PEP-440$)"}
```

**Problem:** Uses regex to find and replace version in setup.py.

**Solution:**

Update the regex patterns for pyproject.toml:

```python
PYTHON = {
    "lib/pyproject.toml": r"(?P<pre>^version = \").*(?P<post>\"$)",
}
```

**Full updated script section:**

```python
# scripts/update_version.py

# Old:
# PYTHON = {"lib/setup.py": r"(?P<pre>.*VERSION = \").*(?P<post>\"  # PEP-440$)"}

# New:
PYTHON = {
    "lib/pyproject.toml": r'(?P<pre>^version = ").*(?P<post>"$)',
}

# Also update in JAVASCRIPT if needed:
# JAVASCRIPT = {"...": r"..."}
```

**Note:** The regex needs to handle TOML multiline properly. Test with:
```bash
uv run python scripts/update_version.py 1.54.0 --dry-run
```

---

### Issue 9: update_name.py Script

**Current Location:** Check `scripts/update_name.py`

**Problem:** May reference setup.py for package name changes.

**Solution:**

Update any references to use pyproject.toml:

```python
# Old pattern for setup.py
# r'name="streamlit"'

# New pattern for pyproject.toml
# r'name = "streamlit"'
```

**Verification:** Review `scripts/update_name.py` and update any setup.py references.

---

### Issue 10: sync_ruff_version.py Script

**Current Location:** `scripts/sync_ruff_version.py`

**Problem:** Syncs ruff version from `.ruff.toml` to `dev-requirements.txt`. After migration:
- Ruff config moves to `pyproject.toml` `[tool.ruff]`
- Dev requirements move to `pyproject.toml` `[dependency-groups]`

**Solution:**

Update script to read/write from root `pyproject.toml`:

```python
# scripts/sync_ruff_version.py

import re
import tomllib

def get_ruff_version_from_config() -> str:
    """Get the required-version from [tool.ruff] in pyproject.toml."""
    with open("pyproject.toml", "rb") as f:
        config = tomllib.load(f)
    return config["tool"]["ruff"]["required-version"]

def update_dependency_group_version(version: str) -> None:
    """Update ruff version in [dependency-groups] section."""
    with open("pyproject.toml") as f:
        content = f.read()

    # Update ruff version in dev group
    pattern = r'"ruff[^"]*"'
    replacement = f'"ruff=={version}"'
    content = re.sub(pattern, replacement, content)

    with open("pyproject.toml", "w") as f:
        f.write(content)
```

**Alternative:** Remove this script if ruff version is pinned in one place only (dependency groups).

---

### Issue 11: Makefile Package Target

**Current Location:** `Makefile` (package target)

```makefile
.PHONY: package
package: init frontend
	rm -rfv lib/build lib/dist
	cd lib ; python3 setup.py bdist_wheel sdist
```

**Problem:** Uses `setup.py` directly for building distribution packages.

**Solution:**

Update to use modern Python build:

```makefile
.PHONY: package
package: init frontend
	rm -rfv lib/build lib/dist
	cd lib && uv build
```

**Or using python-build:**
```makefile
.PHONY: package
package: init frontend
	rm -rfv lib/build lib/dist
	cd lib && python -m build
```

**Note:** Ensure `build` package is in dev dependencies:
```toml
[dependency-groups]
dev = [
    # ...
    "build",  # For python -m build
]
```

**With uv build, no extra dependency needed.**

---

### Issue 12: Release Workflow Dependencies

**Current Location:** `.github/workflows/release.yml`

The release workflow depends on:
1. `make package` (uses setup.py)
2. Version verification command
3. Twine for upload

**Solution:**

Update `.github/workflows/release.yml`:

```yaml
jobs:
  build:
    steps:
      - uses: actions/checkout@v4

      - uses: astral-sh/setup-uv@v7
        with:
          enable-cache: true

      - name: Verify version matches tag
        run: uv run python scripts/verify_version.py
        env:
          TAG: ${{ github.ref_name }}

      - name: Build package
        run: |
          cd lib
          uv build

      - name: Upload to PyPI
        run: |
          uv run twine upload lib/dist/*
        env:
          TWINE_USERNAME: __token__
          TWINE_PASSWORD: ${{ secrets.PYPI_TOKEN }}
```

---

### Migration Checklist for Setup.py/Release CI

**Phase 1: Preparation**
- [ ] Create `lib/pyproject.toml` with all metadata from setup.py
- [ ] Create `scripts/verify_version.py` standalone script
- [ ] Test local build with `cd lib && python -m build` or `uv build`

**Phase 2: Script Updates**
- [ ] Update `scripts/update_version.py` regex patterns
- [ ] Update `scripts/update_name.py` if needed
- [ ] Update `scripts/sync_ruff_version.py` for pyproject.toml
- [ ] Test all scripts with `--dry-run` flags

**Phase 3: Conda Recipe**
- [ ] Update `lib/conda-recipe/meta.yaml` to not use `load_setup_py_data()`
- [ ] List dependencies explicitly or use `load_file_data`
- [ ] Test Conda build locally

**Phase 4: Makefile**
- [ ] Update `package` target to use `uv build` or `python -m build`
- [ ] Test `make package` produces valid wheel and sdist

**Phase 5: CI/CD**
- [ ] Update `.github/workflows/release.yml` for new build process
- [ ] Update version verification step
- [ ] Test release process on a test branch/tag

**Phase 6: Cleanup**
- [ ] Remove `lib/setup.py` after all tests pass
- [ ] Remove `lib/MANIFEST.in` if redundant
- [ ] Remove `lib/bin/streamlit.cmd` if not needed
- [ ] Update documentation

---

## Summary

The recommended migration path is:

1. **Phase 1:** Convert `lib/setup.py` → `lib/pyproject.toml` (package definition)
2. **Phase 2:** Consolidate tool configs to root `pyproject.toml`
3. **Phase 3:** Update Makefile to use `uv` as default
4. **Phase 4:** Update CI/CD for new file locations
5. **Phase 5:** Documentation updates, including all `AGENTS.md` files to use `uv run` commands

This approach modernizes the Python packaging while maintaining compatibility with existing workflows and distribution channels. The migration can be done incrementally, with each phase independently testable.
