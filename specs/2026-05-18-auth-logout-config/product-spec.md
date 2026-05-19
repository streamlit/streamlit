---
author: kmcgrady
created: 2026-05-18
---

# Configurable OIDC logout parameters

## Summary

Add an `[auth.logout]` config section in `secrets.toml` that lets developers override the
query parameters sent during OIDC RP-Initiated Logout, fixing providers that diverge from
the spec (AWS Cognito, MS Entra).

## Problem

`st.logout()` hardcodes `post_logout_redirect_uri` and `id_token_hint` per the
[OIDC RP-Initiated Logout spec](https://openid.net/specs/openid-connect-rpinitiated-1_0.html).
Several major providers deviate:

| Provider   | Issue                                                        | GitHub Issue |
|------------|--------------------------------------------------------------|--------------|
| AWS Cognito | Expects `redirect_uri` instead of `post_logout_redirect_uri` | [#14601](https://github.com/streamlit/streamlit/issues/14601) |
| MS Entra   | Needs `logout_hint` (from user email) to skip account picker | [#14290](https://github.com/streamlit/streamlit/issues/14290) |

Both break or degrade the logout UX with no workaround available to users today.

**Current behavior in `build_logout_url()`:** constructs a URL with fixed param names
`post_logout_redirect_uri`, `client_id`, and optionally `id_token_hint`. No configuration
surface exists to change these.

## Proposal

### Section name: `[auth.logout]`

The section is named `[auth.logout]` to be consistent with Streamlit's noun-based config
sections (`[auth]`, `[auth.google]`, `[server]`). It also reads unambiguously as a config
section -- not a provider name -- even though it sits at the same TOML nesting level as
`[auth.google]`. And it's extensible: future keys like `end_session_endpoint` can live here
without the name becoming misleading.

`logout` becomes a **reserved name** under `[auth.*]` and cannot be used as a provider name.
The existing provider validation (which already rejects names with underscores) will be
extended to reject `logout` explicitly with a clear error message.

### Configuration

In `secrets.toml`:

```toml
[auth.logout]
redirect_uri_name = "post_logout_redirect_uri"  # default
include_id_token_hint = true                     # default
id_token_hint_name = "id_token_hint"             # default

[auth.logout.additional_params]
# Static or template-substituted params appended to the logout URL.
# {field} references are resolved from user_info (st.user).
logout_hint = "{email}"
```

### Config keys

| Key | Type | Default | Purpose |
|-----|------|---------|---------|
| `redirect_uri_name` | `str` | `"post_logout_redirect_uri"` | Query param name for the post-logout redirect URI |
| `include_id_token_hint` | `bool` | `true` | Whether to include the ID token hint |
| `id_token_hint_name` | `str` | `"id_token_hint"` | Query param name for the ID token hint |
| `additional_params` | `dict[str, str]` | `{}` | Extra query params; values support `{field}` template substitution from `st.user` |

### Template substitution

Values in `additional_params` support `{field}` placeholders resolved from the current
user's info (the same data available via `st.user`). Common fields: `email`, `name`, `sub`.

- If a referenced field is missing from user info, the param is **omitted silently** (no
  error, no empty value sent to provider).
- Static values (no `{}` placeholder) are always included as-is.

### Behavior

`build_logout_url()` changes:

1. Read `[auth.logout]` from secrets (fall back to defaults if absent).
2. Use `redirect_uri_name` as the query param key for the redirect URI.
3. Include/exclude the ID token hint based on `include_id_token_hint`.
4. If included, use `id_token_hint_name` as the query param key.
5. Resolve and append `additional_params`.

No change to `st.logout()` API signature. Fully backward-compatible: absent config
produces identical behavior to today.

### Per-provider logout config

In multi-provider apps, providers may need different logout params. Per-provider config
overrides the global `[auth.logout]` section:

```toml
[auth.cognito.logout]
redirect_uri_name = "redirect_uri"
include_id_token_hint = false

[auth.microsoft.logout.additional_params]
logout_hint = "{email}"
```

Per-provider config is a **complete override**, not a key-by-key merge -- consistent with
how `[auth.<provider>]` sections work elsewhere. If `[auth.cognito.logout]` exists, the
global `[auth.logout]` is ignored entirely for that provider. Keys not specified in the
provider section fall back to the built-in defaults, not to the global section.

If a provider has no `[auth.<provider>.logout]`, the global `[auth.logout]` applies.
If neither exists, the OIDC-spec defaults are used.

### Examples

**AWS Cognito** (uses `redirect_uri`, no ID token hint):

```toml
[auth.logout]
redirect_uri_name = "redirect_uri"
include_id_token_hint = false
```

**MS Entra** (skip account picker via `logout_hint`):

```toml
[auth.logout.additional_params]
logout_hint = "{email}"
```

**Custom provider** (non-standard param names + static param):

```toml
[auth.logout]
redirect_uri_name = "returnTo"
include_id_token_hint = false

[auth.logout.additional_params]
audience = "{sub}"
federated = "true"
```

### What's OIDC spec vs our addition

| Parameter | OIDC RP-Initiated Logout Spec | Our addition |
|-----------|-------------------------------|--------------|
| `post_logout_redirect_uri` | Defined in spec (Section 2) | We allow renaming the key |
| `id_token_hint` | Defined in spec (Section 2) | We allow renaming/suppressing |
| `client_id` | Defined in spec (Section 2) | Always included automatically; not configurable |
| `additional_params` | N/A | Arbitrary extra query params appended after the standard ones |

The OIDC spec defines the standard parameter names. Our configuration exists solely to
accommodate providers that don't follow the spec.

## Out of Scope (Future Work)

- **`end_session_endpoint` override** -- Some providers don't advertise this in their
  metadata. Could be added to `[auth.logout]` later.
- **Logout callback/hook** -- Server-side post-logout actions.

## Checklist

| Item                         | Status                                                    |
|------------------------------|-----------------------------------------------------------|
| Works on SiS, Cloud, etc?    | N/A on SiS (auth disabled). Works on Cloud and self-hosted. |
| No breaking API changes      | Additive config only; absent config = current behavior    |
| No new dependencies          | None                                                      |
| Metrics collected            | Could track `[auth.logout]` presence in secrets           |
| Any security/legal impact?   | No -- only changes query param names on logout redirect   |
| Any docs changes needed?     | Auth docs: add "Provider-specific logout" section         |
