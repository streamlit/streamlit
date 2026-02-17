# Improving endpoint calls without breaking backward compatibility

## Scope
This plan covers:
- #7074: 404 health check when navigating directly to a subpage
- #8188: Unnecessary failover on `/_stcore/stream`
- #7076: Health check endpoint breaks in some cloud deployments
- #8713: Custom 404 / error / maintenance page support

## Current behavior (as of 2026-02-17)
- Frontend base-URI discovery is heuristic. `getPossibleBaseUris()` tries up to two candidates derived from the current path (`frontend/connection/src/utils.ts:74`).
- Init pings treat any HTTP 2xx as success and currently do not validate endpoint payload semantics before selecting a candidate (`frontend/connection/src/DoInitPings.tsx:183`).
- Health currently returns plain text (`"ok"`) from runtime (`lib/streamlit/runtime/runtime.py:553`) and frontend now correctly handles JSON-or-text responses (`frontend/connection/src/utils.ts:221`).
- Page-not-found and compile/runtime failures surface through built-in dialog flows; host can suppress dialogs (`blockErrorDialogs`) but cannot provide a first-class custom UI (`frontend/app/src/App.tsx:726`, `lib/streamlit/web/server/routes.py:243`).

## Backward-compatibility guardrails
1. Keep all existing endpoints and payloads working (`/_stcore/health`, `/_stcore/host-config`, `/_stcore/stream`).
2. Add new behavior as opt-in/configurable, with legacy behavior as fallback.
3. Avoid breaking older hosts using current `window.__streamlit` fields.
4. Preserve current page-routing semantics for existing multipage apps.

## Issue-by-issue plan

### #7074: 404 health checks on direct subpage URLs

#### Problem
Direct subpage loads are ambiguous: `/foo/bar` can mean either app base path `/foo` + page `bar`, or app base path `/foo/bar` + main page. Current logic probes both possibilities, so one request can 404.

#### Improvements
1. Add deterministic base-path hints (opt-in, additive):
- Introduce optional bootstrap metadata (for example in `window.__streamlit`) that provides a canonical backend base URL + main-page base URL when the host knows it.
- Use this hint to skip ambiguous probing when present.

2. Reorder/short-circuit candidate probing with persisted success cache:
- Cache last successful base URI per app origin (session/local storage).
- Try cached candidate first; fall back to current heuristic if it fails.

3. Suppress noisy error reporting for expected first-candidate misses:
- Treat a single initial 404 in ambiguity resolution as a non-reportable event (still retry internally).

#### Compatibility
- No existing URL scheme changes.
- Heuristic probing remains as fallback when hints are unavailable.

---

### #8188: unnecessary failover on `/_stcore/stream`

#### Problem
In proxy/CDN setups that rewrite 404s to `index.html`, false-positive 2xx responses can make the frontend select the wrong base URI, causing websocket loops/hangs.

#### Improvements
1. Validate ping payload semantics before accepting a candidate:
- Health response must be either `"ok"` or a valid JSON status object.
- Host-config response must parse to an object with required shape (for example `allowedOrigins`).
- If payload is HTML/fallback content, mark candidate invalid and continue.

2. Add endpoint-specific failure classification:
- Distinguish `404`, auth/redirect behavior, and CDN HTML fallback in logs + retry reason.

3. Keep retrying with stronger backoff for repeated invalid candidates:
- Expand backoff ceiling for persistent failures to reduce request storms.

4. Improve deployment docs:
- Explicitly document that `/_stcore/*` should not be rewritten to SPA fallback pages.
- Provide known-good reverse proxy / CloudFront / ALB websocket rules.

#### Compatibility
- Existing successful deployments are unaffected.
- Validation only rejects responses that were never valid Streamlit endpoint payloads.

---

### #7076: health endpoint instability in cloud deployments

#### Problem
Part of the original report (JSON parsing of plain-text health) is already addressed in current frontend parsing, but cloud/proxy deployments still report reruns/reconnect churn.

#### Improvements
1. Preserve current health endpoint contract, add optional structured format:
- Keep plain text `"ok"` for compatibility.
- Optionally support structured JSON health responses (new endpoint or content-negotiated mode) for hosts that prefer strict parsing.

2. Improve reconnect behavior around transient network/proxy faults:
- Differentiate transient timeout/network errors vs terminal auth/configuration failures.
- Avoid aggressive retry cadence on persistent 403/redirect/auth failures.

3. Add diagnostics for proxy/websocket misconfiguration:
- Emit clearer client error categories to aid ops triage (upgrade headers missing, auth redirect loops, etc.).

4. Tie to session continuity work:
- Coordinate with reconnect-to-existing-session work (related #8901) to reduce user-visible resets after short disruptions.

#### Compatibility
- Existing health endpoint and polling flow remain supported.
- New behavior is additive and can be rolled out gradually.

---

### #8713: custom 404 / error / maintenance pages

#### Problem
Users can suppress built-in dialogs via host config, but cannot define first-class custom fallback UIs for page-not-found, startup failure, or maintenance states.

#### Improvements
1. Host-level customization (additive):
- Extend host-config contract with optional fields for custom error/not-found/maintenance rendering.
- If absent, keep existing dialogs unchanged.

2. Python API (additive, opt-in):
- Introduce explicit APIs for custom not-found/error/maintenance behavior.
- Reuse existing page-not-found signals (`lib/streamlit/commands/navigation.py:74`, `lib/streamlit/runtime/scriptrunner/script_runner.py:585`).

3. Safe fallback behavior:
- If custom error page logic fails, automatically fall back to built-in error dialogs.

4. Optional low-level hook alignment with #3426:
- Provide a minimal exception-handler hook for observability integrations (Sentry, etc.) without changing default exception handling.

#### Compatibility
- No behavior change for apps that do not opt in.
- Existing host message contracts continue to work.

## Execution phases

### Phase 0: hardening + observability (low risk)
- Add payload validation for init pings.
- Add richer telemetry categories for endpoint/proxy failures.
- Increase backoff ceiling for persistent auth/fallback failures.

### Phase 1: deterministic base resolution (medium risk)
- Add optional canonical base hints.
- Add cached successful-base preference.
- Keep heuristic fallback path.

### Phase 2: UX extensibility (medium risk)
- Add host-config and Python API for custom error/not-found/maintenance surfaces.
- Keep built-in dialogs as default.

### Phase 3: docs + rollout
- Deployment docs for reverse proxies/CDNs and websocket/header requirements.
- Migration guidance and examples for optional new configs/APIs.

## Test plan
- Frontend unit tests for:
  - candidate validation (valid JSON/text vs HTML fallback),
  - base URI selection with/without hints,
  - retry/backoff behavior under repeated 403/404/HTML fallback.
- Backend tests for:
  - optional structured health response mode,
  - custom error-page routing fallback behavior,
  - compatibility of existing `/_stcore/*` endpoints.
- Integration tests with simulated reverse-proxy behaviors:
  - 404->index fallback,
  - websocket upgrade header stripping,
  - subpath deployments and direct subpage deep links.

## Exit criteria
- Direct subpage loads no longer get stuck in endpoint/websocket failover loops.
- Request storm volume is reduced on persistent auth/proxy failures.
- Existing apps run unchanged without configuration updates.
- Opt-in custom error/not-found/maintenance experiences are supported and failure-safe.
