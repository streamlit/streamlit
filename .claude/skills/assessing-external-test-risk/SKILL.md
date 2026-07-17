---
name: assessing-external-test-risk
description: Assesses whether branch or PR changes are high-risk for externally hosted or embedded Streamlit usage and recommends whether external e2e coverage with `@pytest.mark.external_test` is needed. Use during code review, PR triage, or test planning when changes touch routing, auth, websocket/session behavior, embedding, assets, cross-origin behavior, SiS/Snowflake runtime, storage, or security headers.
---

# Assessing external test risk

Use this skill to decide whether a branch or PR should include external e2e coverage using `@pytest.mark.external_test`.

This helps protect deployments that commonly involve proxies, embedded iframe contexts, CSP constraints, and other browser security boundaries.

This skill is for **risk assessment and recommendation**. It does not auto-mark tests unless explicitly requested.

## Decision rule

Use an **any-hit** policy:

- If any checklist category is hit, output **Recommend external_test: Yes**
- If no categories are hit, output **Recommend external_test: No**

## Inputs to review

- Branch or PR diff against its base branch
- Changed files and related tests
- PR description (if available)

## Assessment workflow

1. Gather the changed files and full diff against the base branch.
2. Evaluate each checklist category below as hit or not hit.
3. Record concrete evidence from file paths and diff snippets.
4. Produce a recommendation and specific external-test focus areas.

## Checklist categories

Evaluate all categories. A single hit is enough to recommend external coverage.

1. **Routing and URL behavior**
   - Hit when changes introduce or modify Starlette routes, `server.baseUrlPath`, catch-alls, request methods, URL resolution, redirects, or status codes.

2. **Auth, cookies, CSRF, and identity binding**
   - Hit when changes touch login/logout or OAuth flows, `_streamlit_user`, `_streamlit_xsrf`, CSRF/XSRF handling, `server.trustedUserHeaders`, or session-to-identity binding.

3. **Websocket handshake and session transport**
   - Hit when changes affect websocket handshake or subprotocols, session affinity, reconnect behavior, ping or timeout behavior, message size limits, or fragmentation.

4. **Embedding and iframe boundary**
   - Hit when changes modify host-to-guest communication (`postMessage`), iframe sizing or resize behavior, iframe sandbox or allow attributes, or permissions policy behavior in embedded contexts.

5. **Static and component asset serving**
   - Hit when changes alter asset handlers, cache headers, size limits, base paths (including `server.customComponentBaseUrlPath`), or proxying rules for static/component assets.

6. **Service worker, uploads, and downloads**
   - Hit when changes modify service worker registration, scope, or caching strategy; upload/download endpoints; JWT or CSRF wrapping; or download attribute behavior.

7. **Cross-origin behavior and external networking**
   - Hit when changes alter CORS allowlists, `crossOrigin` usage, external-origin fetches or external networks behavior, or backend URL discovery via `window.__streamlit.*`.

8. **Cross-origin theming and resource discovery**
   - Hit when changes introduce or modify theme/resource loading across origins (fonts, images, theme globals), CSS isolation with host pages, or manifest/asset discovery when HTML is not served by Starlette.

9. **SiS and Snowflake runtime dependencies**
   - Hit when changes rely on or modify SiS/Snowflake runtime behavior, including `running_in_sis()`, `get_active_session()`, Snowflake connection/session semantics, or SiS-specific environment flags.

10. **Client storage behavior**
    - Hit when changes introduce or modify cookies, `localStorage`, or `sessionStorage` usage that may differ in embedded or third-party contexts.

11. **Security headers and browser policies**
    - Hit when changes adjust CSP, Referrer-Policy, Permissions-Policy, or related headers that can impact embedding or resource loading.

## Output format

Use this exact structure:

```markdown
## External test recommendation

- Recommend external_test: [Yes/No]
- Triggered categories: [List category numbers and names, or "None"]
- Evidence:
  - `<path>`: [short reason from diff]
  - `<path>`: [short reason from diff]
- Suggested external_test focus areas:
  - [Concrete scenario to validate externally]
  - [Concrete scenario to validate externally]
- Confidence: [High/Medium/Low]
- Assumptions and gaps: [Unknowns, missing context, or why confidence is reduced]
```

## Interpretation guidance

- Prefer evidence over intuition. Tie each hit to concrete diff details.
- When in doubt, err toward **Yes** if externally hosted or embedded behavior could diverge from local runs.
- Keep focus areas specific and testable (route, auth handshake, iframe boundary, asset loading, SiS runtime behavior).

## Examples

### Example yes recommendation

Diff includes:

- `lib/streamlit/web/server/starlette/starlette_routes.py` route changes
- Cookie/XSRF handling updates in request auth middleware
- Frontend embed code changing iframe `allow` attributes

Expected output:

- `Recommend external_test: Yes`
- Triggered categories include routing, auth/cookies/CSRF, and embedding boundary
- Focus areas include external host iframe embedding + auth/session continuity checks

### Example no recommendation

Diff includes:

- Pure refactor in internal utility functions with no network, auth, embedding, storage, or runtime integration impact
- Docs and test name cleanup only

Expected output:

- `Recommend external_test: No`
- Triggered categories: `None`
- Confidence is high if no indirect integration points are touched
