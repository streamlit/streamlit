---
author: kmcgrady
created: 2026-05-18
---

# Configurable OIDC logout parameters

## Summary

Add an `auth.logout_params` config option in `secrets.toml` that lets developers override
the query parameters sent during OIDC RP-Initiated Logout, fixing providers that diverge
from the spec (AWS Cognito, MS Entra).

## Problem

`st.logout()` hardcodes `post_logout_redirect_uri` and `id_token_hint` per the
[OIDC RP-Initiated Logout spec](https://openid.net/specs/openid-connect-rpinitiated-1_0.html).
Several major providers deviate:

| Provider   | Issue                                                        | GitHub Issue |
|------------|--------------------------------------------------------------|--------------|
| AWS Cognito | Expects `redirect_uri` instead of `post_logout_redirect_uri` | [#14601](https://github.com/streamlit/streamlit/issues/14601) |
| MS Entra   | Shows an account picker on logout; may need a `logout_hint` param to skip it | [#14290](https://github.com/streamlit/streamlit/issues/14290) |

Both break or degrade the logout UX with no workaround available to users today.

**Current behavior in `build_logout_url()`:** constructs a URL with fixed param names
`post_logout_redirect_uri`, `client_id`, and optionally `id_token_hint`. No configuration
surface exists to change these.

## Proposal

### Configuration

A single `logout_params` key under `[auth]` holds a table of query parameters to apply on
top of the ones Streamlit builds by default:

```toml
[auth]
logout_params = { logout_hint = "{email}" }
```

`logout_params` is a `dict[str, str]`. Its default is `{}`, which produces today's behavior
exactly. A single flat option (rather than a dedicated `[auth.logout]` section with named
keys) keeps the config surface minimal, avoids reserving `logout` as a provider name, and
is more generic -- renaming, suppressing, and adding params all go through one mechanism.

### Semantics

Streamlit builds a default param set: `client_id`, `post_logout_redirect_uri`, and (when an
ID token is available) `id_token_hint`. `logout_params` is **merged on top** of that set:

- **Add or override** -- a key with a non-empty value sets that query param. Values support
  `{field}` template substitution (see below).
- **Remove** -- a key mapped to an empty string (`""`) drops that param from the URL. This
  is how a standard param like `id_token_hint` is suppressed.
- **Untouched** -- params not named in `logout_params` keep their default values.

Param order is not significant; resolved values are URL-encoded.

### Template substitution

Values support `{field}` placeholders resolved from a single namespace containing:

- The standard values Streamlit computes: `{post_logout_redirect_uri}`, `{client_id}`,
  `{id_token_hint}`.
- The current user's claims, the same data available via `st.user` (e.g. `{email}`,
  `{name}`, `{sub}`, `{login_hint}`).

Rules:

- If a referenced field is missing, the param is **omitted silently** (no error, no empty
  value sent to the provider).
- Values with no `{}` placeholder are sent as-is.

### Behavior

`build_logout_url()` reads `logout_params`, resolves templates, and applies the merge rules
above to the default param set. No change to the `st.logout()` API signature. Fully
backward-compatible: an absent or empty `logout_params` produces identical behavior to
today.

### Examples

**AWS Cognito** (uses `redirect_uri` instead of `post_logout_redirect_uri`, and no ID token
hint). Rename is expressed as add-new-key + remove-old-key:

```toml
[auth]
logout_params = { redirect_uri = "{post_logout_redirect_uri}", post_logout_redirect_uri = "", id_token_hint = "" }
```

(If a provider simply ignores unknown params, the `post_logout_redirect_uri = ""` removal
can be omitted -- but the explicit form above is unambiguous.)

**MS Entra** (attempt to skip the account picker) -- **experimental, unverified**:

```toml
[auth]
logout_params = { logout_hint = "{email}" }
```

> The exact value that suppresses Entra's account picker is not yet confirmed. Reports in
> [#14290](https://github.com/streamlit/streamlit/issues/14290) show `id_token_hint` alone
> does not reliably work, and the correct `logout_hint` source may be the `login_hint`
> claim (`"{login_hint}"`) rather than `email`. This example must be validated against a
> real Entra tenant before being documented as a supported fix.

**Custom provider** (non-standard param names + a static param):

```toml
[auth]
logout_params = { returnTo = "{post_logout_redirect_uri}", post_logout_redirect_uri = "", id_token_hint = "", audience = "{sub}", federated = "true" }
```

### What's OIDC spec vs our addition

| Parameter | OIDC RP-Initiated Logout Spec | Our addition |
|-----------|-------------------------------|--------------|
| `post_logout_redirect_uri` | Defined in spec (Section 2) | Can be renamed (add new key + remove this one) or removed |
| `id_token_hint` | Defined in spec (Section 2) | Can be renamed or suppressed (`""`) |
| `client_id` | Defined in spec (Section 2) | Included by default; can be overridden or removed like any other param |
| arbitrary params | N/A | Any extra key in `logout_params` is appended to the URL |

The OIDC spec defines the standard parameter names. Our configuration exists solely to
accommodate providers that don't follow the spec.

## Out of Scope (Future Work)

- **`end_session_endpoint` override** -- Some providers don't advertise this in their
  metadata. Could be added as a sibling `[auth]` key later.
- **Disable the logout redirect entirely** -- Restoring the pre-1.53 "clear the cookie
  only" behavior (requested in [#14290](https://github.com/streamlit/streamlit/issues/14290))
  is a separate, complementary change tracked on its own.
- **Logout callback/hook** -- Server-side post-logout actions.

## Checklist

| Item                         | Status                                                    |
|------------------------------|-----------------------------------------------------------|
| Works on SiS, Cloud, etc?    | N/A on SiS (auth disabled). Works on Cloud and self-hosted. |
| No breaking API changes      | Additive config only; absent config = current behavior    |
| No new dependencies          | None                                                      |
| Metrics collected            | Could track `auth.logout_params` presence in secrets       |
| Any security/legal impact?   | No -- only changes query param names on logout redirect   |
| Any docs changes needed?     | Auth docs: document `auth.logout_params` for non-standard providers |
