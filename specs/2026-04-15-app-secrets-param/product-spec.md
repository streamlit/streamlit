---
author: lukasmasuch
created: 2026-04-15
---

# Secrets parameter for st.App

## Summary

Add a `secrets` parameter to `st.App` that accepts a dictionary to programmatically configure
secrets at runtime, enabling integration with external secrets managers and environment variables
without requiring `secrets.toml` files.

## Problem

Streamlit's current secrets management requires a `secrets.toml` file, but many deployment
platforms inject credentials via environment variables (Heroku, AWS ECS, Kubernetes, Azure App
Service). Users face friction when deploying outside Streamlit Cloud.

**GitHub Issues:**

- [#10543](https://github.com/streamlit/streamlit/issues/10543) — "Set [auth] secrets config from
  environment variables or through st.login"

**Current workarounds (from issue comments):**

1. Manipulate private `st.secrets._secrets` directly (fragile, unsupported)
2. Generate `secrets.toml` at runtime via shell scripts (`envsubst`)
3. Populate secrets programmatically at startup before importing Streamlit

**Use cases:**

- Load OAuth credentials from AWS Secrets Manager, HashiCorp Vault, or GCP Secret Manager
- Read secrets from environment variables in containerized deployments
- Support hybrid configurations (some secrets in files, some from external sources)
- Enable programmatic secrets setup in testing environments

## Proposal

### API

Add a `secrets` parameter to `st.App`:

```python
class App:
    def __init__(
        self,
        script_path: str | Path,
        *,
        secrets: Mapping[str, Any] | None = None,  # NEW
        lifespan: ... = None,
        routes: ... = None,
        middleware: ... = None,
        exception_handlers: ... = None,
        debug: bool = False,
    ) -> None:
```

**Parameter:**

- `secrets : Mapping[str, Any] | None`
  A dictionary of secrets to make available via `st.secrets`. Supports nested dictionaries for
  sections (e.g., `{"auth": {"client_id": "..."}}`). When provided, these secrets are merged with
  any file-based secrets, with programmatic secrets taking precedence.

### Behavior

1. **Precedence order** (later sources override earlier):
   1. Global `~/.streamlit/secrets.toml`
   2. Project `.streamlit/secrets.toml`
   3. `secrets` parameter passed to `st.App`

2. **Type preservation:** Values retain their Python types (strings, ints, bools, nested dicts).
   No TOML parsing required.

3. **Environment variable promotion:** Top-level string/int/float secrets are promoted to
   `os.environ` (same as file-based secrets).

4. **File watcher:** File-based secrets continue to support hot-reload. Programmatic secrets are
   static for the lifetime of the `App` instance.

5. **Thread safety:** The secrets store remains thread-safe.

### Examples

**Basic usage with environment variables:**

```python
import os
from streamlit.web.server.starlette import App

app = App(
    "main.py",
    secrets={
        "database": {
            "host": os.environ["DB_HOST"],
            "password": os.environ["DB_PASSWORD"],
        }
    }
)
```

**With external secrets manager (AWS):**

```python
import boto3
import json
from streamlit.web.server.starlette import App

def load_secrets():
    client = boto3.client("secretsmanager")
    response = client.get_secret_value(SecretId="my-streamlit-app")
    return json.loads(response["SecretString"])

app = App("main.py", secrets=load_secrets())
```

**Hybrid: file-based + programmatic:**

```python
# .streamlit/secrets.toml contains:
# [general]
# app_name = "My App"

# main_app.py
from streamlit.web.server.starlette import App
import os

# Programmatic secrets override/extend file-based
app = App(
    "main.py",
    secrets={
        "auth": {
            "client_id": os.environ["OAUTH_CLIENT_ID"],
            "client_secret": os.environ["OAUTH_CLIENT_SECRET"],
        }
    }
)

# In the Streamlit script:
# st.secrets["general"]["app_name"]  -> "My App" (from file)
# st.secrets["auth"]["client_id"]    -> from environment (programmatic)
```

### Error Handling

- Invalid types in `secrets` dict raise `TypeError` at `App` construction
- Accessing non-existent keys continues to raise `KeyError`/`AttributeError` with existing
  helpful messages

## Alternatives Considered

**Option A: Placeholder substitution in secrets.toml**

```toml
client_id = "${{OAUTH_CLIENT_ID}}"
```

- Pros: Familiar pattern (GitHub Actions, Docker Compose)
- Cons: Still requires files, doesn't support external secrets managers

**Option B: Prefixed environment variables**

```bash
STREAMLIT_SECRETS_AUTH__CLIENT_ID=...
```

- Pros: No code changes needed
- Cons: Awkward naming convention, only strings supported, no programmatic control

**Option C: JSON bulk injection**

```bash
STREAMLIT_SECRETS_JSON='{"auth": {"client_id": "..."}}'
```

- Pros: Single variable
- Cons: Hard to read/debug, escaping issues

**Why `secrets` parameter is preferred:**

- Maximum flexibility for any secrets source
- Type-safe (no string-only limitation)
- Explicit over implicit (no magic environment variable parsing)
- Follows Python idioms (pass configuration as parameters)
- Works with `st.App`'s lifespan for async secrets loading
- No file system requirements

## Out of Scope (Future Work)

- **Secrets refresh/rotation during runtime** — Complex lifecycle management, can be added later
  based on demand
- **Built-in integrations for specific secrets managers** — Users can implement via the
  `secrets` parameter; first-party integrations can be added if patterns emerge
- **Placeholder substitution in `secrets.toml`** — Could be added alongside this feature if there's
  demand for file-based variable expansion

## Checklist

| Item                         | Status                                                     |
|------------------------------|------------------------------------------------------------|
| Works on SiS, Cloud, etc?    | ✅ `st.App` is ASGI-compatible                             |
| No breaking API changes      | ✅ New optional parameter only                             |
| No new dependencies          | ✅                                                         |
| Metrics collected            | ⚠️ `st.App` is not currently tracked via metrics           |
| Any security/legal impact?   | ✅ No, follows existing patterns                           |
| Any docs changes needed?     | ✅ Update secrets and `st.App` docs                        |
