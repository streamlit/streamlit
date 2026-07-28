---
author: lukasmasuch
created: 2026-07-28
---

# Refresh OIDC tokens and user info with `st.user.refresh()`

## Summary

Add a new command, `st.user.refresh()`, that uses the OIDC refresh token to obtain
fresh access/ID tokens and updated identity claims from the provider, then updates
`st.user` and `st.user.tokens` in place. It runs in the background (no full page reload,
no re-login) and lays the groundwork for automatic token refresh.

## Problem

`st.login()` establishes a long-lived identity cookie (30 days), but the tokens and
claims captured at login are effectively frozen for the life of that cookie. Streamlit
reads `st.user` and `st.user.tokens` from the auth cookie **only at the start of a
session** and never updates them afterward. Two concrete pain points result:

| # | Use case | GitHub issue |
|---|----------|--------------|
| 1 | Pick up **updated user claims** from the IdP mid-session (e.g., the user changed their language/profile in the provider, or an admin updated group membership) without forcing a re-login. | [#12043](https://github.com/streamlit/streamlit/issues/12043) |
| 2 | Recover from **expired access tokens** when calling external APIs on behalf of the user. Access tokens are commonly short-lived (minutes to a couple of hours), but the identity cookie lives for 30 days. After expiry, `st.user.is_logged_in` is still `True` while `st.user.tokens.access` is stale, so API calls silently fail with `401`/`403`. | [#13489](https://github.com/streamlit/streamlit/issues/13489) |

**Current workaround:** the only way to obtain fresh tokens/claims today is
`st.logout()` followed by `st.login()` — a disruptive full re-authentication and page
reload for what is often just an expired access token.

**Real-world report** ([#12696](https://github.com/streamlit/streamlit/pull/12696#issuecomment-3861008419)):
a team running Streamlit against self-hosted GitLab with `expose_tokens = ["access"]`
hits `401`s two hours into every session once GitLab's access token expires. They added
`offline_access` to the scope to get a refresh token, but discovered that Streamlit's
OAuth callback **discards the refresh token** entirely
(`tokens = {k: token[k] for k in ["id_token", "access_token"] if k in token}`), so no
refresh is possible even when the provider returns one.

**Prior art (community PRs):**

- [#12696](https://github.com/streamlit/streamlit/pull/12696) (velochy) — adds
  `st.user.refresh()` via a **full-page redirect** to a `/auth/refresh` endpoint. Works,
  but reloads the app on every refresh. Closed by the author in favor of #14437.
- [#14437](https://github.com/streamlit/streamlit/pull/14437) (tobka777) — extends #12696
  to refresh **without redirects** (background request), so `st.user` and the tokens
  update smoothly with no reload. 11+ 👍, multiple "please merge" requests. This spec
  formalizes and refines that approach.

### Goals

| Goal | Outcome |
|------|---------|
| Refresh tokens + claims without re-login | Long-running apps keep valid access tokens and current user info |
| No full page reload | Session state, scroll position, and in-flight widget input are preserved |
| Secure by default | The refresh token stays server-side (httponly, signed cookie) and is **never** exposed to the app or browser JS |
| Foundation for automatic refresh | Same infrastructure can later drive proactive refresh (#13489) |
| Backward compatible | No change to `st.login()`, `st.logout()`, `st.user`, or `expose_tokens` for existing apps |

### Non-goals (this iteration)

| Out of scope | Rationale |
|--------------|-----------|
| Automatic/proactive refresh before expiry (#13489) | Ship the manual primitive first; automatic mode is a follow-up built on the same infra (see [Out of Scope](#out-of-scope-future-work)) |
| Exposing the `refresh` token via `st.user.tokens` | High security risk; the refresh token is a long-lived credential and stays server-side only |
| Refresh for non-OIDC identity (trusted user headers, SiS/host-provided identity) | Those flows have no OIDC refresh token; `refresh()` is a no-op / not available there |
| Refresh inside embedded/iframed apps | Consistent with `st.login()`, which is unsupported when embedded |

## Proposal

### API

A new method on the existing `st.user` object:

```python
st.user.refresh() -> None
```

No parameters. Returns `None`. Like `st.login()` and `st.logout()`, it is **non-blocking
and asynchronous**: it triggers a background refresh and then reruns the app. The updated
values are visible **on the resulting rerun**, not synchronously within the same run.
This mirrors the documented behavior of `st.user` ("`st.user` only reads from the
identity cookie at the start of a session").

**Why `st.user.refresh()` (not `st.refresh_user()`):**

| Option | Pros | Cons |
|--------|------|------|
| `st.user.refresh()` ✅ **PREFERRED** | Groups the action with the object it mutates (`st.user` / `st.user.tokens`); reads naturally as "refresh the user"; `st.user` already carries methods (`to_dict()`) and properties (`tokens`); matches both community PRs. | Adds behavior to a Mapping-like proxy. |
| `st.refresh_user()` (top-level) | Consistent with top-level `st.login()` / `st.logout()`. | Less discoverable; detached from the `tokens`/claims it updates; pollutes the flat namespace with an auth-only verb. |

`st.login()`/`st.logout()` are top-level because they **create or destroy** the identity;
`refresh()` **mutates the existing** `st.user`, so nesting it under `st.user` is the more
faithful mental model (API principle #20, "one use case, one command").

### Behavior

1. **Preconditions (validated synchronously):** if authentication is not configured or
   the user is not logged in, `st.user.refresh()` raises a clear `StreamlitAuthError`
   (fail fast, principle #23). Calling it when identity comes from trusted user headers or
   a host platform (no OIDC refresh token) is a no-op that logs a warning.
2. **Trigger:** the command instructs the browser to perform a background refresh request
   and requests a rerun.
3. **Refresh:** Streamlit exchanges the stored refresh token at the provider's token
   endpoint for a new access token, a new ID token (and a rotated refresh token, if the
   provider returns one), and refreshed identity claims.
4. **Success:** the auth cookies are rewritten, the live session's identity is updated,
   and the app reruns. `st.user` and `st.user.tokens` now reflect the fresh values.
5. **Recoverable failure** (e.g., transient network error): the current identity is left
   untouched; a warning is logged; `st.user` is unchanged.
6. **Unrecoverable failure** (refresh token expired/revoked/missing): the user is logged
   out (cookies cleared) and the app reruns in the logged-out state so they can
   re-authenticate. This avoids leaving the app in a stuck "logged in but broken" state.

> **Note:** Because `refresh()` triggers a rerun, calling it unconditionally at the top of
> a script creates an infinite refresh loop — the same footgun as an unconditional
> `st.rerun()`. Always gate it behind a button, callback, or another condition (as in the
> examples below).

### Requirements for the refresh token

Most providers only return a refresh token when the app requests the `offline_access`
scope (or a provider-specific equivalent). This is configured through the existing
`client_kwargs`:

```toml
[auth]
redirect_uri = "http://localhost:8501/oauth2callback"
cookie_secret = "xxx"
client_id = "xxx"
client_secret = "xxx"
server_metadata_url = "https://accounts.google.com/.well-known/openid-configuration"
expose_tokens = ["access"]
client_kwargs = { scope = "openid email profile offline_access" }
```

When present, Streamlit stores the refresh token in the existing signed, **httponly**
tokens cookie. It is used only server-side by the refresh flow and is **never** added to
`st.user.tokens` (which continues to surface only the token types listed in
`expose_tokens`, i.e. `"id"` and/or `"access"`).

### Examples

**Example 1: Refresh an expired access token before calling an API**

```python
import streamlit as st
import requests

if not st.user.is_logged_in:
    st.button("Log in", on_click=st.login)
    st.stop()

if st.button("Refresh session"):
    st.user.refresh()  # reruns with fresh tokens + claims

resp = requests.get(
    "https://api.example.com/me",
    headers={"Authorization": f"Bearer {st.user.tokens.access}"},
)
st.json(resp.json())
```

**Example 2: Reflect profile changes made in the identity provider**

```python
import streamlit as st

st.write(f"Preferred language: {st.user.locale}")

# After the user updates their profile in the IdP, pull the new claims in
# without forcing a re-login:
st.button("Reload my profile", on_click=st.user.refresh)
```

## Out of Scope (Future Work)

- **Automatic refresh (#13489).** The background-refresh infrastructure in this spec is
  the building block for proactively refreshing tokens shortly before they expire. A
  follow-up can add an opt-in config (e.g. `[auth] auto_refresh = true`) that schedules a
  background refresh ahead of the token `exp`, so API calls never see an expired token.
  We ship the manual primitive first (API principle #4, "start minimal") and gather
  feedback before committing to an automatic policy.
- **`retry-on-401` semantics.** Automatically retrying a failed downstream API call after
  a refresh is app-specific and out of Streamlit's control; documented as a pattern.
- **Exposing token expiry.** Surfacing `expires_at` on `st.user.tokens` to let apps decide
  when to refresh could be a small complementary addition, deferred until there's demand.

## Checklist

| Item | ✅ or comment |
|------|---------------|
| Works on SiS, Cloud, etc? | N/A on SiS and for trusted-header identity (no OIDC refresh token) — no-op there. Works on self-hosted and Cloud wherever `st.login()` works. Not supported for embedded apps (consistent with `st.login()`). |
| No breaking API changes | ✅ Purely additive: a new `st.user.refresh()` method. Storing the refresh token in the (already existing) httponly tokens cookie does not change `st.user`/`st.user.tokens` output. |
| No new dependencies | ✅ Reuses Authlib and the existing OIDC client. |
| Metrics collected | Track `user.refresh` calls via `@gather_metrics`, plus refresh success/failure counts server-side. |
| Any security/legal impact? | Refresh token is now persisted server-side in the signed, httponly tokens cookie (never exposed to JS or `st.user.tokens`). Refresh endpoint is XSRF-protected and same-origin. See tech spec's Security section. |
| Any docs changes needed? | Auth guide: document `st.user.refresh()`, the `offline_access` scope requirement, and the automatic-refresh pattern. |
