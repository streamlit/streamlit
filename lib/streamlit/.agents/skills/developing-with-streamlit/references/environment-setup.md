
# Streamlit environment

Use whatever dependency management the project already has (pip, poetry, conda, etc.). If starting fresh and uv is available, it's a good default—fast, reliable, and creates isolated environments automatically.

If uv is not installed, ask the user before installing it.

## CRITICAL: Always Use Latest Streamlit

**Always specify the latest version of `streamlit`** in dependencies. Many Streamlit features and patterns in these skills require recent versions. Older streamlit versions will cause errors with:
- Material icons (`:material/icon_name:`)
- `st.pills()`, `st.segmented_control()`
- Modern caching decorators
- Navigation APIs

When setting up a new project or fixing an existing one, **always check and update the streamlit version**.

## Using uv

If uv is available, here's how to set up a Streamlit project.

### Quick start (venv only)

For simple apps, just create a virtual environment:

```bash
uv venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
uv pip install streamlit
```

Run with:

```bash
streamlit run streamlit_app.py
```

## Full project setup

For larger projects or when you need reproducible builds:

```bash
uv init my-streamlit-app
cd my-streamlit-app
uv add streamlit
```

This creates:
- `pyproject.toml` with dependencies
- `uv.lock` for reproducible builds
- `.venv/` virtual environment

Run with:

```bash
uv run streamlit run streamlit_app.py
```

## With options

Avoid setting options unless you have a specific reason:

```bash
streamlit run streamlit_app.py --server.headless true  # Only for automated/CI environments
```

## Add dependencies

```bash
# With venv approach
uv pip install plotly snowflake-connector-python

# With full project (uv init)
uv add plotly snowflake-connector-python
```

## Project structure

Keep it simple. For most apps:

```
my-streamlit-app/
├── .venv/
└── streamlit_app.py
```

Only add more when needed:
- `app_pages/` → Only for multi-page apps
- `.streamlit/config.toml` → Only if customizing theme or settings
- `.streamlit/secrets.toml` → Only if using secrets (add to `.gitignore`)
- `pyproject.toml` → Only if using `uv init` for reproducible builds

## Convention

Name your main file `streamlit_app.py` for consistency. This is what Streamlit expects by default.

**What goes in the main module:**
- When using navigation: it's a router that defines pages and runs them
- When there's no navigation: it's the home page with your main content

## pyproject.toml Example

```toml
[project]
name = "my-streamlit-app"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "streamlit",
    "plotly>=5.0.0",
    "snowflake-connector-python>=3.0.0",
]

[dependency-groups]
dev = [
    "pytest>=8.0.0",
    "ty",
]
```

## Type checking

After editing app Python, type-check the changed files. Streamlit's public API is typed, so wrong API use is reported before the app runs. Use the project's configured checker if it has one. Otherwise use `ty` (recommended), or `mypy` when `ty` is unavailable.

Add a checker as a dev dependency only when the project does not already have one:

```bash
uv add --dev ty
uv run ty check streamlit_app.py
```

If `ty` is unavailable, use `mypy` instead:

```bash
uv add --dev mypy
uv run mypy streamlit_app.py
```

`uv run ty check` with no paths checks the project. Pass the edited files to check only those. With a plain virtual environment, install the checker the same way as other tools (`uv pip install ty` or `uv pip install mypy`) and run `ty check` or `mypy`.

## References

- [uv documentation](https://docs.astral.sh/uv/)
- [Streamlit installation](https://docs.streamlit.io/get-started/installation)
