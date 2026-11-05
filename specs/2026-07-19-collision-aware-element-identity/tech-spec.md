---
author: lukasmasuch
created: 2026-07-19
---

# Collision-aware automatic element identity

## Summary

Streamlit currently raises `StreamlitDuplicateElementId` whenever two elements in one
script run compute the same automatic ID. That is necessary for backend widgets, where
silently sharing an ID would alias values and callbacks, but it is unnecessarily strict for
elements whose IDs only isolate frontend-local state, such as passive Plotly charts and
autoplay media.

This spec proposes collision-aware identity resolution for **keyless, frontend-state
elements**. The existing content-derived ID remains unchanged for every non-colliding app.
When identical elements coexist at different rendered placements, later instances receive a
deterministic placement-derived ID; repeated writes to the same placement reuse one ID and
behave as an update. Explicit keys and backend widgets retain today's strict uniqueness
rules. The change requires no public parameters, configuration, or protobuf fields.

## Problem

### Current identity pipeline

`compute_and_register_element_id` in `lib/streamlit/elements/lib/utils.py` currently does
two jobs synchronously:

1. It hashes the element type, user key, active script hash, and command-specific stable
   parameters. For keyless widgets it also incorporates the form and root container.
2. It registers the resulting `$$ID-<hash>-<user_key>` in the current
   `ScriptRunContext`. Reusing either the generated ID or a user key during the run raises.

The returned ID can participate in several different state systems:

| Identity owner | Examples | Consequence of accidental sharing |
|---|---|---|
| Backend widget state | `st.button`, `st.text_input`, interactive charts | Values, callbacks, and `SessionState` alias |
| Frontend-only element state | passive Plotly figure state; audio/video autoplay guards | Browser-local state aliases, but no backend value aliases |
| CSS / keyed block identity | keyed passive containers | Duplicate user keys make styling and state ownership ambiguous |

The frontend also uses valid element IDs as React keys and as keys in
`WidgetStateManager.elementStates`. The ID must therefore be unique for simultaneously
rendered stateful elements, even when it is not a widget ID.

### The exception conflates different situations

There are five materially different causes behind the same exception:

| Failure class | Example | Desired handling |
|---|---|---|
| Ambiguous backend widgets | Two identical keyless buttons in a loop | Keep raising; Streamlit cannot infer the data item's semantic identity safely |
| Identical frontend-state elements | The same passive Plotly figure rendered ten times ([#11424](https://github.com/streamlit/streamlit/issues/11424)); repeated autoplay audio ([#11360](https://github.com/streamlit/streamlit/issues/11360)) | Automatically isolate each rendered instance |
| Rewrites of one placement | Repeatedly drawing a passive Plotly chart into one `st.empty()` ([#9752](https://github.com/streamlit/streamlit/issues/9752)) | Treat as an update to one logical element |
| Missing stable identity inputs | Main vs. sidebar ([#10598](https://github.com/streamlit/streamlit/issues/10598)); labels omitted for pills ([#11975](https://github.com/streamlit/streamlit/issues/11975)) | Fix the element's identity inputs and regression tests |
| Overlapping execution | The same nested periodic fragment executes twice ([#10719](https://github.com/streamlit/streamlit/issues/10719)) | Fix scheduling/ownership; do not hide the race with new IDs |

Only the first class inherently requires user input. Treating every other class as if it were
an ambiguous widget forces users to add keys where no backend-state ambiguity exists, and in
the media case the suggested `key` workaround is not even available.

### Why adding the delta path to every ID is not acceptable

The delta path describes where an element is currently rendered, not which logical element
it is. Adding it to every automatic ID would stop duplicate errors, but a conditional element
inserted above a widget would change all following IDs and reset their state. It would undo
the main benefit of content-derived identity.

The safe opportunity is narrower: preserve the current logical ID when it is unique, and use
structural placement only to resolve a collision that cannot otherwise render today.

## Goals and invariants

1. Existing apps that produce no duplicate IDs keep byte-for-byte identical IDs and state.
2. Duplicate explicit user keys continue to raise `StreamlitDuplicateElementKey`.
3. Backend widgets at different placements continue to raise
   `StreamlitDuplicateElementId` when their automatic IDs collide.
4. Keyless frontend-state elements can coexist without sharing browser-local state.
5. Repeated keyless frontend-state writes to the same logical placement are allowed and use
   one ID.
6. Resolved IDs stay stable across full reruns, fragment reruns, cached-message replay, and
   parallel initial execution as long as the element's placement is stable.
7. Failed or interrupted runs do not discard valid identity assignments.
8. Assignments survive replacement of a `ScriptRunner`, including fast reruns.
9. No public API, configuration, or protobuf change is introduced.

## Out of scope

- Inferring semantic item identities for repeated backend widgets.
- Adding `key` to commands that do not currently accept it.
- Automatic identity for currently unkeyed layout containers.
- Fixing fragment scheduling races that merely surface as duplicate-ID errors.

## Proposal

### 1. Declare the identity domain internally

Separate the current generic concept of an "element ID" into two internal domains:

```python
class ElementIdentityDomain(Enum):
    WIDGET = "widget"
    FRONTEND = "frontend"
```

- `WIDGET` means the ID participates in backend widget registration. Its uniqueness
  semantics remain unchanged.
- `FRONTEND` means the ID exists for React preservation, frontend-local state, shortcuts,
  or similar browser behavior, but is not registered through `register_widget`.

An explicit `user_key` is always strict, regardless of domain. The domain is an internal
argument or descriptor and is not exposed in an `st.*` signature.

Initial `FRONTEND` call sites:

- `st.plotly_chart(..., on_select="ignore")`
- `st.audio(..., autoplay=True)`
- `st.video(..., autoplay=True)`

Interactive Plotly charts remain `WIDGET`. Keyed passive layout blocks retain strict key
registration. Other ID-bearing passive elements, such as a non-rerunning link button with a
shortcut, should opt in only after their frontend ownership semantics are audited.

### 2. Defer frontend identity resolution until the final target is known

Widget IDs must be available before `register_widget`, so the existing widget path remains
synchronous. Frontend-only IDs do not have that requirement. Represent them internally as a
descriptor until `_enqueue` has resolved the active `DeltaGenerator`, fragment outside-write
wrapper, and final delta path:

```python
@dataclass(frozen=True)
class FrontendElementIdentity:
    element_type: str
    base_id: str
    user_key: str | None
```

`DeltaGenerator._enqueue` resolves the descriptor immediately before it copies the element
proto into a `ForwardMsg`, writes the resolved ID to that copy, and advances the cursor. This
ensures the placement is the path actually sent to the frontend, including writes through
fragment outside-container wrappers.

This also makes cached replay correct. `ElementMsgData` in
`cached_message_replay.py` stores the unresolved descriptor alongside the message. Every
replay resolves the identity against its current target instead of reusing the resolved ID
from the cache miss's original location. The cached proto remains immutable.

No protobuf change is needed: the browser continues to receive a normal resolved ID in the
existing element-specific `id` field.

### 3. Resolve keyless frontend collisions by structural placement

Add a thread-safe `FrontendElementIdRegistry` owned by `AppSession` and passed by reference
through each `ScriptRunner` to its `ScriptRunContext`. `AppSession` ownership matters because
fast reruns can replace the `ScriptRunner`; storing the registry only on the run context would
lose assignments even though the browser's frontend-local state is still alive. The registry
persists for the session so assignments made during a full run remain available when only one
fragment reruns.

A placement is:

```text
(active_script_hash, writing_fragment_id, final_delta_path)
```

`active_script_hash` is already part of the base ID, but keeping it in the placement type
makes the ownership boundary explicit. `writing_fragment_id` distinguishes two execution
owners accidentally targeting one path; a repeated write is valid only when both placement
and owner match.

Resolution is atomic:

```python
def resolve(run_token, descriptor, placement):
    if descriptor.user_key is not None:
        register_key_strictly(descriptor.user_key, descriptor.base_id)
        return descriptor.base_id

    group = assignments_for(run_token)[descriptor.base_id]

    if placement in group:
        resolved_id = group[placement]
    elif not group:
        # Preserve the legacy ID for every non-colliding element.
        resolved_id = descriptor.base_id
        group[placement] = resolved_id
    else:
        # Keep the standard $$ID-<hash>-None wire format.
        resolved_id = hash_id(descriptor.base_id, placement)
        group[placement] = resolved_id

    register_frontend_claim_for_this_run(resolved_id, placement)
    return resolved_id
```

The per-run claim registry allows the same resolved ID to be claimed repeatedly by the same
placement. A claim from a different placement remains an error, protecting against hash
collisions and internal routing bugs.

The first rendered instance retains its legacy base ID. Additional instances get IDs derived
from the base ID and placement. Consequently, unique elements retain their current ability to
move without losing state, while an ambiguous duplicate group uses positional identity—the
same fallback React would use for an unkeyed list.

### 4. Preserve assignments across partial and concurrent reruns

The registry keeps committed assignments plus an isolated provisional overlay for each active
run. It must not be a set that resets on every script run:

- **Run generations:** claims are tagged with a monotonically increasing run token. Parallel
  workers for one run share one overlay. Cleanup and new assignments are committed only for
  the latest successfully accepted run in the affected scope. A stopped runner from a
  fast-rerun handoff cannot reserve the base ID or clean assignments for its replacement.
- **Full rerun:** all active placements are observed. After a successful run, remove an
  entire base-ID group only when none of its placements remains active. Do not promote a
  surviving derived placement to the legacy base ID, because that would reset its state.
- **Fragment rerun:** reuse assignments from the full run. Only placements owned by the
  rerunning fragment are eligible for scoped cleanup; assignments belonging to the main
  script or other fragments remain untouched.
- **Parallel full run:** resolve claims under one lock. Which new placement receives the
  legacy base ID may depend on first execution during a brand-new session, but no prior state
  exists then; the assignment is persisted before later interactions. Existing assignments
  always win regardless of execution order.
- **Fast rerun / runner replacement:** the new `ScriptRunner` receives the same
  `AppSession`-owned registry, just as it receives the same session state.
- **Failed or stopped run:** discard its provisional overlay but retain all previously
  committed assignments, matching cleanup behavior after premature stops.

The registry stores only identity groups that have been observed in the session. Stale groups
can be removed after successful full runs. A defensive fixed upper bound can evict the oldest
fully inactive groups; it is an internal memory safeguard, not a user-facing configuration.

### 5. Keep widget and explicit-key errors strict

The proposal deliberately does not generate implicit keys for backend widgets. For example:

```python
for _ in range(2):
    st.button("Run")
```

still raises. An occurrence number or delta path would make this render, but when items are
inserted or reordered Streamlit could return one item's old value from another widget. Only
the app knows the stable item identity, so `key=` remains the correct contract.

Likewise, this remains an error even if both calls target one placeholder:

```python
slot = st.empty()
slot.text_input("Name")
slot.text_input("Name")
```

Callbacks and two Python return values make repeated backend registration observably
different from a passive visual rewrite. Repeating the calls with `key="name"` likewise
remains a duplicate-key error. Explicit keys stay globally unique across element types, as
they are today.

### Behavior examples

#### Identical passive elements at different placements

```python
for _ in range(3):
    st.plotly_chart(fig)  # on_select="ignore"
```

| Instance | Current behavior | Proposed ID |
|---|---|---|
| First | Base ID | Existing base ID, unchanged |
| Second | Raises | Hash of base ID + second final placement |
| Third | Never executes | Hash of base ID + third final placement |

Each chart receives its own `elementStates` entry. Stable placements recover their own zoom,
pan, legend, and camera state after remounts.

#### Repeated write to one passive placeholder

```python
slot = st.empty()
slot.plotly_chart(fig)
slot.plotly_chart(fig)
```

Both calls resolve to the same placement and ID. The later delta replaces the earlier delta,
and the run does not raise.

#### Interactive chart

```python
st.plotly_chart(fig, on_select="rerun")
st.plotly_chart(fig, on_select="rerun")
```

This remains an error because both charts would otherwise share selection state on the
backend.

#### Explicit key

```python
st.plotly_chart(fig, key="chart")
st.plotly_chart(fig, key="chart")
```

This remains `StreamlitDuplicateElementKey`, including in passive mode.

## Guardrail: audit stable identity inputs

Collision resolution should not paper over missing identity inputs. Extend the existing
widget-ID computation tests into an identity audit covering every public command that creates
an ID. Each public parameter must be explicitly categorized as:

- identity-affecting;
- identity-neutral, such as `disabled`, callbacks, and callback arguments; or
- ignored when an explicit key is the main identity.

Add focused behavior tests for semantic scopes already supported by the runtime: page hash,
main/sidebar root, form, and interactive/passive mode. This prevents regressions like
[#10598](https://github.com/streamlit/streamlit/issues/10598) and
[#11975](https://github.com/streamlit/streamlit/issues/11975) from being silently converted
into structural fallback IDs.

## Implementation outline

### Backend

- `lib/streamlit/runtime/app_session.py`
  - Own one frontend identity registry for the browser session and provide it to every new
    `ScriptRunner`, including fast-rerun replacements.
  - Commit generation-aware cleanup only for events from the active runner.
- `lib/streamlit/runtime/scriptrunner/script_runner.py`
  - Attach the shared registry to each `ScriptRunContext` and finalize scoped cleanup only
    after successful runs.
- `lib/streamlit/elements/lib/utils.py`
  - Keep widget computation and strict registration behavior.
  - Add the frontend identity descriptor and pure base-ID computation path.
- `lib/streamlit/delta_generator.py`
  - Extract final target resolution so identity and enqueue use the exact same active DG.
  - Resolve a frontend identity before copying the proto and advancing the cursor.
- `lib/streamlit/runtime/scriptrunner_utils/script_run_context.py`
  - Own the session-persistent, thread-safe frontend identity registry.
  - Coordinate full-run and fragment-scoped lifecycle cleanup.
- `lib/streamlit/runtime/caching/cached_message_replay.py`
  - Store and replay unresolved frontend identity descriptors.
- `lib/streamlit/elements/plotly_chart.py`
  - Use `FRONTEND` for passive charts and the existing `WIDGET` path for interactive charts.
- `lib/streamlit/elements/media.py`
  - Propagate frontend identity descriptors for autoplay audio/video.

### Frontend and protocol

No functional frontend or protobuf change is expected. The frontend receives distinct valid
IDs and continues using the existing React-key, `elementStates`, active-ID collection, and
cleanup paths.

The architecture reference in
`.claude/skills/understanding-streamlit-architecture/references/element-identity.md` should be
updated to document identity domains and collision resolution.

## Testing plan

### Unit tests

- A unique frontend-state element receives exactly its current base ID.
- Two equal base IDs at different placements receive different valid IDs.
- Repeated claims from the same placement reuse the same ID.
- A duplicate explicit key raises regardless of placement or identity domain.
- Duplicate widget IDs continue to raise, including at different paths.
- Assignments survive `ScriptRunContext.reset()` and a fragment-only rerun.
- Assignments survive a fast rerun that creates a new `ScriptRunner`.
- Full-run and fragment-scoped cleanup do not remove another scope's assignments.
- Failed runs do not clean assignments.
- Parallel claims are atomic and result in one stable assignment per placement.
- Cached-message replay resolves an ID at the replay target rather than the cache-miss target.
- Existing identity-input audit cases remain covered for all widgets.

### Element tests

- Multiple equal passive Plotly charts render without an exception.
- Equal interactive Plotly charts still raise.
- Multiple equal autoplay audio and video elements render without an exception.
- Repeated passive Plotly writes to one `st.empty()` render the last chart without raising.

### End-to-end tests

- Interact with two identical passive Plotly charts independently, trigger a rerun/remount,
  and verify each placement recovers its own figure state.
- Render identical passive elements in two fragments, rerun one fragment, and verify neither
  ID changes.
- Cover the same case during a parallel initial fragment run.
- Replay the same cached passive element into two locations and verify that both render.

## Alternatives Considered

### Option 1: Add parent or full delta path to every automatic ID

- Pros: Simple and eliminates most collisions.
- Cons: Changes every affected ID, resets existing state on upgrade, and makes identity
  unstable whenever layout above the element changes.

Rejected because it breaks working apps and undermines logical identity.

### Option 2: Remove IDs from keyless passive elements

- Pros: Simple; React falls back to position and duplicate errors disappear.
- Cons: Passive Plotly charts lose frontend figure restoration across remounts. Audio/video
  cannot reliably prevent repeated autoplay after remount. It removes an intentionally added
  behavior to avoid the exception.

Rejected because state restoration and autoplay guards are expected behavior.

### Option 3: Derive identity from Python call sites

Use the user filename, qualified code object, and bytecode/source position as an implicit
salt.

- Pros: Distinguishes two identical calls on separate source lines and survives layout moves.
- Cons: Refactoring or inserting code can reset state; stack walking adds overhead and is
  brittle through wrappers; one call site in a loop still needs an occurrence identity.

Not selected for the initial implementation. A call-site token could later replace numeric
placement segments if it proves stable enough, but it should not be required to solve passive
element collisions.

### Option 4: Use a per-type or per-base-ID occurrence counter

- Pros: Very small implementation and fixes loops.
- Cons: IDs shift when an earlier conditional instance appears or disappears; fragment-only
  reruns observe a different subset; parallel execution order can be nondeterministic.

Rejected because final structural placement is a more accurate and observable fallback.

### Option 5: Automatically disambiguate backend widgets too

- Pros: Removes the exception for repeated widgets and identical widgets in columns.
- Cons: No automatic discriminator can preserve item identity when a dynamic list reorders.
  Silent state transfer is worse than an actionable error.

Rejected for the initial scope. A safe future subset may use stable existing scopes, such as
the IDs of keyed ancestor containers, but must not fall back to raw occurrence order for
backend state.

### Option 6: Add `key` parameters or a configuration switch

- Pros: Explicit and under user control.
- Cons: Requires app changes, does not improve the default, and violates this proposal's
  no-new-API/no-new-config constraint. Some affected commands do not currently accept keys.

Rejected for this work. Adding keys to more elements can remain an independent API proposal.

## Future extensions

- Build a key-aware structural placement where stable ancestor block IDs replace numeric path
  segments. This would let duplicate passive children follow a keyed container when it moves.
- Reuse the collision-safe frontend identity infrastructure to investigate automatic state
  persistence for unkeyed tabs, expanders, and popovers
  ([#14492](https://github.com/streamlit/streamlit/issues/14492)) without introducing a new
  wave of duplicate-ID errors.
- Add anonymized counters for resolved frontend collisions versus strict widget/key errors to
  guide whether a safe, stable-scope subset of widget collisions is worth pursuing.
- Diagnose overlapping fragment execution independently; identity disambiguation must not
  conceal scheduler bugs such as [#10719](https://github.com/streamlit/streamlit/issues/10719).

## Checklist

| Item | Status |
|---|---|
| New public parameters or commands | None |
| New user-facing configuration | None |
| Protobuf changes | None |
| Existing non-colliding IDs | Unchanged |
| Explicit-key uniqueness | Unchanged and strict |
| Backend widget uniqueness | Unchanged and strict |
| Frontend-only state cleanup | Uses existing active-ID cleanup |
| Parallel execution | Registry is thread-safe; assignments persist across reruns |
| SiS / Community Cloud / embedded apps | Uses existing backend/frontend identity transport |
| Security or privacy impact | None; structural placements are hashed and not user data |
