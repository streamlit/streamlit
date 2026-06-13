---
author: lukasmasuch
created: 2026-06-06
---

# Per-user app analytics on the metrics endpoint

## Summary

Add a config option that lets a host platform expose **per-user app usage analytics**
(opens, unique visitors, engagement) on the existing `/_stcore/metrics` endpoint, with
the user identity coming from `st.user` (i.e. the `server.trustedUserHeaders` mechanism).
The feature is **off by default** and, when enabled, emits a new metric family
(`user_session_events`) labeled with configured `st.user` attributes (e.g. `email`)
alongside the session-event metrics already published today.

This unlocks app-level adoption analytics for managed hosting environments —
specifically Streamlit in Snowflake (SiS), which scrapes `/_stcore/metrics` and forwards
metrics to a Snowflake event table.

## Problem

Streamlit already exposes anonymous session metrics on `/_stcore/metrics`:
`session_events` (connect/reconnect/disconnect counters), `session_duration_seconds`,
and `active_sessions`. SiS scrapes this endpoint every 60s and ingests the metrics into a
customer event table for app observability.

These metrics answer *"how much"* but not *"who"*. Host platforms (SiS in particular)
need to answer app-owner questions like:

- **Total opens / views** for an app over the last N days.
- **Unique visitors** over a time window.
- **Daily active users (DAU)** and hour-of-day usage.

The current metrics are aggregate counters with no user attribution, so unique-visitor and
per-user view counts are impossible to derive. There is no way to attribute a connect to a
specific authenticated user, even though that identity is already available to the app via
`st.user` (populated from `server.trustedUserHeaders` on SiS).

Today the only way for SiS to get this is to **monkey-patch Streamlit internals**
(wrap `WebsocketSessionManager` lifecycle methods and `Runtime.__init__` to register a
custom `StatsProvider`). That approach is explicitly called out as brittle in the SiS
implementation plan and only exists because OSS Streamlit has no supported hook. This spec
upstreams a first-class, opt-in mechanism so host platforms no longer need to patch
internals.

Related: this builds directly on the existing metrics endpoint and the
`server.trustedUserHeaders` identity mechanism.

## Proposal

A new server config option enables per-user session-event metrics on the existing
metrics endpoint. The option doubles as the **privacy control**: it lists which `st.user`
attributes are attached as metric labels. When unset (default), no per-user metrics are
emitted and behavior is unchanged.

### Config

```toml
# .streamlit/config.toml
[server]
# Attributes from st.user to expose as labels on per-user analytics metrics.
# When empty (default), no per-user metrics are emitted.
unsafeMetricsUserAttributes = ["email"]
```

- **`server.unsafeMetricsUserAttributes`** : `list[str]`, default `[]`, hidden.
  A list of `st.user` keys (typically populated via `server.trustedUserHeaders`) whose
  values are attached as labels to the new `user_session_events` metric family. An empty
  list (the default) disables the feature entirely — the server does not read, cache, or
  track per-user metric attributes, the family is not emitted, and the metrics endpoint
  output is byte-for-byte unchanged. The `unsafe` prefix is intentional:
  enabling this can expose user-identifying values on the unauthenticated metrics endpoint
  and must only be done in hosting environments that restrict endpoint access. The option
  should be created with `visibility="hidden"` until the API and docs are finalized.

Because the metrics endpoint and identity propagation are deployment-environment concerns
(not app behavior), this is a `config.toml` option rather than an `st.*` command, matching
`server.trustedUserHeaders` and `browser.gatherUsageStats`.

### Behavior

When `server.unsafeMetricsUserAttributes` is non-empty, `/_stcore/metrics` gains one new family:

```
# HELP user_session_events Total count of session events by type and user.
# TYPE user_session_events counter
user_session_events_total{type="connect",email="alice@example.com"} 3
user_session_events_total{type="reconnect",email="alice@example.com"} 1
user_session_events_total{type="disconnect",email="alice@example.com"} 2
user_session_events_total{type="close",email="alice@example.com"} 2
user_session_events_total{type="connect",email="bob@example.com"} 5
...
```

- **Opens / views**: each fresh websocket connect increments the `connect` counter for
  that user. (A page reload that resumes an existing session counts as `reconnect`.)
- **Event types**: `connect` and `reconnect` mark sessions starting/resuming; `disconnect`
  marks the websocket dropping (the session may still resume); `close` marks the session
  being fully torn down. Both `disconnect` and `close` are attributed to the user captured
  at connect time.
- **Unique visitors**: derivable downstream by counting distinct label sets over a window.
- **Engagement**: the existing `session_duration_seconds` and `active_sessions` families
  already cover engagement; this MVP does not add per-user duration.
- The family is **filterable** via the existing `?families=user_session_events` query
  param, so a scraper can request only this family.
- Identity is captured at **connect** time only when the feature is enabled and cached per
  session (until the session is closed) so that `disconnect` and `close` events can be
  attributed to the right user. While the feature is enabled, the cached identity is
  refreshed on `reconnect`, so if a session's identity changes across a reconnect the later
  events are attributed to the most recently seen identity. When the option is empty, this
  capture/cache path is skipped entirely.
- `unsafeMetricsUserAttributes` is read at server **startup** and is not meant to be toggled on a
  running server (restart to apply a change). Like other `server.*` options, mid-session
  toggling is unsupported; per-user attribution across such a toggle is best-effort and
  undefined (e.g. a cached identity may not refresh while disabled). Hosts set this once.

#### Edge cases

- **Missing attribute**: if a configured attribute is absent from `st.user` for a session,
  its label value is the empty string (`email=""`). This keeps the metric shape stable.
- **No authenticated user** (e.g. local dev, no trusted headers): all configured labels are
  empty strings. The feature still functions but provides no useful attribution — expected,
  since it targets hosted/authenticated environments.
- **Cardinality**: emitted series scale with the number of distinct users seen by the
  process. This is acceptable for the targeted hosting environments; see Out of Scope for
  high-cardinality concerns.
- **Feature disabled**: zero overhead — no per-user attributes are read or cached, no
  counters are tracked, and no family is emitted.

### Privacy

This feature can expose PII (e.g. email) on an HTTP endpoint, so:

- It is **opt-in** and **off by default**.
- The host platform explicitly chooses which attributes to expose via
  `unsafeMetricsUserAttributes` — Streamlit never emits user identity unless configured.
- Streamlit must also avoid collecting these attributes internally unless
  `unsafeMetricsUserAttributes` is non-empty.
- Collection is **best-effort**: a failure while recording per-user metrics must never
  break app execution or deny app access.

**Endpoint access control is a prerequisite, not provided by this feature.** The existing
`/_stcore/metrics` endpoint has no built-in authentication, authorization, or IP allow-list
at the Streamlit layer — anything reachable on the server port can scrape it. Today that
exposes only anonymous aggregate counters; once `unsafeMetricsUserAttributes` is set, the same
unauthenticated endpoint also serves the configured PII. Enabling this option is therefore
**only safe when the host restricts access to the metrics endpoint at the network layer**
(the model SiS already uses — the port is internal and scraped by the platform, never exposed
to end users). This must be called out explicitly in the docs as a hard prerequisite.
Adding authentication to the metrics route itself is a broader change tracked separately and
is out of scope here (see Out of Scope).

### Examples

**SiS host config (set by the platform, not the app author):**

```toml
[server]
trustedUserHeaders = '{"Sf-Context-Current-User-Email": "email"}'
unsafeMetricsUserAttributes = ["email"]
```

**Querying just the new family from a scraper:**

```bash
curl "http://localhost:8501/_stcore/metrics?families=user_session_events"
```

## Out of Scope (Future Work)

- **Per-user session duration / engagement** — `session_duration_seconds` already covers
  aggregate engagement; per-user duration can be added later if demand exists.
- **In-product analytics UI** — the Snowsight dashboard (SiS V1) is downstream and not part
  of OSS Streamlit.
- **Cardinality protection / sampling** — bounding distinct-user series is left to the
  scraper/host pipeline (which already does rollups and retention). Revisit if OSS users
  outside hosted environments adopt this.
- **Per-widget / per-chart telemetry** — explicitly not part of this MVP.
- **Anonymization / hashing of identity in Streamlit** — the host decides what to expose;
  hashing can be done upstream of `trustedUserHeaders` if desired.
- **Authentication on the `/_stcore/metrics` endpoint** — the endpoint is currently
  unauthenticated and this spec does not change that. Hosts must restrict access at the
  network layer (see Privacy). Adding endpoint-level auth is a broader, separate effort.

## Checklist

| Item                         | ✅ or comment          |
|------------------------------|------------------------|
| Works on SiS, Cloud, etc?    | Designed for SiS; no-op everywhere unless `server.unsafeMetricsUserAttributes` is set. |
| No breaking API changes      | ✅ Additive config option; default off keeps endpoint output unchanged. |
| No new dependencies          | ✅ Reuses existing stats/metrics infrastructure. |
| Metrics collected            | ✅ This feature *is* a metrics feature; gather a usage stat when the option is enabled. |
| Any security/legal impact?   | Yes — can expose PII (email) on the metrics endpoint. Off by default, opt-in, host-controlled attribute list; needs privacy/legal review and docs. |
| Any docs changes needed?     | Yes — document `server.unsafeMetricsUserAttributes` and the `user_session_events` family before making the hidden option public. |
