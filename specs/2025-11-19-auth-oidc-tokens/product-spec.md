---
author: velochy
created: 2025-11-19
---

# Expose ID and access tokens in `st.user`

## Summary

Expose the ID and access tokens from the OIDC login in `st.user` if the new
`expose_tokens` option is set.

## Problem

Streamlit’s `st.login()` authentication mechanism currently enables user identity verification but does not provide access to the user’s tokens returned from the Identity Provider (IdP). Many enterprise and API-integrated Streamlit applications need access to the **access token** (to call APIs on behalf of the user) and occasionally the **ID token**. This feature provides a **configurable, secure way to expose selected tokens** to the developer through a new dictionary interface: `st.user.tokens`.

By default, **no tokens are exposed**, ensuring backward compatibility and secure defaults.

### Goals

| Goal                                                     | Outcome                                                                                                              |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Allow developers to access `access` token and `id` token | Enables API-driven apps acting on behalf of logged-in users. Also make them available for internal flows like logout |
| Maintain secure defaults                                 | Tokens are only exposed when explicitly configured                                                                   |
| Avoid major breaking changes to existing apps            | `st.login()` signature remains unchanged                                                                             |
| Prepare foundation for future refresh-token support      | Architecture supports later extension                                                                                |

### Non-Goals

| Out of Scope                              | Rationale                                  |
| ----------------------------------------- | ------------------------------------------ |
| Automatic access token refresh            | Will be implemented in a follow-up feature |
| Exposing `refresh` token                  | High security risk; deferred               |
| UI-based user-consent for token retrieval | May be implemented later; design needed    |

## Proposal

### Configuration

Developers request token exposure using `secrets.toml`:

```toml
[auth]
expose_tokens = ["access", "id"]
```

Accepted values in the list:

| Value      | Result                                  |
| ---------- | --------------------------------------- |
| `"access"` | Adds `access_token` to `st.user.tokens` |
| `"id"`     | Adds `id_token` to `st.user.tokens`     |
| _none_     | `st.user.tokens` remains empty          |

As a convenience, you can also provide an individual string instead of a list (e.g. `"access"` instead of `["access"]`):

```toml
[auth]
expose_tokens = "access"
```

If `expose_tokens` is omitted → the feature is **disabled** and `st.user` will not
contain the key `tokens`.

### API

If `expose_tokens` is set, we'll add a new field `st.user.tokens`, which will contain
the respective tokens:

```python
id_token = st.user.tokens.id
access_token = st.user.tokens.access
```

Note that the keys `id` and `access` might not exist depending on which tokens are
exposed.

### Example

This assumes `expose_tokens = "access"`, so that `st.user.tokens.access` exists.

```python
import streamlit as st
import requests

st.login()

if st.user:
  api_url = "https://api.example.com/me"
  resp = requests.get(api_url, headers={
    "Authorization": f"Bearer {st.user.tokens.access}"
  })
  st.json(resp.json())
```

### Data storage and cookie model

| Cookie             | Purpose                                  | Notes                           |
| ------------------ | ---------------------------------------- | ------------------------------- |
| `streamlit_user`   | User identity claims (chunked if needed) | Existing behavior               |
| `streamlit_tokens` | Token payload (chunked if needed)        | HTTP-only, Secure, SameSite=Lax |

- Tokens **never stored in `session_state`**

- Tokens **never accessible to browser JavaScript**

- When user logs out, `streamlit_tokens` is deleted

### Security Considerations

- Default behavior exposes **no tokens**

- Documentation will prominently warn that exposing tokens grants privilege

- Developers are responsible for securing API calls using tokens

- Token refresh is deferred to prevent silent privilege extension. Auth refresh would eventually need to be handled by Streamlit internally, and the refresh token shouldn't be exposed.

- No UI indication of token exposure; developers assume responsibility

### Acceptance Criteria

| Requirement                                                             | Must Have | Status |
| ----------------------------------------------------------------------- | --------- | ------ |
| If `expose_tokens` is omitted → `st.user.tokens` would throw a KeyError | ✅        |        |
| If `expose_tokens=["access"]` → contains only `access` token            | ✅        |        |
| If `expose_tokens=["id"]` → contains only `id` token                    | ✅        |        |
| Token cookie is HTTP-only \+ Secure                                     | ✅        |        |
| Token cookie supports chunking for large tokens                         | ✅        |        |
| Logout deletes token cookie                                             | ✅        |        |
| Backward compatibility preserved                                        | ✅        |        |

### Documentation Updates

Add to **Authentication Guide**:

1. **New Section:** _Using Access Tokens with `st.login`_

2. Example: Calling Microsoft Graph using `access`

3. Warning Box: _Exposing tokens grants app the ability to act on behalf of user_

## Checklist

<!--
Check the boxes or add a comment with the reason it cannot be checked.
-->

| Item                         | ✅ or comment          |
|------------------------------|------------------------|
| Works on SiS, Cloud, etc?    | Disabled on SiS, need to test on Cloud, but since auth and `st.user` works there, it should be fine.                        |
| No breaking API changes      | ✅                       |
| No new dependencies          | ✅                       |
| Metrics collected            | Would be great to add tracking how often `st.user.tokens` is accessed or how often `expose_tokens` is set.                       |
| Any security/legal impact?   | Security discussions already handled.                        |
| Any docs changes needed?     | Should probably add an example/tutorial.
