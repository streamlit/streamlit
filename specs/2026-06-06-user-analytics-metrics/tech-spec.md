---
author: lukasmasuch
created: 2026-06-06
---

# Per-user app analytics on the metrics endpoint

## Summary

Implement the opt-in per-user analytics feature from the
[product spec](./product-spec.md) by extending the existing session-event recording in
`WebsocketSessionManager` and the `/_stcore/metrics` endpoint. When
`server.metricsUserAttributes` is non-empty, the session manager records per-user session
lifecycle counters (keyed by configured `st.user` attributes) and exposes them as a new
`user_session_events` metric family through the same `StatsManager` / `StatsProvider`
pipeline already used for `session_events`.

The goal is to provide a supported, first-class hook so host platforms (SiS) no longer
monkey-patch Streamlit internals to obtain user-attributed metrics.

## Problem

The metrics stack already has everything needed except user attribution:

- `WebsocketSessionManager` is a `StatsProvider` and already records `connect`,
  `reconnect`, and `disconnect` counts plus session duration and active-session gauges
  (`lib/streamlit/runtime/websocket_session_manager.py`).
- `connect_session(...)` already receives `user_info: UserInfoType` — the same dict that
  populates `st.user`, built from `server.trustedUserHeaders` in
  `starlette_websocket.py::_gather_user_info`.
- `StatsManager.get_stats(family_names=...)` and the metrics route already support
  per-family filtering (`?families=...`).

What's missing is (1) a config gate, (2) per-user counter tracking keyed by identity, and
(3) a new metric family. SiS currently fills this gap by wrapping
`WebsocketSessionManager`'s lifecycle methods and `Runtime.__init__` at import time — a
brittle workaround that exists only because OSS has no supported hook. Because the lifecycle
methods that need instrumenting already live in `WebsocketSessionManager`, the cleanest
fix is to add the recording **directly** where the existing session-event counters are
maintained, rather than via an external provider.

## Proposal

### Config option

Add `server.metricsUserAttributes` to `lib/streamlit/config.py` in the `server` section:

```python
_create_option(
    "server.metricsUserAttributes",
    description="""
        Attributes from st.user to expose as labels on per-user analytics metrics
        published at the /_stcore/metrics endpoint.

        Each entry is a key in st.user (typically populated via
        server.trustedUserHeaders). When this list is non-empty, Streamlit emits a
        ``user_session_events`` metric family labeled with these attributes, enabling
        per-user app analytics (opens, unique visitors) for host platforms that scrape
        the metrics endpoint.

        When empty (default), no per-user metrics are emitted and the metrics endpoint
        output is unchanged.

        Warning: configured attribute values (e.g. email) are exposed in plaintext on
        the metrics endpoint. Only enable this in trusted, access-controlled
        environments.

        Example: ['email', 'user_name']
    """,
    default_val=[],
    multiple=True,
    visibility="hidden",  # Hidden until reviewed/finalized, mirroring trustedUserHeaders.
)
```

Notes:
- `default_val=[]` with `multiple=True` follows the existing list-option pattern (e.g.
  `server.folderWatchList`). The empty default makes the option both the on/off switch and
  the privacy allow-list.
- Because `multiple=True` uses Click's standard multi-value handling, the env var follows
  Click's `multiple` semantics (like `server.folderWatchList`) — not a JSON list. It is
  **not** custom-parsed like `server.trustedUserHeaders` (which is `type_=str` + JSON).
- Reserved label names are rejected at config-load time: `type` is used as the
  event-type discriminator on the `user_session_events` family, so configuring it as a
  user attribute raises a clear error (mirroring the validation `server.trustedUserHeaders`
  does for duplicate user keys). This prevents a user attribute from silently shadowing the
  discriminator.
- Hidden visibility matches `server.trustedUserHeaders`, which is also experimental.

### New metric family

Add the family constant to `lib/streamlit/runtime/stats.py` next to the existing ones:

```python
USER_SESSION_EVENTS_FAMILY: Final = "user_session_events"
```

No new `Stat` subclass is needed — `CounterStat` already supports arbitrary `labels`.

### Recording per-user events in `WebsocketSessionManager`

The manager already tracks aggregate counts. We add a parallel, per-user counter map that
is only populated when the feature is enabled. Identity is read from the `user_info` dict
already passed to `connect_session`, and cached per session so disconnect/close can attribute
correctly.

**State (in `__init__`):**

```python
# Per-user session event counters: {(label_tuple): {event_type: count}}.
# label_tuple is a tuple of (attr_name, attr_value) pairs in stable order.
# Annotate as defaultdict so the auto-creation used at the lifecycle points
# below type-checks.
self._user_event_counts: defaultdict[
    tuple[tuple[str, str], ...], defaultdict[str, int]
] = defaultdict(lambda: defaultdict(int))
# Cache identity by session id, retained until close_session so both the
# disconnect and the terminal close event attribute to the right user.
self._session_user_labels: dict[str, tuple[tuple[str, str], ...]] = {}
```

The session manager today only has `_EVENT_TYPE_{CONNECT,RECONNECT,DISCONNECT}`. Add a
fourth constant for the terminal event:

```python
_EVENT_TYPE_CLOSE: Final = "close"
```

Note the per-user family intentionally distinguishes `disconnect` (websocket dropped — the
session is saved to storage and may resume) from `close` (the session is fully torn down),
giving four event types. This is deliberately finer-grained than the existing aggregate
`session_events` family, where `close_session` folds into the `disconnect` counter — that
aggregate behavior is unchanged.

Both maps grow with the number of distinct users (and live sessions) seen by the process
and are never pruned, so they are unbounded over the process lifetime. This is acceptable
for the targeted hosting environments (see the product spec's cardinality note); a soft
cap / eviction is a sensible near-term follow-up if OSS adoption widens.

**Helper — resolve labels from `user_info` (fail-open):**

```python
def _user_labels(self, user_info: UserInfoType) -> tuple[tuple[str, str], ...] | None:
    """Return ordered (name, value) label pairs, or None if the feature is off."""
    attrs = config.get_option("server.metricsUserAttributes")
    if not attrs:
        return None
    # Treat only a missing/None attribute as empty. Coercing with `or ""` would
    # turn a legitimate falsy value (e.g. False) into "", making it
    # indistinguishable from "attribute absent".
    return tuple(
        (name, "" if (value := user_info.get(name)) is None else str(value))
        for name in attrs
    )
```

**Recording at lifecycle points** (additive, inside the existing `self._stats_lock`
blocks so the new map stays consistent with the aggregate counters):

```python
# In connect_session, fresh-connect branch (after self._connect_count += 1):
labels = self._user_labels(user_info)
if labels is not None:
    self._user_event_counts[labels][_EVENT_TYPE_CONNECT] += 1
    self._session_user_labels[session.id] = labels

# In connect_session, reconnect branch (after self._reconnect_count += 1):
labels = self._user_labels(user_info)
if labels is not None:
    self._user_event_counts[labels][_EVENT_TYPE_RECONNECT] += 1
    self._session_user_labels[existing_session.id] = labels

# In disconnect_session (after self._disconnect_count += 1):
# Keep the cached labels so a later close_session can still attribute the
# terminal close event to this user. Only record while the feature is
# currently enabled — consistent with the "feature disabled = no per-user
# counters tracked" rule in the product spec.
if config.get_option("server.metricsUserAttributes"):
    labels = self._session_user_labels.get(session_id)
    if labels is not None:
        self._user_event_counts[labels][_EVENT_TYPE_DISCONNECT] += 1

# In close_session (both the active-close and storage-cleanup paths):
# Pop the cached labels (final cleanup, even if the feature was disabled at
# runtime since connect) and record the close event while enabled.
labels = self._session_user_labels.pop(session_id, None)
if labels is not None and config.get_option("server.metricsUserAttributes"):
    self._user_event_counts[labels][_EVENT_TYPE_CLOSE] += 1
```

**Identity retention and cleanup.** Unlike `_session_connect_times` (popped at disconnect
when duration is finalized), `_session_user_labels` is retained from connect until
`close_session` so the terminal close event stays attributable. In the normal flow
(connect → disconnect → close) close fires when the session is evicted from storage after
`server.disconnectedSessionTTL`; a session closed while still active (no prior disconnect)
records only `close`. The map is therefore bounded by the live-plus-disconnected session
set, not by all-time connects.

All recording is wrapped so a telemetry error cannot break the connection lifecycle
(best-effort, per NFR-4). The simplest robust approach is to guard the small recording
blocks with a `try/except` that logs at debug level, since `config.get_option` and dict
operations are the only failure surfaces.

`_user_labels` reads `config.get_option("server.metricsUserAttributes")` on every
connect/reconnect/disconnect/close (and `get_stats` reads it per scrape). Config reads are a
cheap dict lookup, so reading live is fine for the expected throughput. If profiling later
flags this as hot, the resolved attribute list can be cached on the instance — deferred
until there's evidence it matters.

The option is expected to be set once at **startup** (it has hidden visibility and is
host-configured); like other `server.*` options, toggling it on a running server is **not a
supported configuration**. Reading it live keeps the gate simple and trivially toggleable
in tests, but per-user attribution across a mid-session enable→disable→enable is explicitly
best-effort and undefined: while disabled, `_user_labels` returns `None`, so the reconnect
branch does not refresh `_session_user_labels`, and a cached identity can therefore go stale
across a runtime disable. This edge case is out of scope precisely because runtime toggling
is unsupported; under the startup-only assumption the gate is constant and no staleness
arises. (The disconnect branch still re-checks the option only so a runtime disable stops
*emitting* new per-user events; it does not attempt to keep stale caches correct.)

**Exposing the family** — extend `stats_families` and `get_stats`:

```python
@property
def stats_families(self) -> Sequence[str]:
    # Advertise the family unconditionally (do NOT gate on the config option).
    # StatsManager.register_provider snapshots stats_families once at
    # registration; gating here would drop the family from the snapshot when
    # the option is empty at startup, and it would then never be routed to this
    # provider even after the option is enabled. Emission is gated in get_stats
    # instead.
    return (
        SESSION_EVENTS_FAMILY,
        SESSION_DURATION_FAMILY,
        ACTIVE_SESSIONS_FAMILY,
        USER_SESSION_EVENTS_FAMILY,
    )

# In get_stats, when USER_SESSION_EVENTS_FAMILY is requested:
if config.get_option("server.metricsUserAttributes") and (
    family_names is None or USER_SESSION_EVENTS_FAMILY in family_names
):
    with self._stats_lock:
        snapshot = {
            labels: dict(events)
            for labels, events in self._user_event_counts.items()
        }
    result[USER_SESSION_EVENTS_FAMILY] = [
        CounterStat(
            family_name=USER_SESSION_EVENTS_FAMILY,
            value=count,
            # `type` is the event-type discriminator and must win over any
            # user attribute. Unpack user labels first, then set `type`, so a
            # configured attribute literally named "type" can't clobber it.
            # Reserved label names are also rejected at config-load time (see
            # the config option notes), so this is belt-and-suspenders.
            labels={**dict(labels), "type": event_type},
            help="Total count of session events by type and user.",
        )
        for labels, events in snapshot.items()
        for event_type, count in events.items()
    ]
```

`StatsManager.register_provider` snapshots `stats_families` once at registration and maps
each advertised family to this provider; it never re-reads the property afterwards. That is
exactly why the family is advertised **unconditionally** above: gating it on the config
option would omit `user_session_events` from the snapshot whenever the option is empty at
startup, and `?families=user_session_events` / full scrapes would then never reach this
provider even after the option is later enabled. Emission is instead gated inside
`get_stats`: when the option is empty, the family is simply absent from the returned mapping
(or an empty list), and `_stats_to_text` / `_stats_to_proto` skip empty families — so the
endpoint output stays byte-for-byte unchanged while disabled, with no dependency on config
load ordering relative to registration.

### Endpoint

No changes to `starlette_routes.py`. The new family flows through the existing
`_metrics_endpoint`, serializes via `CounterStat.to_metric_str` /
`marshall_metric_proto` (text and protobuf both supported), and is filterable via
`?families=user_session_events`.

### Usage stat

Gather a usage stat (via the existing telemetry mechanism) recording that the feature is
enabled, so adoption is observable. This is a one-time/coarse signal, not per-event.

### Testing

- **Unit (`lib/tests/streamlit/runtime/websocket_session_manager_test.py`)**:
  - Disabled (default): `get_stats()` returns no `user_session_events` series and the
    endpoint output is unchanged. Note `stats_families` *still* includes the family (it is
    advertised unconditionally so registration routes it); only emission is gated. The
    test should assert on the absence of emitted series / unchanged output, **not** on
    `stats_families` excluding the family.
  - Enabled: connect/reconnect/disconnect/close increment the right per-user counters with
    the right labels; missing attribute → empty-string label; multiple users tracked
    independently; `?families` filtering returns only the requested family.
  - Close attribution: connect → disconnect → close records `connect`, `disconnect`, and
    `close` attributed to the connect-time user, since labels are retained until
    `close_session`. A session closed while active (no prior disconnect) records `close`
    but not `disconnect`.
  - Runtime disable: with cached session labels from an earlier (enabled) connect, a
    subsequent disconnect/close after the option is cleared records no per-user event (cache
    is still popped on close for cleanup).
  - Fail-open: a malformed `user_info` does not raise from `connect_session`.
- **Unit (`lib/tests/streamlit/runtime/stats_test.py`)**: `CounterStat` with combined
  `type` + identity labels serializes correctly (label ordering is already sorted in
  `to_metric_str`).
- **Server (`starlette_app_test.py`)**: end-to-end GET of `/_stcore/metrics` with the
  option set returns the new family in both text and protobuf.
- **Config test**: option parses from TOML, from the env var via Click's `multiple`
  semantics (whitespace-separated, matching `server.folderWatchList` — not a JSON list),
  and from repeated CLI flags. A reserved attribute name (`type`) raises at config load.

## Alternatives Considered

**1. External `StatsProvider` + monkey-patching (current SiS approach).**
Register a separate provider and wrap `WebsocketSessionManager` lifecycle methods and
`Runtime.__init__` at import time. Rejected for upstreaming: brittle, idempotency hazards
on double-import, and duplicates state that the session manager already owns. The whole
point of this spec is to remove the need for it. Recording inline where the aggregate
counters already live is simpler and race-free (shares `_stats_lock`). That prototype does,
however, validate the data model adopted here: the same `user_session_events` family name,
the connect/reconnect/disconnect/**close** event set, identity captured at connect and
cached by `session_id` for later attribution, empty-string coercion of missing attributes,
and per-label-tuple aggregation under a lock. The main improvements upstreamed here are the
config-driven (rather than hardcoded) label set and the env-var kill switch replaced by the
`server.metricsUserAttributes` option.

**2. New top-level `StatsProvider` registered in `Runtime` (no patching).**
Cleaner than patching but still needs its own lifecycle hooks into session connect/disconnect
— which only exist inside `WebsocketSessionManager`. It would require new public callbacks
or signals just to feed the provider, more surface area than extending the existing provider.
Deferred; could be revisited if we want pluggable analytics backends.

**3. Boolean `server.enableUserMetrics` + hardcoded labels (e.g. always `email`).**
Simpler, but bakes in an assumption about which identity field exists and forces emitting
whatever PII is hardcoded. The list-valued option doubles as the privacy allow-list and
adapts to whatever `trustedUserHeaders` mapping the host uses (`email`, `user_name`, etc.),
matching API principle "Prefer enums/lists over booleans" for expandability.

**4. New `[metrics]` config section.**
A dedicated section (`metrics.userAttributes`, future `metrics.enabled`, etc.) is tidy but
premature for a single option. The metrics endpoint is otherwise configured implicitly and
lives under server concerns; keep it in `server.*` for now and promote to a section only if
more metrics options accrue.

**5. Per-user duration/engagement in the same family.**
Out of scope for MVP (see product spec). Aggregate `session_duration_seconds` already
exists; adding per-user duration multiplies cardinality and complexity without a confirmed
requirement.
