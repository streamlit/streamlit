# Feature: Allow Passing Auth Configuration via `st.login`

## GitHub Issue Summary

**Issue:** [#10543 - Environment Variable Support for Authentication Secrets](https://github.com/streamlit/streamlit/issues/10543)

**Problem Statement:**
Users want to configure `st.login()` authentication settings via environment variables or programmatically instead of being limited to `.streamlit/secrets.toml`. This creates friction for:

- **Heroku deployments**: Requires environment variable injection
- **Azure App Service**: No native secrets file support
- **Kubernetes/Docker**: Prefer standard secrets management tools
- **CI/CD pipelines**: Configuration comes from environment variables

**Current Workarounds (all problematic):**
1. **Private API manipulation**: `secrets_singleton._secrets = {"auth": {...}}` - Relies on implementation details
2. **Docker template substitution**: Using `envsubst` on a `secrets.tmpl.toml` - Complex setup
3. **File generation at runtime**: Writing `secrets.toml` programmatically before app starts

---

## Current Architecture

### How `st.login()` Works

1. **Entry Point**: `lib/streamlit/user_info.py:56` - `login(provider: str | None = None)`
2. **Validation**: `lib/streamlit/auth_util.py:422` - `validate_auth_credentials(provider)` checks secrets.toml
3. **OAuth Client Creation**: `lib/streamlit/web/server/oauth_authlib_routes.py:43` - `create_oauth_client(provider)` reads from `get_secrets_auth_section()`
4. **Secrets Access**: `lib/streamlit/auth_util.py:95` - `get_secrets_auth_section()` wraps `secrets_singleton.get("auth")`

### Key Files

| File | Purpose |
|------|---------|
| `lib/streamlit/user_info.py` | `login()`, `logout()`, `st.user` implementation |
| `lib/streamlit/auth_util.py` | Auth validation, credential retrieval, helpers |
| `lib/streamlit/runtime/secrets.py` | Secrets loading from TOML/directories |
| `lib/streamlit/web/server/oauth_authlib_routes.py` | Tornado OIDC handlers |
| `lib/streamlit/web/server/starlette/starlette_auth_routes.py` | Starlette OIDC handlers |

### Required Auth Configuration

```toml
[auth]
redirect_uri = "http://localhost:8501/oauth2callback"
cookie_secret = "randomly-generated-secret"
expose_tokens = ["id", "access"]  # Optional

# For default provider:
client_id = "xxx"
client_secret = "xxx"
server_metadata_url = "https://accounts.google.com/.well-known/openid-configuration"

# OR for named providers:
[auth.google]
client_id = "xxx"
client_secret = "xxx"
server_metadata_url = "..."
```

---

## Proposed Solution: `**kwargs` in `st.login()`

Add `**extra_config` to `st.login()` to accept auth configuration as keyword arguments:

```python
def login(
    provider: str | None = None,
    **extra_config: Any,
) -> None:
```

### Example Usage

```python
import os
import streamlit as st

# Pass config directly as kwargs
st.login(
    redirect_uri=os.getenv("REDIRECT_URI", "http://localhost:8501/oauth2callback"),
    cookie_secret=os.getenv("COOKIE_SECRET"),
    client_id=os.getenv("OIDC_CLIENT_ID"),
    client_secret=os.getenv("OIDC_CLIENT_SECRET"),
    server_metadata_url=os.getenv("OIDC_METADATA_URL"),
)

# Or unpack a dict
config = {
    "redirect_uri": os.getenv("REDIRECT_URI"),
    "cookie_secret": os.getenv("COOKIE_SECRET"),
    "client_id": os.getenv("CLIENT_ID"),
    "client_secret": os.getenv("CLIENT_SECRET"),
    "server_metadata_url": os.getenv("OIDC_METADATA_URL"),
}
st.login(**config)

# With a named provider
st.login(
    provider="google",
    redirect_uri=os.getenv("REDIRECT_URI"),
    cookie_secret=os.getenv("COOKIE_SECRET"),
    client_id=os.getenv("GOOGLE_CLIENT_ID"),
    client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
)

# Nested config for client_kwargs
st.login(
    redirect_uri="http://localhost:8501/oauth2callback",
    cookie_secret="my-secret",
    client_id="xxx",
    client_secret="xxx",
    server_metadata_url="https://...",
    client_kwargs={"scope": "openid email", "prompt": "consent"},
)
```

### Behavior

1. **If `extra_config` is provided**: Use kwargs as auth config, ignore secrets.toml
2. **If `extra_config` is empty**: Fall back to existing secrets.toml behavior (backward compatible)
3. **Config is stored at app level**: Persists across reruns within the same app session

---

## Implementation Plan

### Step 1: Add Config Storage (`lib/streamlit/auth_util.py`)

Add module-level storage for programmatic auth config:

```python
# Module-level storage for programmatic auth config
_programmatic_auth_config: dict[str, Any] | None = None


def set_programmatic_auth_config(config: dict[str, Any]) -> None:
    """Store auth config passed via st.login(**kwargs)."""
    global _programmatic_auth_config
    _programmatic_auth_config = config


def get_programmatic_auth_config() -> dict[str, Any] | None:
    """Get programmatically set auth config, if any."""
    return _programmatic_auth_config


def clear_programmatic_auth_config() -> None:
    """Clear programmatic auth config."""
    global _programmatic_auth_config
    _programmatic_auth_config = None
```

### Step 2: Update `get_secrets_auth_section()` (`lib/streamlit/auth_util.py`)

Modify to check programmatic config first:

```python
def get_secrets_auth_section() -> AttrDict:
    """Get the 'auth' section - from programmatic config or secrets.toml."""
    # Check for programmatic config first
    programmatic_config = get_programmatic_auth_config()
    if programmatic_config:
        return AttrDict(programmatic_config)

    # Fall back to secrets.toml
    auth_section = AttrDict({})
    if secrets_singleton.load_if_toml_exists():
        auth_section = cast("AttrDict", secrets_singleton.get("auth", AttrDict({})))
    return auth_section
```

### Step 3: Update `login()` Function (`lib/streamlit/user_info.py`)

Add `**extra_config` parameter:

```python
@gather_metrics("login")
def login(provider: str | None = None, **extra_config: Any) -> None:
    """Initiate the login flow for the given provider.

    ...existing docstring...

    Parameters
    ----------
    provider : str or None
        The name of your provider configuration to use for login.
    **extra_config : Any
        Optional auth configuration as keyword arguments. If provided,
        these settings are used instead of secrets.toml. Supported keys:
        redirect_uri, cookie_secret, client_id, client_secret,
        server_metadata_url, client_kwargs, expose_tokens.

    Examples
    --------
    Using environment variables::

        st.login(
            redirect_uri=os.getenv("REDIRECT_URI"),
            cookie_secret=os.getenv("COOKIE_SECRET"),
            client_id=os.getenv("CLIENT_ID"),
            client_secret=os.getenv("CLIENT_SECRET"),
            server_metadata_url=os.getenv("METADATA_URL"),
        )
    """
    if provider is None:
        provider = "default"

    # Store programmatic config if provided
    if extra_config:
        set_programmatic_auth_config(extra_config)

    # ... rest of existing implementation
```

### Step 4: Update `validate_auth_credentials()` (`lib/streamlit/auth_util.py`)

Skip secrets.toml requirement when programmatic config exists:

```python
def validate_auth_credentials(provider: str) -> None:
    """Validate auth credentials for the given provider."""

    # Check for programmatic config first
    programmatic_config = get_programmatic_auth_config()
    if programmatic_config:
        # Validate programmatic config has required keys
        auth_section = AttrDict(programmatic_config)
        _validate_auth_section(auth_section, provider)
        return

    # Existing secrets.toml validation...
    if not secrets_singleton.load_if_toml_exists():
        raise StreamlitAuthError(...)
    # ... rest of existing validation


def _validate_auth_section(auth_section: AttrDict, provider: str) -> None:
    """Validate an auth section has required keys."""
    if "redirect_uri" not in auth_section:
        raise StreamlitAuthError(
            'Authentication config is missing the "redirect_uri" key.'
        )
    if "cookie_secret" not in auth_section:
        raise StreamlitAuthError(
            'Authentication config is missing the "cookie_secret" key.'
        )

    # Validate provider section
    provider_section = auth_section.get(provider)
    if provider_section is None and provider == "default":
        provider_section = generate_default_provider_section(auth_section)

    if provider_section is None:
        raise StreamlitAuthError(
            f'Authentication config is missing settings for provider "{provider}".'
        )

    required_keys = ["client_id", "client_secret", "server_metadata_url"]
    missing_keys = [key for key in required_keys if key not in provider_section]
    if missing_keys:
        raise StreamlitAuthError(
            f"Authentication config is missing keys: {missing_keys}"
        )
```

### Step 5: Update `get_signing_secret()` (`lib/streamlit/auth_util.py`)

Check programmatic config for cookie_secret:

```python
def get_signing_secret() -> str:
    """Get the cookie signing secret."""
    signing_secret: str = config.get_option("server.cookieSecret")

    # Check programmatic config first
    programmatic_config = get_programmatic_auth_config()
    if programmatic_config and "cookie_secret" in programmatic_config:
        return programmatic_config["cookie_secret"]

    # Fall back to secrets.toml
    if secrets_singleton.load_if_toml_exists():
        auth_section = secrets_singleton.get("auth")
        if auth_section:
            signing_secret = auth_section.get("cookie_secret", signing_secret)
    return signing_secret
```

### Step 6: Update OAuth Client Creation

Both `oauth_authlib_routes.py` and `starlette_auth_routes.py` use `get_secrets_auth_section()`, which will automatically pick up the programmatic config after Step 2. No changes needed if Step 2 is implemented correctly.

---

## Files to Modify

| File | Changes |
|------|---------|
| `lib/streamlit/user_info.py` | Add `**extra_config` to `login()`, call `set_programmatic_auth_config()` |
| `lib/streamlit/auth_util.py` | Add config storage functions, update `get_secrets_auth_section()`, `get_signing_secret()`, `validate_auth_credentials()` |
| `lib/tests/streamlit/user_info_test.py` | Add tests for `login()` with kwargs |
| `lib/tests/streamlit/auth_util_test.py` | Add tests for programmatic config storage |

---

## Testing Plan

### Unit Tests

1. **`login()` with kwargs**:
   - Test that kwargs are stored as programmatic config
   - Test that empty kwargs fall back to secrets.toml
   - Test validation errors for missing required keys

2. **Config storage**:
   - Test `set_programmatic_auth_config()` / `get_programmatic_auth_config()`
   - Test that config persists across calls
   - Test `clear_programmatic_auth_config()`

3. **`get_secrets_auth_section()`**:
   - Test returns programmatic config when set
   - Test falls back to secrets.toml when not set

4. **`validate_auth_credentials()`**:
   - Test validation with programmatic config
   - Test error messages for missing keys

### E2E Tests

- Test full login flow with programmatic config
- Test that config persists across app reruns

---

## Security Considerations

1. **No logging of secrets**: Ensure `client_secret` and `cookie_secret` are never logged
2. **Validation**: Validate required fields are present before attempting OAuth flow
3. **Documentation**: Note that `redirect_uri` should use HTTPS in production

---

## Open Questions

1. **Config persistence scope**: Currently proposing module-level (app lifetime). Should it be session-scoped instead?
   - Recommendation: App lifetime is simpler and matches secrets.toml behavior

2. **Merging vs. replacing**: Should kwargs merge with secrets.toml or completely replace?
   - Recommendation: Complete replacement for simplicity and predictability

3. **`st.logout()` behavior**: Should logout clear programmatic config?
   - Recommendation: No, keep config until app restarts (matches secrets.toml)

---

## Config Storage Approach: Considerations & Alternatives

### The Problem with Module-Level Storage

The current implementation stores programmatic auth config at module level:

```python
_programmatic_auth_config: dict[str, dict[str, Any] | None] = {"config": None}
```

This has several issues:

1. **All sessions share the same config** - If two users call `st.login()` with different configs, they overwrite each other
2. **Not isolated per session** - Config persists across all script runs and sessions
3. **Thread safety concerns** - Concurrent sessions may race to read/write the config

### Why Module-Level Was Chosen Initially

The OAuth handlers (`AuthLoginHandler`, `AuthCallbackHandler` in `oauth_authlib_routes.py`) run **outside** the Streamlit script context. They:
- Don't have access to `st.session_state`
- Don't have access to the script run context
- Need to retrieve auth config when handling `/auth/login` and `/oauth2callback` requests

This is the same constraint that makes `secrets_singleton` (also module-level) necessary.

### When Module-Level Works Fine

For the primary use case in the GitHub issue (deployment to Heroku, Azure, etc.), module-level storage works because:
- All sessions for a deployed app use the **same** auth provider
- Config comes from environment variables, which are identical for all sessions
- Config doesn't change between sessions

This matches the existing workaround: `secrets_singleton._secrets = {"auth": {...}}`

### Alternative Approaches

#### Option A: Nonce-Based Cache (Recommended for Session Isolation)

Store config in a short-lived cache keyed by a unique nonce, and include the nonce in the provider token:

```python
import time
from typing import Any

# Cache: {nonce: (config, expiry_timestamp)}
_auth_config_cache: dict[str, tuple[dict[str, Any], float]] = {}
CONFIG_TTL_SECONDS = 300  # 5 minutes

def store_auth_config_with_nonce(config: dict[str, Any]) -> str:
    """Store config and return a unique nonce."""
    nonce = generate_secure_nonce()
    expiry = time.time() + CONFIG_TTL_SECONDS
    _auth_config_cache[nonce] = (config, expiry)
    _cleanup_expired_configs()
    return nonce

def get_auth_config_by_nonce(nonce: str) -> dict[str, Any] | None:
    """Retrieve config by nonce, if not expired."""
    if nonce not in _auth_config_cache:
        return None
    config, expiry = _auth_config_cache[nonce]
    if time.time() > expiry:
        del _auth_config_cache[nonce]
        return None
    return config
```

The provider token would include the nonce:
```python
payload = {
    "provider": provider,
    "config_nonce": nonce,  # New field
    "exp": datetime.now(timezone.utc) + timedelta(minutes=2),
}
```

**Pros:**
- Session-isolated (each login flow has its own config)
- Auto-expires after TTL
- Secrets not exposed in URLs

**Cons:**
- More complex implementation
- Need to modify provider token encoding/decoding
- Cache cleanup overhead

#### Option B: Encode Config in Provider Token

Include the full config (encrypted) directly in the provider token JWT:

```python
payload = {
    "provider": provider,
    "auth_config": encrypt(config, signing_secret),  # Encrypted config
    "exp": datetime.now(timezone.utc) + timedelta(minutes=2),
}
```

**Pros:**
- Fully session-isolated
- No server-side storage needed
- Self-contained

**Cons:**
- Token size increases significantly
- Secrets in URLs (encrypted, but still)
- JWT size limits may be hit

#### Option C: Accept Module-Level Limitation (Current Implementation)

Keep the simple module-level storage and document the limitation.

**Pros:**
- Simple implementation
- Works for the primary use case (env var-based deployment)
- Matches existing `secrets_singleton` behavior

**Cons:**
- Not session-isolated
- Could cause issues in edge cases (multi-tenant apps with different auth providers)

### Recommendation

For the initial implementation, **Option C (module-level)** is acceptable because:
1. It solves the primary use case from the GitHub issue
2. It matches the behavior of the existing workaround
3. The edge case (different auth configs per session) is rare

However, if session isolation is required, **Option A (nonce-based cache)** is the recommended approach. This would require:
1. Adding config cache with TTL
2. Modifying `encode_provider_token()` to include nonce
3. Modifying `decode_provider_token()` to extract nonce
4. Modifying `create_oauth_client()` to retrieve config by nonce

### Implementation Complexity Comparison

| Approach | Complexity | Session Isolated | Implementation Effort |
|----------|------------|------------------|----------------------|
| Module-level | Low | No | ~50 lines |
| Nonce-based cache | Medium | Yes | ~150 lines |
| Encrypted in token | High | Yes | ~100 lines |
