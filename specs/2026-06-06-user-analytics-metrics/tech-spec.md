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
self._user_event_counts: dict[tuple[tuple[str, str], ...], dict[str, int]] = (
    defaultdict(lambda: defaultdict(int))
)
# Cache identity by session id so disconnect/close attribute to the right user.
self._session_user_labels: dict[str, tuple[tuple[str, str], ...]] = {}
```

**Helper — resolve labels from `user_info` (fail-open):**

```python
def _user_labels(self, user_info: UserInfoType) -> tuple[tuple[str, str], ...] | None:
    """Return ordered (name, value) label pairs, or None if the feature is off."""
    attrs = config.get_option("server.metricsUserAttributes")
    if not attrs:
        return None
    return tuple(
        (name, str(user_info.get(name) or "")) for name in attrs
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

# In disconnect_session / close_session (after self._disconnect_count += 1):
labels = self._session_user_labels.pop(session_id, None)
if labels is not None:
    self._user_event_counts[labels][_EVENT_TYPE_DISCONNECT] += 1
```

All recording is wrapped so a telemetry error cannot break the connection lifecycle
(best-effort, per NFR-4). The simplest robust approach is to guard the small recording
blocks with a `try/except` that logs at debug level, since `config.get_option` and dict
operations are the only failure surfaces.

**Exposing the family** — extend `stats_families` and `get_stats`:

```python
@property
def stats_families(self) -> Sequence[str]:
    families = [SESSION_EVENTS_FAMILY, SESSION_DURATION_FAMILY, ACTIVE_SESSIONS_FAMILY]
    if config.get_option("server.metricsUserAttributes"):
        families.append(USER_SESSION_EVENTS_FAMILY)
    return tuple(families)

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
            labels={"type": event_type, **dict(labels)},
            help="Total count of session events by type and user.",
        )
        for labels, events in snapshot.items()
        for event_type, count in events.items()
    ]
```

`stats_families` advertising the family conditionally means `StatsManager.register_provider`
must run after config is loaded. It already does — registration happens in `Runtime.__init__`
(`lib/streamlit/runtime/runtime.py`), well after config parsing. Reading the option live in
`stats_families`/`get_stats` also lets tests toggle it without re-registering.

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
  - Disabled (default): no `user_session_events` in `get_stats()`; `stats_families`
    excludes it; endpoint output unchanged.
  - Enabled: connect/reconnect/disconnect increment the right per-user counters with the
    right labels; missing attribute → empty-string label; multiple users tracked
    independently; `?families` filtering returns only the requested family.
  - Fail-open: a malformed `user_info` does not raise from `connect_session`.
- **Unit (`lib/tests/streamlit/runtime/stats_test.py`)**: `CounterStat` with combined
  `type` + identity labels serializes correctly (label ordering is already sorted in
  `to_metric_str`).
- **Server (`starlette_app_test.py`)**: end-to-end GET of `/_stcore/metrics` with the
  option set returns the new family in both text and protobuf.
- **Config test**: option parses from TOML, env var (JSON list), and CLI.

## Alternatives Considered

**1. External `StatsProvider` + monkey-patching (current SiS approach).**
Register a separate provider and wrap `WebsocketSessionManager` lifecycle methods and
`Runtime.__init__` at import time. Rejected for upstreaming: brittle, idempotency hazards
on double-import, and duplicates state that the session manager already owns. The whole
point of this spec is to remove the need for it. Recording inline where the aggregate
counters already live is simpler and race-free (shares `_stats_lock`).

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
