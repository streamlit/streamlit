---
author: lukasmasuch
created: 2025-01-27
status: Draft
---

# Environment Variables in Secrets

## Summary

Enable secrets configuration via environment variables to allow users to leverage existing secrets management infrastructure instead of relying solely on `secrets.toml` files. This spec evaluates four approaches and recommends a primary solution with a secondary option for advanced users.

## Problem

Streamlit's current secrets management requires credentials to be stored in `secrets.toml` files. While the [secrets documentation](https://docs.streamlit.io/develop/api-reference/connections/secrets.toml) states that "existing secrets management tools will work fine in Streamlit," the [authentication documentation](https://docs.streamlit.io/develop/concepts/connections/authentication) specifies that `st.login()` exclusively uses `secrets.toml` for configuration.

This creates friction for users deploying on platforms where secrets are injected as environment variables (Heroku, Azure App Service, AWS ECS, Kubernetes, Docker, etc.). Users must resort to workarounds like:

- Generating `secrets.toml` from environment variables at container startup
- Directly manipulating `secrets_singleton._secrets` at runtime
- Using `envsubst` with template files in Docker entrypoints

### Related Issues

| Issue                                                         | Upvotes | Description                                            |
| ------------------------------------------------------------- | ------- | ------------------------------------------------------ |
| [#10543](https://github.com/streamlit/streamlit/issues/10543) | 88+     | Set `[auth]` secrets config from environment variables |
| [#9016](https://github.com/streamlit/streamlit/issues/9016)   | —       | Cannot use kwargs only in Snowflake connection         |

### Goals

| Goal                                     | Outcome                                                            |
| ---------------------------------------- | ------------------------------------------------------------------ |
| Support environment variable injection   | Users can configure secrets via env vars without file manipulation |
| Enable existing secrets management tools | Works with Vault, AWS Secrets Manager, Azure Key Vault, etc.       |
| Support `st.login()` via env vars        | Authentication credentials can be injected at runtime              |
| Maintain backward compatibility          | Existing `secrets.toml` files continue to work unchanged           |
| Provide secure defaults                  | No new security risks introduced                                   |

### Non-Goals

| Out of Scope                      | Rationale                                                      |
| --------------------------------- | -------------------------------------------------------------- |
| Automatic env var watching/reload | Secrets are loaded at startup; env var changes require restart |
| Cross-secret references           | Only environment variables, not `${{secrets.other_key}}`       |
| Encryption/decryption             | Users should use external secrets managers for that            |

## Proposal

This section evaluates three approaches for enabling environment variable support in secrets. Each option is described with its syntax, behavior, pros, and cons.

---

### Option A: Placeholder Substitution in `secrets.toml`

Reference environment variables directly in `secrets.toml` using `${{VAR}}` syntax.

#### Example

```toml
# .streamlit/secrets.toml
[auth]
client_id = "${{OAUTH_CLIENT_ID}}"
client_secret = "${{OAUTH_CLIENT_SECRET}}"
redirect_uri = "${{OAUTH_REDIRECT_URI:-http://localhost:8501}}"

[database]
connection_string = "postgres://${{DB_USER}}:${{DB_PASS}}@${{DB_HOST}}/mydb"
```

#### Syntax

| Pattern             | Description                    | Example                      |
| ------------------- | ------------------------------ | ---------------------------- |
| `${{VAR}}`          | Substitute with env var value  | `${{API_KEY}}` → `"sk-xxx"`  |
| `${{VAR:-default}}` | Use default if env var not set | `${{PORT:-8501}}` → `"8501"` |
| `$${{VAR}}`         | Escaped, produces literal      | `$${{VAR}}` → `"${{VAR}}"`   |

#### Behavior

- **Missing env var without default**: Raises `StreamlitSecretNotFoundError` with clear message
- **Substitution timing**: Happens at parse time (when secrets are first accessed)
- **Scope**: Only string values are processed; numbers, booleans, arrays are unaffected
- **Nesting**: Works in nested sections and arrays of strings

#### Syntax Options

Several placeholder syntaxes were considered:

| Syntax       | Clash Risk   | Default Value Support | Notes                                                     |
| ------------ | ------------ | --------------------- | --------------------------------------------------------- |
| `${{VAR}}`   | **Very low** | `${{VAR:-default}}`   | Double braces; similar to GitHub Actions                  |
| `${env:VAR}` | **Very low** | `${env:VAR:-default}` | Explicit namespace; used in Azure DevOps, some CI systems |
| `${VAR}`     | Medium       | `${VAR:-default}`     | Shell-style; may conflict with shell expansion            |
| `{{VAR}}`    | Medium       | `{{VAR\|default}}`    | Jinja2-style; conflicts with templating                   |
| `$(VAR)`     | Medium       | N/A                   | Conflicts with shell command substitution                 |

**Recommendation: `${{VAR}}`** because:

- Double braces are extremely rare in actual configuration values
- Familiar to GitHub Actions users (`${{ secrets.TOKEN }}`)
- Clear `$` prefix indicates variable substitution
- Shorter than `${env:VAR}` for common use

**Alternative: `${env:VAR}`** is also a good choice because:

- Explicit about source being environment (vs. potential future `${secrets:OTHER_KEY}`)
- Used in Azure DevOps, Spring Boot, and other enterprise tools
- Namespace allows future extension
- Slightly more verbose but clearer intent

#### Default Value Syntax Options

The `:-` separator for default values comes from POSIX shell parameter expansion. Alternatives:

| Syntax              | Origin             | Example                             |
| ------------------- | ------------------ | ----------------------------------- |
| `${{VAR:-default}}` | POSIX shell        | Standard, widely recognized         |
| `${{VAR:default}}`  | Simplified         | Shorter, but `:` alone is ambiguous |
| `${{VAR\|default}}` | Jinja2/Django      | Common in templating                |
| `${{VAR??default}}` | C# null-coalescing | Less common                         |

**Recommendation: `:-`** because:

- POSIX standard, recognized by developers
- Used in Docker Compose, shell scripts, GitHub Actions
- Unambiguous (`:` alone could be part of the value)

#### Pros

- **Explicit**: Clear which values come from env vars
- **Flexible**: Supports string concatenation (`postgres://${{USER}}:${{PASS}}@host`)
- **Typed values**: Can combine with static TOML values (numbers, booleans, arrays)
- **Default values**: Built-in fallback mechanism
- **Familiar**: Similar to GitHub Actions, Docker Compose, shell syntax

#### Cons

- **Requires file**: Still need to maintain a `secrets.toml` file
- **Two-step process**: Must define structure in file, then set env vars
- **Not fully "file-free"**: Doesn't solve the "no secrets file" use case

---

### Option B: Prefixed Environment Variables

Automatically populate `st.secrets` from environment variables with the `STREAMLIT_SECRETS_` prefix. No `secrets.toml` file needed.

#### Example

```bash
# Environment variables
export STREAMLIT_SECRETS_AUTH__CLIENT_ID="your-client-id"
export STREAMLIT_SECRETS_AUTH__CLIENT_SECRET="your-secret"
export STREAMLIT_SECRETS_AUTH__REDIRECT_URI="https://myapp.example.com/callback"
export STREAMLIT_SECRETS_AUTH__COOKIE_SECRET="super-secret-cookie-key"
export STREAMLIT_SECRETS_DATABASE__HOST="localhost"
export STREAMLIT_SECRETS_API_KEY="sk-xxx"
```

```python
# Equivalent to secrets.toml:
# [auth]
# client_id = "your-client-id"
# client_secret = "your-secret"
# redirect_uri = "https://myapp.example.com/callback"
# cookie_secret = "super-secret-cookie-key"
#
# [database]
# host = "localhost"
#
# api_key = "sk-xxx"

st.secrets["auth"]["client_id"]      # "your-client-id"
st.secrets["auth"]["redirect_uri"]   # "https://myapp.example.com/callback"
st.secrets["api_key"]                # "sk-xxx"
```

#### Naming Convention

| Environment Variable                       | secrets.toml Equivalent                 |
| ------------------------------------------ | --------------------------------------- |
| `STREAMLIT_SECRETS_API_KEY`                | `api_key = "value"`                     |
| `STREAMLIT_SECRETS_AUTH__CLIENT_ID`        | `[auth]`<br>`client_id = "value"`       |
| `STREAMLIT_SECRETS_AUTH__REDIRECT_URI`     | `[auth]`<br>`redirect_uri = "value"`    |
| `STREAMLIT_SECRETS_CONNECTIONS__MYDB__URL` | `[connections.mydb]`<br>`url = "value"` |

**Conversion rules:**

1. **Prefix**: `STREAMLIT_SECRETS_`
2. **Section separator**: Double underscore (`__`) separates TOML sections
3. **Key names**: Single underscore (`_`) is preserved in key names
4. **Case**: Environment variable is UPPER_SNAKE_CASE; key names are **lowercased**

#### Multi-word Key Examples

Secret keys often use snake_case (e.g., `redirect_uri`, `cookie_secret`). The single underscore is preserved:

| Secret Key      | Environment Variable                    |
| --------------- | --------------------------------------- |
| `api_key`       | `STREAMLIT_SECRETS_API_KEY`             |
| `client_id`     | `STREAMLIT_SECRETS_AUTH__CLIENT_ID`     |
| `client_secret` | `STREAMLIT_SECRETS_AUTH__CLIENT_SECRET` |
| `redirect_uri`  | `STREAMLIT_SECRETS_AUTH__REDIRECT_URI`  |
| `cookie_secret` | `STREAMLIT_SECRETS_AUTH__COOKIE_SECRET` |
| `database_url`  | `STREAMLIT_SECRETS_DATABASE_URL`        |

#### Difference from Streamlit Config Environment Variables

Streamlit [configuration options](https://docs.streamlit.io/develop/concepts/configuration/options) use a similar pattern:

```bash
# Config: [server] port = 8501
STREAMLIT_SERVER_PORT=8501

# Config: [client] showErrorDetails = true
STREAMLIT_CLIENT_SHOW_ERROR_DETAILS=true
```

However, config keys use **camelCase** (e.g., `showErrorDetails`), so there's no ambiguity when converting to `UPPER_SNAKE_CASE`.

Secret keys typically use **snake_case** (e.g., `client_id`, `redirect_uri`), which creates ambiguity with a single underscore separator:

- Is `STREAMLIT_SECRETS_AUTH_CLIENT_ID` → `auth.client_id` or `auth_client.id`?

**Solution**: Use **double underscore** (`__`) for section separators in secrets:

- `STREAMLIT_SECRETS_AUTH__CLIENT_ID` → unambiguously `auth.client_id`

#### Pros

- **No file needed**: Works on platforms that don't support file mounting
- **Native integration**: Matches how Heroku, Azure App Service, AWS ECS inject secrets
- **12-factor compliance**: Follows [12-factor methodology](https://12factor.net/config)
- **No code changes**: Existing `st.secrets["auth"]["client_id"]` works unchanged
- **Simple setup**: Just set env vars, no file to manage

#### Cons

- **Strings only**: All values are strings; no numbers, booleans, or arrays
- **Verbose for deep nesting**: `STREAMLIT_SECRETS_A__B__C__D` becomes awkward
- **Case handling**: Key names are lowercased from UPPER_SNAKE_CASE
- **No defaults**: Must set all required env vars

---

### Option C: JSON Bulk Injection

Set all secrets at once via a single JSON environment variable.

#### Example

```bash
export STREAMLIT_SECRETS_JSON='{
  "auth": {
    "client_id": "your-client-id",
    "client_secret": "your-secret"
  },
  "database": {
    "host": "localhost",
    "port": 5432
  }
}'
```

#### Behavior

- Parses JSON and merges into secrets
- Supports all TOML-compatible types (strings, numbers, booleans, arrays, nested objects)
- Invalid JSON raises `StreamlitSecretNotFoundError` with parse error details

#### Pros

- **Typed values**: Supports numbers, booleans, arrays, nested objects
- **Single variable**: Easy to inject from secrets managers that output JSON
- **No file needed**: Works without `secrets.toml`
- **Complex structures**: Handles deeply nested configs elegantly

#### Cons

- **Hard to read**: JSON in env vars is error-prone and hard to debug
- **Escaping issues**: Quotes and special characters require careful escaping
- **Single point of failure**: One typo breaks all secrets
- **Not human-friendly**: Difficult to set/update individual values

---

### Option D: Programmatic Secrets via `st.App`

Pass secrets directly to the [`st.App`](https://github.com/streamlit/streamlit/pull/13449) constructor for programmatic configuration before server startup.

#### Example

```python
import os
import streamlit as st

# Load secrets from any source: env vars, Vault, AWS Secrets Manager, etc.
secrets = {
    "auth": {
        "client_id": os.environ["OAUTH_CLIENT_ID"],
        "client_secret": os.environ["OAUTH_CLIENT_SECRET"],
        "redirect_uri": "https://myapp.example.com/callback",
    },
    "database": {
        "host": "localhost",
        "port": 5432,  # Typed values supported
        "credentials": {
            "user": os.environ["DB_USER"],
            "password": os.environ["DB_PASS"],
        },
    },
}

app = st.App("main.py", secrets=secrets)
```

#### API

The `st.App` class accepts an optional `secrets` parameter:

```python
st.App(
    script_path: str | Path,
    *,
    secrets: dict[str, Any] | None = None,  # NEW
    lifespan: Callable[[App], AsyncContextManager[dict[str, Any] | None]] | None = None,
    routes: Sequence[BaseRoute] | None = None,
    middleware: Sequence[Middleware] | None = None,
    exception_handlers: Mapping[Any, ExceptionHandler] | None = None,
    debug: bool = False,
) -> App
```

#### Behavior

- **Merge precedence**: Secrets passed to `st.App` override values from `secrets.toml` files and environment variable sources
- **Deep merge**: Nested dictionaries are merged recursively (not replaced entirely)
- **Timing**: Secrets are injected before the runtime starts, ensuring `st.secrets` is fully populated when the script runs
- **Type support**: Supports all TOML-compatible types (strings, numbers, booleans, arrays, nested dicts)

#### Merge Order (lowest to highest priority)

```
1. secrets.toml files (existing behavior)
2. Placeholder substitution (${{VAR}}) — applied during file parsing
3. Prefixed env vars (STREAMLIT_SECRETS_*) — if implemented
4. JSON env var (STREAMLIT_SECRETS_JSON) — if implemented
5. st.App(secrets=...) — highest priority, always wins
```

#### Use Cases

##### External Secrets Manager Integration

```python
import streamlit as st
from my_vault_client import get_secrets

# Fetch secrets from HashiCorp Vault, AWS Secrets Manager, Azure Key Vault, etc.
vault_secrets = get_secrets("streamlit/myapp")

app = st.App("main.py", secrets=vault_secrets)
```

##### Dynamic Secrets at Startup

```python
import os
import streamlit as st
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app):
    # Secrets are already available here!
    print(f"Starting with client_id: {st.secrets['auth']['client_id'][:8]}...")
    yield

# Construct secrets programmatically
secrets = {
    "auth": {
        "client_id": os.environ["OAUTH_CLIENT_ID"],
        "client_secret": os.environ["OAUTH_CLIENT_SECRET"],
    }
}

app = st.App("main.py", secrets=secrets, lifespan=lifespan)
```

##### Testing with Mock Secrets

```python
import streamlit as st

# In test setup, inject test secrets without modifying files
test_secrets = {
    "auth": {
        "client_id": "test-client-id",
        "client_secret": "test-client-secret",
    },
    "database": {
        "url": "sqlite:///:memory:",
    },
}

app = st.App("main.py", secrets=test_secrets)
```

#### Pros

- **Full control**: Load secrets from any source with arbitrary logic
- **No file needed**: Works without `secrets.toml` for pure programmatic config
- **Typed values**: Supports all TOML-compatible types natively
- **Secrets manager friendly**: Natural fit for Vault, AWS Secrets Manager, etc.
- **Testable**: Easy to inject mock secrets in tests
- **Early availability**: Secrets available before runtime starts (in lifespan hooks)

#### Cons

- **Requires code changes**: Must use `st.App` instead of traditional `streamlit run`
- **Not declarative**: Secrets structure defined in code, not config file
- **Python-only**: Cannot be configured via CLI or environment alone

---

## Comparison

| Criteria                  | Option A: Placeholders | Option B: Prefixed Vars | Option C: JSON | Option D: st.App |
| ------------------------- | ---------------------- | ----------------------- | -------------- | ---------------- |
| No file needed            | ❌                     | ✅                      | ✅             | ✅               |
| Typed values              | ✅ (partial)           | ❌                      | ✅             | ✅               |
| Default values            | ✅                     | ❌                      | ❌             | ✅ (in code)     |
| Human readable            | ✅                     | ✅                      | ❌             | ✅               |
| String concatenation      | ✅                     | ❌                      | ❌             | ✅ (in code)     |
| 12-factor compliant       | ✅                     | ✅                      | ✅             | ✅               |
| Easy debugging            | ✅                     | ✅                      | ❌             | ✅               |
| Secrets manager friendly  | ❌                     | ❌                      | ✅             | ✅               |
| Platform compatibility    | High                   | Very High               | High           | Medium           |
| Implementation complexity | Low                    | Medium                  | Low            | Low              |
| Requires st.App           | ❌                     | ❌                      | ❌             | ✅               |

---

## Recommendation

**Implement Option A (Placeholder Substitution)** as the primary solution.

### Rationale

1. **Covers most use cases**: The majority of issue #10543 requests are about injecting credentials into `st.login()`, which Option A handles elegantly.

2. **Familiar pattern**: Placeholder syntax is widely used (GitHub Actions, Docker Compose, Kubernetes, Helm) and immediately understandable.

3. **Flexible**: Supports string concatenation for connection strings, default values for optional settings, and mixing with static TOML values.

4. **Low risk**: Minimal implementation complexity and no changes to secrets API.

5. **Already implemented**: A working implementation exists (see `lib/streamlit/runtime/secrets.py`).

### What Option A Solves

```toml
# .streamlit/secrets.toml
[auth]
redirect_uri = "https://myapp.example.com/oauth2callback"
client_id = "${{GOOGLE_CLIENT_ID}}"
client_secret = "${{GOOGLE_CLIENT_SECRET}}"
```

```python
import streamlit as st

st.login()  # Works! Credentials injected from env vars.
```

### What Option A Doesn't Solve

- Users who want **zero files** (pure env-var configuration) would need Option B or D.
- Users integrating with **external secrets managers** (Vault, AWS Secrets Manager) would benefit from Option D's programmatic approach.

### Secondary Recommendation: Option D for Advanced Users

For users adopting [`st.App`](https://github.com/streamlit/streamlit/pull/13449), **Option D** provides maximum flexibility:

```python
import os
import streamlit as st
from my_secrets_client import fetch_secrets

# Load from any source: env vars, Vault, AWS Secrets Manager, etc.
app = st.App("main.py", secrets=fetch_secrets("streamlit/myapp"))
```

This is particularly valuable for:

- Enterprise deployments with centralized secrets management
- Testing scenarios requiring mock secrets
- Applications needing secrets available in lifespan hooks (before first request)

---

## Combining Options

The options are not mutually exclusive. If broader support is desired, multiple options could be implemented with the following precedence (later overrides earlier):

```
1. secrets.toml files (existing behavior)
2. Placeholder substitution (${{VAR}}) — applied during file parsing
3. Prefixed env vars (STREAMLIT_SECRETS_*) — merged after file parsing
4. JSON env var (STREAMLIT_SECRETS_JSON) — merged after prefixed vars
5. st.App(secrets=...) — highest priority, always wins
```

This would allow users to:

- Use placeholders for most cases (Option A)
- Override individual values via prefixed env vars (Option B)
- Bulk-inject from secrets managers via JSON (Option C)
- Programmatically inject secrets with full control via `st.App` (Option D)

**Note**: Implementing multiple options increases complexity and testing surface. Starting with Option A alone may be preferable, with Option D added when `st.App` becomes generally available, and other options added based on user feedback.

---

## Error Handling

| Scenario                                 | Behavior                                                        |
| ---------------------------------------- | --------------------------------------------------------------- |
| Missing env var (no default)             | `StreamlitSecretNotFoundError` with variable name and file path |
| Invalid JSON in `STREAMLIT_SECRETS_JSON` | `StreamlitSecretNotFoundError` with JSON parse error            |
| Invalid prefixed env var name            | Silently ignored                                                |

Error message example:

```
Environment variable "OAUTH_CLIENT_SECRET" referenced in secrets at
"/app/.streamlit/secrets.toml" is not set. Set the environment variable
or provide a default value using ${{VAR:-default}} syntax.
```

---

## Security Considerations

| Concern                                       | Mitigation                                                  |
| --------------------------------------------- | ----------------------------------------------------------- |
| Env vars visible in process listings          | Same risk as any env var; users should use secrets managers |
| Logging env var values                        | Streamlit never logs secret values                          |
| Secrets in error messages                     | Only variable names shown, never values                     |
| Accidental exposure in `st.write(st.secrets)` | Existing behavior; users are responsible                    |

The security model is unchanged: users are responsible for protecting their secrets. This feature simply provides more flexibility in _how_ secrets are provided to Streamlit.

---

## Examples

### Example 1: `st.login()` with Environment Variables (Option A)

```toml
# .streamlit/secrets.toml
[auth]
redirect_uri = "https://myapp.example.com/oauth2callback"
client_id = "${{GOOGLE_CLIENT_ID}}"
client_secret = "${{GOOGLE_CLIENT_SECRET}}"
```

```python
import streamlit as st

st.login()  # Works with env vars!

if st.user:
    st.write(f"Welcome, {st.user.name}!")
```

### Example 2: Database Connection with Concatenation (Option A)

```toml
# .streamlit/secrets.toml
[connections.mydb]
url = "postgresql://${{DB_USER}}:${{DB_PASS}}@${{DB_HOST:-localhost}}/${{DB_NAME}}"
```

```python
import streamlit as st

conn = st.connection("mydb")
df = conn.query("SELECT * FROM users")
```

### Example 3: Heroku Deployment (Option B, if implemented)

```bash
# Heroku config vars
heroku config:set STREAMLIT_SECRETS_AUTH__CLIENT_ID="xxx"
heroku config:set STREAMLIT_SECRETS_AUTH__CLIENT_SECRET="yyy"
```

No `secrets.toml` file needed in the repository.

### Example 4: AWS Secrets Manager Integration (Option D)

```python
# app.py
import json
import boto3
import streamlit as st

def get_aws_secrets(secret_name: str) -> dict:
    """Fetch secrets from AWS Secrets Manager."""
    client = boto3.client("secretsmanager")
    response = client.get_secret_value(SecretId=secret_name)
    return json.loads(response["SecretString"])

# Load secrets from AWS before server starts
aws_secrets = get_aws_secrets("prod/streamlit/myapp")

app = st.App("dashboard.py", secrets=aws_secrets)

# Run with: uvicorn app:app
```

### Example 5: HashiCorp Vault Integration (Option D)

```python
# app.py
import os
import hvac
import streamlit as st

def get_vault_secrets(path: str) -> dict:
    """Fetch secrets from HashiCorp Vault."""
    client = hvac.Client(url="https://vault.example.com")
    client.auth.approle.login(
        role_id=os.environ["VAULT_ROLE_ID"],
        secret_id=os.environ["VAULT_SECRET_ID"],
    )
    secret = client.secrets.kv.v2.read_secret_version(path=path)
    return secret["data"]["data"]

app = st.App(
    "dashboard.py",
    secrets={
        "auth": get_vault_secrets("streamlit/auth"),
        "database": get_vault_secrets("streamlit/database"),
    },
)
```

### Example 6: Testing with Mock Secrets (Option D)

```python
# test_app.py
import pytest
from httpx import ASGITransport, AsyncClient
import streamlit as st

@pytest.fixture
def test_app():
    """Create app with test secrets."""
    return st.App(
        "dashboard.py",
        secrets={
            "auth": {
                "client_id": "test-client-id",
                "client_secret": "test-secret",
            },
            "database": {
                "url": "sqlite:///:memory:",
            },
        },
    )

@pytest.mark.anyio
async def test_health_endpoint(test_app):
    async with AsyncClient(
        transport=ASGITransport(app=test_app),
        base_url="http://test",
    ) as client:
        response = await client.get("/_stcore/health")
        assert response.status_code == 200
```

---

## Checklist

| Item                       | ✅ or comment                                                          |
| -------------------------- | ---------------------------------------------------------------------- |
| Works on SiS, Cloud, etc?  | ✅ Works everywhere; SiS/Cloud may have own env var injection          |
| No breaking API changes    | ✅ All mechanisms are additive; existing behavior unchanged            |
| No new dependencies        | ✅ Uses only stdlib (`re`, `os`, `json`)                               |
| Metrics collected          | Consider tracking: placeholder usage count, env var secrets count      |
| Any security/legal impact? | No new security risks; env vars are standard practice                  |
| Any docs changes needed?   | Yes: Update secrets.toml docs, authentication guide, deployment guides |
