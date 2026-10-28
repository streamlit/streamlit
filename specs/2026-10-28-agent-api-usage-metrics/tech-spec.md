---
author: lukasmasuch
created: 2026-10-28
---

# Agent API usage metrics

## Summary

Count agent API activity in each server process, across the HTTP route and the MCP
endpoint, and attach the counts to the `PageProfile` message that browser sessions
already report. The browser stays the only channel that sends telemetry, so the server
still sends none. The counts are cumulative and come with a random per-process id. Any
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
  [MCP endpoint](https://github.com/streamlit/streamlit/pull/17510). The MCP spec asks
  for the transport to be recorded once agent metrics exist.
- **Default-on:** parent follow-up #1 turns the API on for every app. Today nothing
  measures whether agents try to use apps that have it off, which is the demand that
  follow-up is meant to serve.

One part is already measured. The page profile's `config` field lists every option
that was set manually, so `server.enableAgentApi` appears there when an app enables it.
A value set to the default is listed as `server.enableAgentApi:default`.

The backend sends no telemetry today, and this spec does not change that. Agent requests
reach the same server process that browser sessions use, though, and a browser session
reports a page profile after each script run.

## Proposal

### What is counted

A single module holds the counters for each process, `streamlit/runtime/agent/usage.py`.

| Counter             | Incremented when                                                                                                          | Answers                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `http_interactions` | `interaction.interact()` is called from `POST /_stcore/agent/interact`                                                   | Is it used, and how much?     |
| `mcp_interactions`  | `interaction.interact()` is called from the MCP `interact` tool                                                           | Which transport do agents use? |
| `sessions`          | `AgentSessionRegistry.create()` returns a session                                                                         | Many agents, or one long loop? |
| `disabled_requests` | An interact request is refused because `server.enableAgentApi` is off: the HTTP route's `403 not_available`, and the MCP route's equivalent | Do agents try apps that have it off? |

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
- **`disabled_requests` comes from the one route that answers while the API is off.**
  The routes are registered even when the API is off, so that the discovery link always
  works. Counting in that branch costs one increment. Fetching the schema
  (`GET openapi.json`) is not counted; see [Out of scope](#out-of-scope).
- **`instance_id`**, a random `uuid4` hex created once per process, is attached to the
  counts. Counts are cumulative and never reset, so one page profile can report a
  number that an earlier one already included. The id groups reports by process, which
  makes them additive across restarts and replicas. See
  [Analysis](#analysis).

Counting does not depend on `browser.gatherUsageStats`. The counters are a few integers
that never leave the process unless a page profile reports them, and no page profile is
built while usage stats are off.

### Reporting

```proto
// PageProfile.proto
message PageProfile {
  ...
  // Agent API activity in this server process. Unset while every count is zero.
  AgentApiUsage agent_api_usage = 15;
}

// Agent API activity in one server process since it started. Counts are
// cumulative, so any page profile reports activity that no browser saw.
message AgentApiUsage {
  // Random id of the server process, so that counts from different processes
  // (restarts, replicas) are never mixed.
  string instance_id = 1;
  int64 http_interactions = 2;
  int64 mcp_interactions = 3;
  int64 sessions = 4;
  int64 disabled_requests = 5;
}

// MetricsEvent.proto, which already imports PageProfile.proto
AgentApiUsage agent_api_usage = 49;
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
Counter: TypeAlias = Literal[
    "http_interactions", "mcp_interactions", "sessions", "disabled_requests"
]

_instance_id: Final = uuid.uuid4().hex
_counts: dict[Counter, int] = dict.fromkeys(get_args(Counter), 0)


def record(counter: Counter) -> None:
    """Count one event. Only called on the runtime's event loop."""
    _counts[counter] += 1


def fill_page_profile(page_profile: PageProfile) -> None:
    """Copy the counts onto ``page_profile``, unless every count is zero."""
    counts = dict(_counts)
    if any(counts.values()):
        page_profile.agent_api_usage.instance_id = _instance_id
        for name, value in counts.items():
            setattr(page_profile.agent_api_usage, name, value)
```

- **Threading:** increments happen only on the event loop, where the registry and both
  routes already run. `fill_page_profile` reads the counts on a script thread, from a
  copy, with no lock. A page profile might see one counter updated and another not yet.
  Telemetry can live with that.
- **Cost:** one dictionary increment per agent request, and one copy of four integers
  per page profile. `streamlit.runtime.agent` imports nothing at package level, so
  `metrics_util` gains no import cost.

### Analysis

For the data team, from `pageProfile` events:

- **Apps with agent traffic:** distinct apps (`report_hash`, or `app_id` where the host
  sets it) with any event where `http_interactions + mcp_interactions > 0`.
- **Interactions in a window:** for each `instance_id`, the largest value in the window
  minus the largest value before it (0 if the process started in the window), summed
  over instances. This is a lower bound. See [Limitations](#limitations).
- **Steps per session:** interactions divided by `sessions`.
- **Unmet demand:** apps whose `config` does not list `server.enableAgentApi`, with
  `disabled_requests > 0`.

### Limitations

- **No browser, no report.** A process that only agents use reports nothing, because
  no browser session ever runs the script. Examples are a coding agent verifying an app
  headless in CI, or a scheduled job. A restart also loses whatever no page profile
  reported. v1 therefore measures apps that also have human viewers. That is the
  population default-on is decided for, and it includes the common local loop, where
  the developer's open tab reruns after the agent's edits.
- **Reported late.** Counts reach the metrics service with the next browser script run
  after the activity, not when the activity happens. A tab left idle reports nothing
  until it reruns.
- **One page profile per process.** With several replicas, each browser session reports
  only its own process. `instance_id` keeps those reports apart.

### Privacy

- **Counts only:** no session handle, labels, values, data, URLs, or identity. The
  parent spec's content-free audit log is a separate follow-up.
- **The same gate as every page profile field:** reported only when
  `browser.gatherUsageStats` is on and the host has not turned metrics off.
- **A browser reports traffic it did not cause.** A viewer's page profile carries
  counts of agent traffic from other callers. The counts describe the deployment, not
  the viewer, in the same way that `config` and `attributions` do.
- **`instance_id` links nothing new.** It is random and contains no machine or user
  data, and every event from that server already carries the same `machine_id_v4`.

### Testing

- **Python unit tests:**
  - `usage`: counts and the field left unset at zero.
  - `create_page_profile_message`: the field is filled.
  - `interact()`: increments its transport's counter exactly once per call, including
    a refused call.
  - `AgentSessionRegistry.create()`: increments `sessions` only when it succeeds, not
    when it fails with `too_many_sessions`.
  - The disabled route: increments `disabled_requests`. A `host_not_allowed` refusal
    increments nothing.
- **Frontend unit test:** a `pageProfile` event forwards `agentApiUsage`, and omits it
  when the message has none.
- **No e2e test:** the field adds no UI, and the unit tests on both sides cover the
  path from the counter to the event.

### Rollout

- Ships with HTTP counting. The MCP endpoint PR passes `transport="mcp"` and counts its
  disabled refusals. Until then, `mcp_interactions` stays zero.
- A new `MetricsEvent` field is a schema change for the metrics pipeline. The
  `MetricsManager` comment requires the data team to request or approve such changes,
  so the data team must sign off before merge.
- Check whether the public description of collected telemetry lists page profile
  fields. If it does, add this one.

## Alternatives Considered

**Option 1: A boolean `agent_api_used`.** The simplest option. It answers adoption only,
and a counter costs the same.

**Option 2: One cumulative counter, `agent_api_interactions`.** The minimal useful
version, and the fallback if the extra fields meet resistance. It cannot show the
transport, separate many agents from one long loop, or measure demand on apps that have
the API off. It would also need `instance_id` to be added up correctly.

**Option 3: An `AgentApiUsage` message with cumulative counts and `instance_id`** ✅
PREFERRED. It is four integers and an id, and each answers a question listed under
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

## Out of scope

- **Outcome and latency:** counts per error code, and response times. These would show
  whether models learn the protocol, but they go beyond "is it used", which is the
  question here.
- **Schema fetches:** a crawler can follow `<link rel="service-desc">`, so a `GET` of
  `openapi.json` does not show that an agent tried. `disabled_requests` measures the
  attempt instead.
- **MCP `get_data` calls, client names, and protocol versions:** `get_data` follows an
  `interact` call, which is already counted. Client names and protocol versions can be
  added with the MCP endpoint if needed.
- **Page profiles from agent sessions:** an agent session's run builds a page profile,
  including command tracking and skill detection. The agent client stores it and never
  sends it. Reporting that profile would need a server channel (Option 5). Skipping it
  for agent sessions is a separate performance fix.
