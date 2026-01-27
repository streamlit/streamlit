# Environment Variable Placeholders in secrets.toml

## Overview

This document describes the implementation plan for supporting environment variable placeholders in Streamlit's `secrets.toml` files.

## Feature Description

Allow users to reference environment variables in their secrets.toml files:

```toml
# secrets.toml
db_username = "${{DB_USER}}"
db_password = "${{DB_PASS}}"

# Combined values
connection_string = "postgres://${{DB_USER}}:${{DB_PASS}}@${{DB_HOST}}/mydb"

# With default values
api_key = "${{API_KEY:-development-key}}"
```

## Syntax Choice: `${{VAR}}`

### Why This Syntax?

| Syntax | Clash Risk | Notes |
|--------|------------|-------|
| `${{VAR}}` | **Very low** | Double braces are rare in practice |
| `${env:VAR}` | Very low | Explicit namespace, but longer |
| `${VAR}` | Medium | Industry standard but may conflict with shell |
| `{{VAR}}` | Medium | Conflicts with Jinja2 templates |

**Chosen: `${{VAR}}`** because:

1. **Unlikely to clash** - Double braces are extremely rare in actual config values
2. **Recognizable** - Uses `$` prefix (variable sigil) familiar to developers
3. **Supports concatenation** - Works naturally: `"${{USER}}:${{PASS}}"`
4. **Easy escaping** - `$${{VAR}}` for literal `${{VAR}}`
5. **Familiar** - Similar to GitHub Actions syntax (`${{ secrets.TOKEN }}`)

### Pattern Specification

```
${{VAR_NAME}}           # Basic substitution
${{VAR_NAME:-default}}  # With default value if env var not set
$${{VAR_NAME}}          # Escaped - produces literal ${{VAR_NAME}}
```

Regex pattern:
```python
r'\$\{\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}\}'
```

## Implementation Details

### Location

All changes are in `lib/streamlit/runtime/secrets.py`

### Core Function

```python
def _substitute_env_vars(value: Any) -> Any:
    """Recursively substitute environment variable placeholders in string values.

    Supports:
    - ${{VAR}} - basic substitution
    - ${{VAR:-default}} - substitution with default value
    - $${{VAR}} - escaped (literal ${{VAR}})
    """
```

### Integration Points

1. **`_parse_toml_file`** (line ~265): After `toml.loads()`, apply substitution
2. **`_parse_directory`** (line ~311): After reading file content, apply substitution

### Behavior

1. **Missing env var without default**: Raises `StreamlitSecretNotFoundError`
2. **Missing env var with default**: Uses the default value
3. **Escaped placeholder**: `$${{VAR}}` becomes literal `${{VAR}}`
4. **Non-string values**: Passed through unchanged (int, float, bool, etc.)
5. **Nested structures**: Recursively processed

### Error Messages

Add to `SecretErrorMessages`:
```python
self.env_var_not_found: Callable[[str, str], str] = lambda var_name, path: (
    f'Environment variable "{var_name}" referenced in secrets file "{path}" is not set. '
    "Set the environment variable or provide a default value using ${{VAR:-default}} syntax."
)
```

## Scope

- **Included:**
  - TOML file secrets (`secrets.toml`)
  - Directory-based secrets (Kubernetes style)
  - Nested sections
  - String values only

- **Not included:**
  - Cross-secret references (`${{secrets.OTHER_KEY}}`) - only env vars
  - Dynamic reload on env var changes (only file changes trigger reload)

## Testing Strategy

1. **Unit tests** in `lib/tests/streamlit/runtime/secrets_test.py`:
   - Basic substitution
   - Default values
   - Escaping
   - Missing env var error
   - Nested sections
   - Combined/concatenated values
   - Directory-based secrets with substitution

2. **No E2E tests needed** - functionality is internal to secrets loading

## Effort Estimate

| Component | Lines of Code |
|-----------|---------------|
| Core substitution function | ~50 |
| Integration points | ~15 |
| Error handling/messages | ~15 |
| Unit tests | ~120 |
| **Total** | **~200** |

## Risks & Mitigations

1. **Circular references**: Only env vars supported, not secret-to-secret references
2. **Performance**: Regex substitution is fast; minimal impact on startup
3. **Backwards compatibility**: Existing secrets without placeholders work unchanged
