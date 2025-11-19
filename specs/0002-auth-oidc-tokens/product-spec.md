---
Author(s): @velochy
Status: Draft
---

# OIDC Token Exposure in `st.login`

## Summary

Streamlit’s `st.login()` authentication mechanism currently enables user identity verification but does not provide access to the user’s tokens returned from the Identity Provider (IdP). Many enterprise and API-integrated Streamlit applications need access to the **access token** (to call APIs on behalf of the user) and occasionally the **ID token** (for logout flows via `id_token_hint`). This feature provides a **configurable, secure way to expose selected tokens** to the developer through a new dictionary interface: `st.user.tokens`.

By default, **no tokens are exposed**, ensuring backward compatibility and secure defaults.

## **Goals**

| Goal                                                     | Outcome                                                     |
| -------------------------------------------------------- | ----------------------------------------------------------- |
| Allow developers to access `access_token` and `id_token` | Enables API-driven apps acting on behalf of logged-in users |
| Maintain secure defaults                                 | Tokens are only exposed when explicitly configured          |
| Avoid major breaking changes to existing apps            | `st.login()` signature remains unchanged                    |
| Prepare foundation for future refresh-token support      | Architecture supports later extension                       |

---

## **Non-Goals**

| Out of Scope                              | Rationale                                  |
| ----------------------------------------- | ------------------------------------------ |
| Automatic access token refresh            | Will be implemented in a follow-up feature |
| Exposing `refresh_token`                  | High security risk; deferred               |
| UI-based user-consent for token retrieval | May be implemented later; design needed    |

---

## **Configuration**

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

If `expose_tokens` is omitted → the feature is **disabled by default**.

---

## **API Changes**

### **No changes to `st.login()` function signature.**

### **New Runtime Object:**

`st.user.tokens`

### **Behavior**

```python
user = st.user  # existing object
tokens = user.tokens  # new dict-like mapping

access_token = tokens.get("access_token")  # may be None
id_token = tokens.get("id_token")  # may be None
```

### **Example Usage**

```python
import streamlit as st
import requests

st.login()

if st.user:
  api_url = "https://api.example.com/me"
  resp = requests.get(api_url, headers={
    "Authorization": f"Bearer {st.user.tokens.get('access_token')}"
  })
  st.json(resp.json())
```

## **Data Storage \+ Cookie Model**

| Cookie             | Purpose                           | Notes                           |
| ------------------ | --------------------------------- | ------------------------------- |
| `streamlit_user`   | User identity claims              | Existing behavior               |
| `streamlit_tokens` | Token payload (chunked if needed) | HTTP-only, Secure, SameSite=Lax |

- Tokens **never stored in `session_state`**

- Tokens **never accessible to browser JavaScript**

- When user logs out, `streamlit_tokens` is deleted

---

## **Security Considerations**

- Default behavior exposes **no tokens**

- Documentation will prominently warn that exposing tokens grants privilege

- Developers are responsible for securing API calls using tokens

- Token refresh is deferred to prevent silent privilege extension

- No UI indication of token exposure; developers assume responsibility

---

## **Acceptance Criteria**

| Requirement                                                  | Must Have | Status    |
| ------------------------------------------------------------ | --------- | --------- |
| If `expose_tokens` is omitted → `st.user.tokens` is empty    | ✅        |           |
| If `expose_tokens=["access"]` → contains only `access_token` | ✅        |           |
| If `expose_tokens=["id"]` → contains only `id_token`         | ✅        |           |
| Token cookie is HTTP-only \+ Secure                          | ✅        |           |
| Token cookie supports chunking for large tokens              | ✅        |           |
| Logout deletes token cookie                                  | ✅        |           |
| Backward compatibility preserved                             | ✅        |           |
| Works with Keycloak, Auth0, Azure AD, Google Workspace       | ✅        | Manual QA |

---

## **Documentation Updates**

Add to **Authentication Guide**:

1. **New Section:** _Using Access Tokens with `st.login`_

2. Example: Calling Microsoft Graph using `access_token`

3. Warning Box: _Exposing tokens grants app the ability to act on behalf of user_

## Checklist

<!--
Check the boxes or add a comment with the reason it cannot be checked.
-->

- [ ] Works on all deployment platforms (e.g. [Streamlit Community Cloud](https://streamlit.io/cloud), [Streamlit in Snowflake](https://www.snowflake.com/en/product/features/streamlit-in-snowflake/), [Hugging Face Spaces](https://huggingface.co/spaces))?
- [ ] No breaking API changes?
- [ ] No new dependencies?
- [ ] Metrics collected?
- [ ] Any security or legal implications?
- [ ] Anything to keep in mind for docs?
- [ ] Any other risks?
