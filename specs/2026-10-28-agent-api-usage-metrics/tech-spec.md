---
author: lukasmasuch
created: 2026-10-28
---

# Agent API usage metrics

## Summary

Count agent API activity in each server process, across the HTTP route and the MCP
endpoint, and attach the counts to the `PageProfile` message that browser sessions
already report. Browsers remain the only telemetry sender, and the server still sends
nothing. The counts are cumulative and come with a random per-process id. Any
later page profile therefore carries activity that happened while no browser was
connected, and the counts from different processes can be added up without
double-counting.

## Problem

We cannot tell whether anyone uses the
[agent API](../2026-08-28-agent-app-interface/product-spec.md). The parent spec leaves
metrics out of v1: Streamlit's usage stats are reported by the browser, and an agent
session has no browser. The next decisions need data:

- **Adoption:** how many apps that turn on `server.enableAgentApi` get agent traffic.
- **Transport:** whether agents connect over HTTP or over the
  [Model Context Protocol (MCP) endpoint](https://github.com/streamlit/streamlit/pull/17510).
  The MCP spec asks for the transport and the negotiated protocol version to be
  recorded once agent metrics exist. This spec records the transport, and leaves
  protocol versions [out of scope](#out-of-scope).
- **Default-on:** the parent spec's first
  [follow-up](../2026-08-28-agent-app-interface/product-spec.md#follow-ups) turns the
  API on for every app. Today nothing measures whether agents try to use apps that
  have it off, which is the demand that follow-up is meant to serve.

One part is already measured. The page profile's `config` field lists every option
that was set manually, so `server.enableAgentApi` appears there when an app enables it.
A value set to the default is listed as `server.enableAgentApi:default`.

The backend sends no telemetry today, and this spec does not change that. Agent requests
reach the same server process that browser sessions use, though, and a browser session
reports a page profile after each script run.

## Proposal

### What is counted

One module, `streamlit/runtime/agent/usage.py`, holds each process's counters.

| Counter             | Incremented when                                                                                          | Answers                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `http_interactions` | `POST /_stcore/agent/interact` calls `interaction.interact()`, or refuses because the API is off          | Is it used, and how much? Do agents try apps that have it off? |
| `mcp_interactions`  | The MCP `interact` tool calls `interaction.interact()`, or the MCP route refuses because the API is off   | Which transport do agents use?                                 |
| `sessions`          | `AgentSessionRegistry.create()` returns a session                                                         | Many agents, or one long loop?                                 |

- **Counted on the shared path.** The parent and MCP specs require one code path for
  both transports, `interaction.interact()`. A new keyword-only argument,
  `transport: Literal["http", "mcp"]`, names the route that made the call. Each route
  passes its own value, so no route can skip the count.
- **One count per `interact` call, whatever its outcome.** A request the operation
  refuses, such as `invalid_request` or `unknown_session`, is still an agent using the
  API. A retry that collects a timed-out run is counted too. Requests the route
  refuses before they reach `interact()` are not counted: a refused `Host` or `Origin`,
  an oversized body, or a body that is not valid JSON. A refused `Origin` comes from a
  web page, not from an agent.
- **With the API off, the same counters count refusals that reach the `not_available`
  branch.** The routes are registered even then, so that the discovery link always
  works, and counting there costs one increment.
  - That branch returns before the Host, Origin, and content-type checks today, so the
    implementation runs those checks first and counts the request only when they pass.
    The response is `not_available` either way: a web page or a refused `Host` is not
    an agent.
  - The body is not read, so a POST counts whatever its body, unlike while the API is
    on.
  - An MCP client stops after its first refused `initialize`, so the MCP count is about
    one per attempt.
  - `config` in the same event says whether the API was on, so no separate counter is
    needed.
  - Fetching the schema (`GET openapi.json`) is not counted; see
    [Out of scope](#out-of-scope).
- **`instance_id`**, a random `uuid4` hex, is attached to the counts. It is created on
  the first count rather than at import, so a server that forks its workers after
  importing Streamlit, such as `gunicorn --preload`, gives each worker its own. Counts
  are cumulative and never reset, so one page profile can report a number that an
  earlier one already included. The id groups reports by process, which makes them
  additive across restarts and replicas. See [Analysis](#analysis).

Nothing is counted while `browser.gatherUsageStats` is off. `config.toml` is reloaded
while the server runs, so counts kept during an opt-out would otherwise be reported
once it is turned on again. Reporting uses the same gate as every other page profile
field: the script thread reads the option when it starts.

### Reporting

```proto
// PageProfile.proto
message PageProfile {
  ...
  // Agent API activity in this server process. Unset while every count is zero.
  AgentApiUsage agent_api_usage = 15;
}

// Agent API activity in one server process. Cumulative since this process
// started, so a later page profile still includes activity from when no
// browser was connected.
message AgentApiUsage {
  // Random id of the server process, so that counts from different processes
  // (restarts, replicas, forked workers) are never mixed.
  string instance_id = 1;
  int64 http_interactions = 2;
  int64 mcp_interactions = 3;
  int64 sessions = 4;
}

// MetricsEvent.proto, which already imports PageProfile.proto
AgentApiUsage agent_api_usage = 49;
// Next ID: 50
```

- **Backend:** `create_page_profile_message` calls `agent_usage.fill_page_profile(...)`.
  That call copies the counts, and leaves the field unset when all of them are zero.
  Most apps never receive an agent request, so their page profiles do not change.
- **Frontend:** no code change. `App.handlePageProfileMsg` already spreads
  `PageProfile.toObject(...)` into the `pageProfile` event, the same way it forwards
  `commands` and every other page profile field. A new field on `MetricsEvent` is
  enough. `browser_info` is the precedent for a nested message there.
- **Hosts** that collect metrics through `postMessage` receive the field with no change
  on their side.

```python
# lib/streamlit/runtime/agent/usage.py (sketch)
Transport: TypeAlias = Literal["http", "mcp"]
UsageCounter: TypeAlias = Literal["http_interactions", "mcp_interactions", "sessions"]

_INTERACTION_COUNTERS: Final[dict[Transport, UsageCounter]] = {
    "http": "http_interactions",
    "mcp": "mcp_interactions",
}
_lock: Final = threading.Lock()
_counts: dict[UsageCounter, int] = dict.fromkeys(get_args(UsageCounter), 0)
_instance_id: str | None = None


def record(counter: UsageCounter) -> None:
    """Increment ``counter`` by one, unless usage stats are off."""
    global _instance_id
    if not config.get_option("browser.gatherUsageStats"):
        return
    with _lock:
        if _instance_id is None:
            _instance_id = uuid.uuid4().hex
        _counts[counter] += 1


def record_interaction(transport: Transport) -> None:
    """Count one agent request on the counter for the route it arrived on."""
    record(_INTERACTION_COUNTERS[transport])


def fill_page_profile(page_profile: PageProfile) -> None:
    """Copy the counts onto ``page_profile``, unless every count is zero."""
    with _lock:
        counts = dict(_counts)
        instance_id = _instance_id
    if instance_id is not None and any(counts.values()):
        page_profile.agent_api_usage.instance_id = instance_id
        for name, value in counts.items():
            setattr(page_profile.agent_api_usage, name, value)
```

- **Threading:** increments happen on the event loop and the copy on a script thread,
  so one lock guards both, as `PagesManager` does for its page registry. Each event is
  counted on its own, so a page profile might still see one counter updated and
  another not yet. That skew is acceptable for telemetry.
- **Cost:** one config read, one uncontended lock, and one dictionary increment per
  agent request, and one copy of three integers per page profile.
  `streamlit.runtime.agent` imports nothing at package level, and `usage.py` imports
  only modules `metrics_util` already loads, so `metrics_util` gains only the cost of
  that one small module.

### Analysis

For the data team, from `pageProfile` events. The fields arrive as
`agentApiUsage.httpInteractions` and so on. Protobuf's JSON encoding writes `int64`
values as decimal strings, as it does for `execTime`, and omits a count of zero, so
treat a missing count as 0.

- **Apps with agent traffic:** distinct apps (`report_hash`, or `app_id` where the host
  sets it) whose `config` lists `server.enableAgentApi` (not `:default`), with any
  event where `http_interactions + mcp_interactions > 0`.
- **Reported activity in a window:** for each counter and `instance_id`, subtract the
  largest value reported before the window (0 if there is none) from the largest value
  reported up to the window's end, then sum over instances. Both maximums cover every
  report so far, so the difference stays at 0 or more even when a late report carries
  a smaller count than one already seen. Reports arrive late, so this is the activity
  reported in the window, not the activity that happened in it. See
  [Limitations](#limitations).
- **Requests per session:** on apps with the API on, interactions divided by
  `sessions`. Retries that collect a slow run count too, so this measures requests,
  not steps.
- **Unmet demand:** apps whose `config` does not enable the API
  (`server.enableAgentApi` absent or `:default`), with
  `http_interactions + mcp_interactions > 0`. This reading holds while off is the
  default. It undercounts agents, since an agent that reads `openapi.json` first learns
  that the API is off and may never send a request. It also counts scanners and manual
  `curl` calls, which the off path cannot tell apart from an agent.

### Limitations

- **No browser, no report.** A process that only agents use reports nothing, because
  no browser session ever runs the script. Examples are a coding agent verifying an app
  headless in CI, or a scheduled job. A restart also loses whatever no page profile
  reported. v1 therefore measures apps that also have human viewers. That is the
  population default-on is decided for, and it includes the common local loop, where
  the developer's open tab reruns after the agent's edits.
- **Reported late.** The browser sends the counts on its next script run after the
  activity, not when the activity happens. An idle tab sends nothing until it reruns.
- **Replicas report separately.** With several replicas, each browser session reports
  only its own process. `instance_id` keeps those reports apart.
- **An edit before a restart is misread.** The routes read `server.enableAgentApi`
  once at startup, but `config` follows `config.toml`, which is reloaded while the
  server runs. Between an edit and the restart that applies it, refusals read as
  usage, or usage as unmet demand.

### Privacy

- **Counts only:** no session handle, labels, values, data, URLs, or identity. The
  parent spec's content-free audit log is a separate follow-up.
- **The same gate as every page profile field:** counted and reported only while
  `browser.gatherUsageStats` is on, and reported only when the host has not turned
  metrics off.
- **A browser reports traffic it did not cause.** A viewer's page profile carries
  counts of agent traffic from other callers. The counts describe the deployment, not
  the viewer, in the same way that `config` and `attributions` do.
- **Every viewer can read the counts.** The page profile reaches the browser over the
  WebSocket even when the host turns metrics off. A viewer of a public app can
  therefore see how much agent traffic the process served, and tell restarts or
  replicas apart by `instance_id`. Unlike `config` and `attributions`, this changes
  while the app runs.
- **`instance_id` is a process id, not a user or machine id.** It is random and
  contains no machine or user data. Every event from that server already carries
  `machine_id_v4`, which stays the same across restarts; `instance_id` only separates
  one process lifetime from the next.

### Testing

- **Python unit tests:**
  - `usage`: counts, the id created on the first count, nothing counted while
    `browser.gatherUsageStats` is off, and the field left unset at zero.
  - `create_page_profile_message`: the field is filled.
  - `interact()`: increments its transport's counter exactly once per call, including
    a refused call.
  - `AgentSessionRegistry.create()`: increments `sessions` only when it succeeds, not
    when it fails with `too_many_sessions`.
  - The disabled route: increments `http_interactions`, whatever the body. A request
    that the Host, Origin, or content-type check would refuse increments nothing, and
    is still answered `not_available`.
- **Frontend unit test:** a `pageProfile` event forwards `agentApiUsage` through
  `MetricsEvent.toJSON()`, and omits it when the message has none.
- **No e2e test:** the field adds no UI, and the unit tests on both sides cover the
  path from the counter to the event.

### Rollout

- Ships with HTTP counting. The MCP endpoint PR passes `transport="mcp"` and counts its
  refusals while the API is off. Until then, `mcp_interactions` stays zero. It ships
  now so that the MCP endpoint needs no second schema change.
- A new `MetricsEvent` field is a schema change for the metrics pipeline. The
  `MetricsManager` comment requires the data team to request or approve such changes,
  so the data team must sign off before merge.
- The public description of collected telemetry, the Telemetry section of the
  configuration docs, says only that Streamlit collects usage statistics and cannot see
  or store the information in apps. It lists no page profile fields, and these counts
  hold no app content, so it needs no change.

## Alternatives Considered

**Option 1: A boolean `agent_api_used`.** The simplest option. It answers adoption only,
and a counter costs the same.

**Option 2: One cumulative counter, `agent_api_interactions`.** The minimal useful
version, and the fallback if the extra fields meet resistance. It cannot show the
transport, or separate many agents from one long loop. It would also need
`instance_id` to be added up correctly.

**Option 3: An `AgentApiUsage` message with cumulative counts and `instance_id`** ✅
PREFERRED. It is three integers and an id, and each answers a question listed under
[Problem](#problem).

**Option 4: Counts since the last page profile, reset on read.** These add up without
an id, but any page profile that never reaches the metrics service loses its counts.
That happens with an ad blocker, a host that turns metrics off, a tab closed during a
run, or dev mode. Two browser sessions would also race to consume the same counts.
Cumulative counts lose nothing as long as any later report arrives.

**Option 5: Report from the server.** This would cover agent-only processes. But it adds
the server's first outbound telemetry call. That is a new network dependency, a privacy
surface `browser.gatherUsageStats` does not describe, and a call that fails in
locked-down deployments such as SiS.

**Option 6: Keep counts on disk (for example, under `~/.streamlit/`), and report them
from the next browser session on the machine.** This would cover restarts and local
agent-only runs. It adds file writes from the server, coordination between processes,
and stale files. Revisit it if agent-only processes turn out to be the gap that
matters.

**Option 7: Push the counts to connected browsers when they change.** This would remove
the reporting delay, at the cost of a new `ForwardMsg` to every session, sent only for
telemetry.

**Option 8: Also expose the counts on `/_stcore/metrics`.** The operator pulls that
OpenMetrics endpoint, so it needs no outbound call, and it would show agent-only
processes to an operator who scrapes it. Streamlit's own metrics would still not see
them. It can be added later without changing this design.

## Out of scope

- **Outcome and latency:** counts per error code, and response times. These would show
  whether models learn the protocol, but they go beyond "is it used", which is the
  question here.
- **Schema fetches:** a crawler can follow `<link rel="service-desc">`, so a `GET` of
  `openapi.json` does not show that an agent tried. A refused `interact` request
  measures the attempt instead.
- **MCP `get_data` calls, client names, and protocol versions:** `get_data` follows an
  `interact` call, which is already counted. Client names and protocol versions can be
  added with the MCP endpoint if needed.
- **Page profiles from agent sessions:** an agent session's run builds a page profile,
  including command tracking and skill detection. The agent client stores it and never
  sends it. Reporting that profile would need a server channel (Option 5). Not building
  a page profile for agent sessions at all is a separate performance fix.
