---
author: lukasmasuch
created: 2026-07-28
---

# Tech spec: `st.user.refresh()` OIDC token/claims refresh

## Summary

Implement `st.user.refresh()` by (1) persisting the OIDC refresh token in the existing
signed, httponly tokens cookie, (2) adding a same-origin, XSRF-protected
`POST /auth/refresh` endpoint that performs the `grant_type=refresh_token` exchange and
rewrites the auth cookies, and (3) driving that endpoint from the browser via a background
`fetch` (no navigation), followed by an in-place update of the live session's `user_info`
and a rerun. No full page reload occurs.

## Problem

Two hard constraints in the current auth architecture make refresh non-trivial:

1. **Cookies can only be written on an HTTP response.** Auth state lives in signed,
   httponly cookies (`_streamlit_user`, `_streamlit_user_tokens`) set via `Set-Cookie` in
   the Starlette auth routes (`starlette_auth_routes.py`). The Python `ScriptRunner`
   communicates with the browser over a **WebSocket** and has no HTTP response to attach
   `Set-Cookie` to. So the script cannot update the auth cookies directly — this is why
   `st.login()`/`st.logout()` work by telling the browser to hit an HTTP endpoint.
2. **`st.user` is read from cookies only at WebSocket connect.** In
   `starlette_websocket.py::_websocket_endpoint`, the user cookie and (filtered) tokens
   cookie are parsed into `user_info` **once**, at handshake time, then passed to
   `runtime.connect_session(...)`. During a live session `user_info` is never re-read.
   Critically, reconnecting with an `existing_session_id` **reuses the existing session
   and does not re-apply `user_info`** (`websocket_session_manager.py::connect_session`
   uses the reconnect's `user_info` only for metrics). So a plain WS reconnect will *not*
   refresh `st.user`.

Additionally, the OAuth callback currently **discards the refresh token**
(`starlette_auth_routes.py::_auth_callback`):

```python
tokens = {k: token[k] for k in ["id_token", "access_token"] if k in token}
```

so even when a provider returns a refresh token, it never reaches the cookie.

## Proposal

### Overview of the flow (no redirect)

```
Script                Frontend (App.tsx)            Server
------                ------------------            ------
st.user.refresh()
  ├─ validate (logged in? auth configured?)  ── raises synchronously on error
  ├─ enqueue ForwardMsg{auth_refresh}
  └─ request rerun
        │  ForwardMsg{auth_refresh}
        └──────────────► fetch POST /auth/refresh
                          {sessionId}, XSRF header, credentials:'include'
                                             │
                                             ├─ read refresh_token from httponly cookie
                                             ├─ POST token endpoint (grant_type=refresh_token)
                                             ├─ decode new id_token / fetch userinfo
                                             ├─ Set-Cookie: _streamlit_user, _streamlit_user_tokens
                                             ├─ runtime.update_user_info_for_session(sessionId, claims)
                                             └─ 200 OK  (or 4xx on failure)
        ◄─────────────────────────────────────┘
   on 200 → send rerun BackMsg
   on 401 refresh_failed (unrecoverable) → cookies already cleared by server → reconnect (logged-out)
   on other 4xx/5xx (recoverable) → log warning, leave app as-is
        │  BackMsg{rerun}
        └──────────────► script reruns; st.user now reflects the updated in-memory user_info
```

Because the refresh HTTP request and the WebSocket session share the same server process,
the endpoint can (a) write the new cookies for future connects/reloads **and** (b) update
the already-connected session's in-memory `user_info` so the *current* session sees the
new identity on its next rerun — all without a page reload.

> **Deployment assumption.** The in-place session update (b) relies on the
> `/auth/refresh` request landing on the same process that holds the live WebSocket
> session, since sessions live in a process-local `SessionManager`. Streamlit serves each
> app from a single server process, and multi-replica deployments already require
> WebSocket session affinity (sticky sessions) to function at all — the same-origin POST
> inherits that affinity. If the update still can't be applied in-process (e.g. the POST
> is routed to a different replica), it degrades gracefully rather than erroring: the auth
> cookies are always rewritten, so the refreshed identity is picked up on the next
> reconnect/reload even if the *immediate* rerun would otherwise show stale claims (this
> is the same no-op path as the identity-mismatch case in step 7).

### 1. Persist the refresh token (backend)

In `_auth_callback`, keep the refresh token alongside id/access when the provider returns
one:

```python
tokens = {
    k: token[k]
    for k in ["id_token", "access_token", "refresh_token"]
    if k in token
}
```

- The tokens cookie is already signed + httponly + chunked when large
  (`set_cookie_with_chunks`), so no new storage mechanism is needed.
- **Exposure is unchanged.** The WebSocket handler filters the tokens cookie down to
  `expose_tokens` before putting anything in `user_info["tokens"]`, and
  `get_expose_tokens_config()` only permits `"id"`/`"access"`. The refresh token therefore
  cannot appear in `st.user.tokens`. (Defense-in-depth: also skip `refresh` explicitly in
  the filter.)

### 2. `POST /auth/refresh` endpoint (backend)

Add `_auth_refresh(request)` and register it in `create_auth_routes` as a **POST** route
at `auth/refresh` (POST so it is non-idempotent and not triggerable by top-level GET
navigation). Behavior:

1. Enforce XSRF (same mechanism used for the WebSocket handshake) and same-origin (reuse
   `_get_origin_from_secrets()` / origin validation). Reject otherwise with `403`.
2. Read `refresh_token` from the incoming httponly tokens cookie
   (`_get_cookie_value_from_request(request, TOKENS_COOKIE_NAME)`). If absent → `400`
   (`no_refresh_token`).
3. Determine the provider from the user cookie (as `_get_provider_logout_url` already
   does), build the OAuth client via `_create_oauth_client(provider)`.
4. Perform the refresh:
   `new_token = await client.fetch_access_token(grant_type="refresh_token", refresh_token=...)`
   (Authlib). On provider error (`invalid_grant`, revoked/expired) → `401`
   (`refresh_failed`).
5. Derive refreshed claims: prefer decoding the returned `id_token`; if the grant does not
   return an `id_token`, call the provider's `userinfo_endpoint` with the new access token.
   If neither is available (no `id_token` **and** the provider metadata exposes no
   `userinfo_endpoint`), keep the previous identity claims and log a warning — the token
   exchange itself still succeeded, so the new tokens are persisted and the
   expired-access-token use case works even when claims can't be refreshed.
6. Build the new cookie payloads (same shape as `_auth_callback`: user claims +
   `origin`/`is_logged_in`/`provider`; tokens = id/access/refresh, **preserving the old
   refresh token if the provider did not rotate it**). Write both cookies via
   `_set_auth_cookie(response, ...)`.
7. If a valid `sessionId` is supplied and its current identity matches the cookie identity
   (see Security), update the live session in place via
   `runtime.update_user_info_for_session(session_id, filtered_user_info)`.
8. Return `200` with a minimal JSON status (no identity/token material in the body).

All failure paths leave existing cookies untouched **except** the unrecoverable
`invalid_grant` case, where the endpoint clears the auth cookies (reusing
`_clear_auth_cookie`) so the browser lands logged-out.

### 3. Update a live session's identity (runtime)

Add a method symmetric to the existing `clear_user_info_for_session`:

```python
# runtime.py
def update_user_info_for_session(self, session_id: str, user_info: UserInfoType) -> None:
    session_info = self._session_mgr.get_session_info(session_id)
    if session_info is not None:
        session_info.session.set_user_info(user_info)
```

`AppSession` already owns `user_info` and exposes `clear_user_info()` (which mutates
`self._user_info` **in place** via `.clear()`). Add a `set_user_info(user_info)`
counterpart that likewise mutates in place (`clear()` + `update(...)`), because the same
dict reference is handed to each per-rerun `ScriptRunner` — rebinding the attribute would
not be seen by the next run. This is the smallest change that lets the current session
observe the refreshed identity without a reconnect, and it keeps identity handling
server-side.

### 4. `st.user.refresh()` command (backend)

In `user_info.py`, add a `refresh()` method to `UserInfoProxy`:

```python
@gather_metrics("user.refresh")
def refresh(self) -> None:
    ctx = _get_script_run_ctx()
    if ctx is None:
        return
    if not is_authlib_installed():
        raise StreamlitMissingAuthlibError()
    validate_auth_credentials("default")  # or the active provider
    if not _get_user_info().get("is_logged_in"):
        raise StreamlitAuthError("st.user.refresh() requires a logged-in user.")

    base_path = config.get_option("server.baseUrlPath")
    fwd_msg = ForwardMsg()
    fwd_msg.auth_refresh.url = make_url_path(base_path, AUTH_REFRESH_ENDPOINT)
    ctx.enqueue(fwd_msg)
    # A rerun is requested by the frontend once the background refresh succeeds.
```

Notes:

- Validation is synchronous (fail fast). The token exchange itself is async via the
  frontend round-trip, so `refresh()` returns `None` and the fresh values appear on the
  triggered rerun — identical mental model to `st.login()`/`st.logout()`.
- `AUTH_REFRESH_ENDPOINT = "/auth/refresh"` alongside the existing endpoint constants.

### 5. Protobuf: `AuthRefresh` message

`auth_redirect` triggers a full `window.location` navigation, which is exactly what we
want to avoid. Add a sibling message so the frontend can distinguish "navigate" from
"refresh in the background":

```proto
// proto/streamlit/proto/AuthRefresh.proto
message AuthRefresh {
  string url = 1;  // Refresh endpoint to POST to (background fetch, no navigation).
}
```

Add it to the `ForwardMsg` `type` oneof next to `auth_redirect`, then `make protobuf`.

### 6. Frontend (App.tsx)

Add an `authRefresh` handler to the `dispatchOneOf` in `handleMessage`:

```ts
authRefresh: (authRefresh: AuthRefresh) => {
  void this.handleAuthRefresh(authRefresh.url)
},
```

`handleAuthRefresh(url)`:

1. `POST` to `url` with `credentials: "include"` and the XSRF token header, sending
   `{ sessionId }` (available from `SessionInfo`).
2. On `200`: request a rerun through the existing connection so the script re-executes and
   reads the session's updated `user_info`. No navigation.
3. On `401` (`refresh_failed`): the server has cleared the cookies; reconnect the
   WebSocket so the app re-reads the (now empty) auth state and renders logged-out.
4. On other errors: log a warning and leave the app as-is.
5. Embedded apps: consistent with `authRedirect`, this flow is not supported when
   `isInChildFrame()` (auth is unsupported for embedded apps); no-op with a warning.
6. Concurrent refreshes: if an `authRefresh` message arrives while a previous
   `/auth/refresh` POST is still in flight, ignore it (debounce via an in-flight flag)
   rather than issuing a second request. A refresh has no per-call arguments, so
   coalescing overlapping requests avoids redundant token exchanges and a possible race
   between two rotated refresh tokens.

### File-change summary

| Area | File(s) | Change |
|------|---------|--------|
| Persist refresh token | `starlette_auth_routes.py` | Keep `refresh_token` in the tokens cookie at callback |
| Refresh endpoint | `starlette_auth_routes.py` | `_auth_refresh` + POST route; token exchange, cookie rewrite, session update |
| Token exchange helper | `auth_util.py` | Helper to run `grant_type=refresh_token` and derive claims |
| Live session update | `runtime.py`, `app_session.py` | `update_user_info_for_session` / `AppSession.set_user_info` |
| Command | `user_info.py` | `UserInfoProxy.refresh()` + `AUTH_REFRESH_ENDPOINT` |
| Proto | `AuthRefresh.proto`, `ForwardMsg.proto` | New message in the oneof |
| Frontend | `app/src/App.tsx` | `authRefresh` handler + background fetch + rerun/reconnect |
| Never-expose guard | `starlette_websocket.py` | Ensure `refresh` is excluded from `st.user.tokens` |

## Security

- **Refresh token secrecy.** Stored only in the signed, httponly `_streamlit_user_tokens`
  cookie. Never sent to JS, never returned in the `/auth/refresh` response body, never
  added to `st.user.tokens`. This is the reason the refresh happens through a server
  endpoint rather than in the browser.
- **CSRF / same-origin.** `/auth/refresh` is `POST`, requires the XSRF token (same check as
  the WS handshake and enabled automatically when auth is configured), and validates the
  request origin against `redirect_uri`. A cross-site page cannot trigger a refresh.
- **Session-update authorization.** The `sessionId` in the request body only *routes* the
  in-memory update; the refresh itself is authorized by the httponly cookie. The endpoint
  must verify the target session's current identity (`sub`, `provider`, and `origin`)
  matches the cookie identity before applying the update, so a stray/guessed session id
  cannot be cross-populated with a different user's identity. Binding on `provider` (or the
  token issuer `iss`) alongside `sub` is essential because OIDC subject identifiers are
  only unique *within* a provider — the same `sub` value issued by a different provider
  must not be treated as the same user. The `provider` is already retained in the user
  cookie. If it doesn't match, skip the in-memory update (cookies are still rewritten for
  the caller's own next connect).
- **Rotated refresh tokens.** If the provider returns a new refresh token, persist it and
  drop the old one; if not, retain the existing one so subsequent refreshes keep working.
- **Failure hygiene.** `invalid_grant` clears cookies (forces clean re-auth); transient
  failures never partially update cookies.

## Testing plan

- **Python unit tests** (`lib/tests/streamlit/web/server/starlette/starlette_auth_routes_test.py`,
  `user_info_test.py`): refresh happy path, missing refresh token, `invalid_grant`
  (cookie-clear), rotated vs. non-rotated refresh token, refresh-token never exposed in
  `st.user.tokens`, XSRF/origin rejection, `refresh()` raises when not logged in.
- **Frontend unit tests** (`App.test.tsx`): `authRefresh` issues the background fetch (no
  `window.location` change), reruns on success, reconnects on `401`, no-ops when embedded.
- **E2E** (`e2e_playwright/auth_test.py`): extend the existing mock OIDC `testprovider` to
  support the `refresh_token` grant; assert that after `st.user.refresh()` the displayed
  claims/tokens update **without a page navigation** and session state is preserved.

## Alternatives considered

**A. Redirect-based refresh (PR #12696).** `st.user.refresh()` enqueues an
`auth_redirect` to a `GET /auth/refresh` endpoint; the browser navigates there, the server
rewrites cookies, then redirects back to `/`.
- Pros: minimal code — reuses `auth_redirect`, no new proto/frontend path, no live-session
  update (the resulting fresh connection re-reads cookies naturally).
- Cons: **full page reload** on every refresh — flicker, lost scroll position and
  in-flight widget input, and unusable for silent/automatic refresh (#13489). Rejected as
  the primary design; it remains the conceptual fallback if the background path proves
  problematic on a platform.

**B. Refresh entirely in the Python `ScriptRunner`.** The backend has the client
credentials and could call the token endpoint itself. Rejected: it still cannot persist
the new tokens to the browser cookie (no HTTP response over the WebSocket), so it would
need to hand tokens back to the frontend to set — reintroducing exposure and complexity.

**C. Return refreshed claims/tokens in the fetch response for the frontend to apply.**
Rejected: identity/token material would transit through browser JS, weakening the httponly
guarantee that `st.login()` currently provides. Keeping everything server-side is a
deliberate constraint.

**D. Make WebSocket reconnect re-read cookies into `user_info`.** Instead of an explicit
`update_user_info_for_session`, change reconnect semantics so `user_info` is re-applied.
Rejected for this iteration: it changes behavior for *all* reconnects (identity could
silently change mid-session on any network blip) and is a broader, riskier change than a
scoped, explicit session update triggered only by refresh.
