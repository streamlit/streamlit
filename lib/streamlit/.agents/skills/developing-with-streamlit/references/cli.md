
# Using the Streamlit CLI

The Streamlit CLI is the primary tool for running Streamlit applications and managing configuration. This skill covers all essential commands and configuration options.

## Running Streamlit apps

### Basic syntax

```bash
streamlit run [<entrypoint>] [-- config options] [script args]
```

### Entrypoint options

| Argument | Behavior |
|----------|----------|
| (none) | Looks for `streamlit_app.py` in current directory |
| Directory path | Runs `streamlit_app.py` within that directory |
| File path | Runs the specified file directly |
| URL | Runs a remote script (e.g., from GitHub) |

### Examples

```bash
# Run default app in current directory
streamlit run

# Run a specific file
streamlit run app.py

# Run from a URL
streamlit run https://raw.githubusercontent.com/streamlit/demo-uber-nyc-pickups/master/streamlit_app.py

# Alternative: run as Python module (useful for IDE configuration)
python -m streamlit run app.py
```

### Running with `uv` (recommended)

Use `uv run` to run Streamlit in a virtual environment with automatic dependency management:

```bash
# Run with uv (automatically uses/creates virtual environment)
uv run streamlit run app.py

# With configuration options
uv run streamlit run app.py --server.headless=true

# With script arguments
uv run streamlit run app.py -- arg1 arg2
```

Using `uv run` is the recommended approach because it:
- Automatically manages virtual environments
- Resolves and installs dependencies from `pyproject.toml`
- Ensures reproducible environments across machines
- Avoids manual activation/deactivation of virtual environments

## Setting configuration with `streamlit run`

Configuration options follow the pattern `--<section>.<option>=<value>` and must come after the script name.

> **Recommendation:** For persistent configuration, use `.streamlit/config.toml` in your project directory instead of command-line flags. This keeps your run command simple and makes configuration easier to manage and share with your team.

### Examples

```bash
streamlit run app.py --server.port=8080
streamlit run app.py --server.headless=true
streamlit run app.py --server.runOnSave=true
streamlit run app.py --server.address=0.0.0.0
streamlit run app.py --client.showErrorDetails=false
streamlit run app.py --theme.primaryColor=blue
```

### Combining multiple options

```bash
streamlit run app.py \
    --server.port=8080 \
    --server.headless=true \
    --theme.primaryColor=blue \
    --client.showErrorDetails=false
```

## Passing arguments to your script

Script arguments come after configuration options. Use `sys.argv` to access them:

```bash
streamlit run app.py -- arg1 arg2 "arg with spaces"
```

In your script:

```python
import sys

# sys.argv[0] = script path
# sys.argv[1:] = your arguments
args = sys.argv[1:]
```

## Other CLI commands

### View configuration

```bash
# Show all current configuration settings
streamlit config show
```

### Cache management

```bash
# Clear all cached data from disk
streamlit cache clear
```

### Diagnostics and help

```bash
# Show installed version
streamlit version

# List all available commands
streamlit help

# Open documentation in browser
streamlit docs
```

### Project scaffolding

```bash
# Create starter files for a new project
streamlit init
```

### Demo app

```bash
# Launch the Streamlit demo application
streamlit hello
```

## Configuration precedence

Configuration can be set in multiple places. Order of precedence (highest to lowest):

1. **Command-line flags** (`--server.port=8080`)
2. **Environment variables** (`STREAMLIT_SERVER_PORT=8080`)
3. **Local config** (`.streamlit/config.toml` in project directory)
4. **Global config** (`~/.streamlit/config.toml`)

## References

- [Run your app](https://docs.streamlit.io/develop/concepts/architecture/run-your-app) - Concepts and methods for running Streamlit apps
- [config.toml](https://docs.streamlit.io/develop/api-reference/configuration/config.toml) - Complete configuration options reference
- [CLI reference](https://docs.streamlit.io/develop/api-reference/cli) - Full CLI command documentation
