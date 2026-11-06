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
elements**. These elements keep today's content-derived ID whenever that ID is unique,
including when the element moves. Streamlit derives an ID from the *placement* (page, writing
fragment, and final delta path) only for another instance of the same element, and it reuses
that ID when the same element is written to the same placement again. Explicit keys and
backend widgets retain today's strict uniqueness rules. The change requires no public
parameters, configuration, or protobuf fields.

## Problem

### Current identity pipeline

`compute_and_register_element_id` in `lib/streamlit/elements/lib/utils.py` currently does
two jobs synchronously:

1. It hashes the element type, user key, active script hash, and command-specific stable
   parameters. When a `DeltaGenerator` is passed (and an explicit key doesn't replace the
   command kwargs), it also incorporates the form ID and the root container (main or sidebar).
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
| Rewrites of one placement | Repeatedly drawing a passive Plotly chart into one `st.empty()` ([#9752](https://github.com/streamlit/streamlit/issues/9752), closed but still reproduces on `develop` with an identical figure) | Treat as an update to one logical element |
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

1. Existing apps that produce no duplicate IDs keep byte-for-byte identical IDs and state,
   including when a unique element moves because other content appears above it.
2. Duplicate explicit user keys continue to raise `StreamlitDuplicateElementKey`.
3. Backend widgets at different placements continue to raise
   `StreamlitDuplicateElementId` when their automatic IDs collide.
4. Keyless frontend-state elements can coexist without sharing browser-local state.
5. Repeated keyless writes of an identical frontend-state element to the same placement are
   allowed and use one ID. Writing different content (a different figure, spec, or config)
   produces a different base ID and resets frontend state, exactly as today.
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

An explicit `user_key` is always strict, regardless of domain: keyed calls keep using the
existing synchronous `compute_and_register_element_id` path and its shared per-run
`widget_user_keys_this_run` / `widget_ids_this_run` sets. This keeps keys unique across
element types and raises `StreamlitDuplicateElementKey` before side effects such as media
file registration. The domain is an internal argument or descriptor and is not exposed in an
`st.*` signature.

Initial `FRONTEND` call sites (keyless calls only):

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
    base_id: str  # Computed exactly as today, always keyless.
```

`DeltaGenerator._enqueue` resolves the descriptor immediately before it copies the element
proto into a `ForwardMsg`, writes the resolved ID to that copy, and advances the cursor. This
ensures the placement is the path actually sent to the frontend, including writes through
fragment outside-container wrappers.

Python protobuf messages reject arbitrary attributes, so the descriptor travels next to the
proto rather than on it: `_enqueue` gains a private `frontend_identity=None` keyword argument,
`marshall_audio` / `marshall_video` return the descriptor instead of only setting `proto.id`,
and `save_element_message` receives it for the cache. `_enqueue` skips resolution with one
`is None` check and takes the registry lock only for frontend-identity elements, so other
elements see no added work. Without a `ScriptRunContext` (bare execution), the descriptor
resolves to its base ID without registration, matching today's behavior.

This also makes cached replay correct. `ElementMsgData` in
`cached_message_replay.py` stores the unresolved descriptor alongside the message. Every
replay resolves the identity against its current target instead of reusing the resolved ID
from the cache miss's original location. The cached proto remains immutable.

This is a behavior change for cache hits: today replay reuses the stored ID without
registering it, so a cached chart replayed next to an identical uncached chart silently sends
duplicate IDs. The stored `base_id` still embeds the cache miss's page hash, form, and root
container; placement disambiguates any resulting collision, so this needs no further handling.

No protobuf change is needed: the browser continues to receive a normal resolved ID in the
existing element-specific `id` field.

### 3. Resolve keyless frontend collisions by structural placement

Add a thread-safe `FrontendElementIdRegistry`. `AppSession` is its single owner and passes
it by reference to every `ScriptRunner`, which hands it to each run's `ScriptRunContext`.
`AppSession` ownership matters because fast reruns replace the `ScriptRunner` and every run
builds a fresh `ScriptRunContext`; a registry stored on either would lose assignments even
though the browser's frontend-local state is still alive. The registry persists for the
session so assignments made during a full run remain available when only one fragment reruns.
`AppTest` has no `AppSession`, so the `AppTest` instance owns the registry and passes it to
the `LocalScriptRunner` it creates for each `run()`.

A placement is:

```text
(active_script_hash, writing_fragment_id, final_delta_path)
```

`active_script_hash` is already part of the base ID, but keeping it in the placement type
makes the ownership boundary explicit. `writing_fragment_id` distinguishes two execution
owners accidentally targeting one path; a repeated write is valid only when both placement
and owner match.

The registry holds `committed` assignments (`base_id -> {placement: resolved_id}`) from
earlier runs. Each run records its own `claims` in the same shape. Every run has a *scope*,
the set of placements it may replace: the whole app for a full run, or, for a fragment run,
placements written by the fragments in its `RunDescriptor.fragment_ids` (one run can rerun
several) plus any descendant fragments they executed or evicted. Committed placements outside
the scope stay rendered and keep their IDs.

Resolution runs under the registry lock:

```python
def resolve(run, descriptor, placement):
    base_id = descriptor.base_id
    committed = registry.committed.get(base_id, {})
    claims = run.claims[base_id]

    if placement in claims:
        # Repeated write of the same element to one placement.
        return claims[placement]

    # IDs this run has already assigned, plus IDs still held by placements outside its scope.
    held = set(claims.values()) | {
        resolved for p, resolved in committed.items() if not run.scope_owns(p)
    }

    resolved_id = committed.get(placement)
    if resolved_id is None and base_id not in held:
        # A unique element keeps its legacy ID even after it moves.
        resolved_id = base_id
    if resolved_id is None or resolved_id in held:
        resolved_id = derive_id(base_id, placement)

    claims[placement] = resolved_id
    return resolved_id
```

`derive_id` keeps the standard `$$ID-<hash>-None` wire format. It hashes `base_id` together
with a canonical, length-prefixed encoding of the placement fields using
`util.create_fast_hasher`. If a derived ID is ever claimed by a different placement, the run
raises as an internal error; this guards against hash collisions and routing bugs.

The rule gives three properties:

- **Unique elements are unchanged.** Only one claim exists per group, so it always receives
  the legacy base ID, wherever it renders. A chart that moves below a newly shown
  `st.success()` keeps its ID and frontend state, as it does today.
- **Stable duplicates keep their IDs.** A placement with a committed assignment reuses it
  unless an earlier claim in the same run already took that ID (see the trade-offs below).
  A duplicate that already has a derived ID keeps it, even after the base-ID holder
  disappears; promoting it would reset its frontend state.
- **New duplicates are derived.** Once the base ID is held, every further instance gets an ID
  derived from its placement—a structural fallback analogous to React's index-based identity
  for unkeyed siblings.

#### Accepted trade-offs of positional identity

Within a duplicate group, identity follows claim order and placement, not the Python object:

```python
if show_extra:
    st.plotly_chart(fig)  # Duplicate inserted above
st.plotly_chart(fig)  # Original chart
```

When `show_extra` becomes true, the inserted chart claims first and takes the base ID; the
original chart moves to a derived ID and loses its zoom/pan state. Appending the duplicate
below the original does not have this effect. Likewise, when layout shifts inside a duplicate
group, one instance can inherit another's assignment. Group members share figure, spec, and
config, so the impact is limited, and these cases cannot render at all today. Apps that need
item-stable identity across reordering can pass `key=` to `st.plotly_chart`.

The no-promotion rule has one intended exception: when a group shrinks to one member in the
same run that moves it to a placement with no committed assignment, that member takes the
free base ID and its frontend state resets once. This is uncommon and needs no extra state.

### 4. Preserve assignments across partial and concurrent reruns

Each run's `claims` are isolated until the run ends; the committed state is never reset
wholesale. `ScriptRunner` manages the lifecycle of every run:

1. **Start:** the run registers its existing `RunDescriptor` (one per run, created by
   `ScriptRunner`) with the registry, which records it as the newest run for its scope and
   opens an empty `claims` overlay. Parallel workers for one run share the descriptor and
   overlay.
2. **Supersede check:** only the newest run whose scope covers a placement may commit it. A
   newer full-app run supersedes every older run, including fragment runs; a newer fragment
   run supersedes older runs of the same fragments. `RunDescriptor` IDs are random, so
   recency comes from the registry's start order, not from the ID. A runner stopped for a
   fast-rerun handoff cannot commit or clean up for its replacement.
3. **Finish:** the registry follows the frontend, which clears stale nodes and inactive
   element state after every finished run except one interrupted for a rerun:
   - *Finished* (`SCRIPT_STOPPED_WITH_SUCCESS` / `FRAGMENT_STOPPED_WITH_SUCCESS`, which also
     covers `st.stop()` and uncaught exceptions): replace all committed placements in the
     run's scope with the run's claims. This adds new assignments, prunes in-scope
     placements that were not rendered (including stale entries inside a still-live group),
     and drops empty groups. `premature_stop` only controls backend `SessionState` cleanup
     and plays no role here.
   - *Stopped for rerun* (`st.rerun()`, fast rerun), superseded, or a compile error: discard
     the claims. Previously committed assignments stay untouched.

   The commit is a no-op when the run made no claims and the registry is empty, so apps
   without frontend-identity elements pay nothing per run.

Scope-specific notes:

- **Fragment rerun:** only placements in the run's scope (section 3) are replaced, matching
  the fragment-scoped `clearStaleNodes` in the frontend. Assignments of the main script and
  unrelated fragments remain untouched.
- **Parallel execution:** claims resolve under one lock. A unique element has one claim per
  run, and a duplicate group whose placements are unchanged reuses its committed
  assignments, so execution order does not matter in either case. Order only matters when a
  duplicate group gains or moves members within one run; then which instance takes the base
  ID can depend on worker order, which is the same trade-off described above.
- **Fast rerun / runner replacement:** the new `ScriptRunner` receives the same
  `AppSession`-owned registry, just as it receives the same session state.

Because every finished run, including one stopped early, prunes its scope, the committed
state is bounded by the frontend-identity elements currently rendered in the session; no
separate eviction cap is needed.

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
and the run does not raise. This applies to identical content only: drawing a different
figure into `slot` yields a different base ID, so its frontend state starts fresh, as today.

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
  - Create the session's registry and pass it to every new `ScriptRunner`, including
    fast-rerun replacements.
- `lib/streamlit/runtime/scriptrunner/script_runner.py`
  - Register each run's `RunDescriptor` with the registry, attach the registry and run state
    to each `ScriptRunContext`, and commit or discard the run's claims when the run finishes
    (section 4). This is the only place that commits or cleans up.
- `lib/streamlit/runtime/scriptrunner_utils/script_run_context.py`
  - Expose the registry reference, `RunDescriptor`, and scope to `_enqueue`. Do not create or
    clear the registry in `reset()`.
- `lib/streamlit/elements/lib/utils.py`
  - Keep widget computation and strict registration behavior, including keyed frontend calls.
  - Add the frontend identity descriptor and pure base-ID computation path.
- `lib/streamlit/delta_generator.py`
  - Extract final target resolution so identity and enqueue use the exact same active DG.
  - Resolve a frontend identity before copying the proto and advancing the cursor.
- `lib/streamlit/testing/v1/app_test.py`
  - Own a registry per `AppTest` instance and pass it to each `LocalScriptRunner`.
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

The frontend also keeps an element with a stable ID mounted when a rerun displaces it to a
later slot ([#17804](https://github.com/streamlit/streamlit/pull/17804)). This interacts with
collision resolution as follows:

- A unique passive chart keeps its base ID, so it stays mounted when output is inserted above
  it, as it does today.
- A derived ID encodes its placement, so a shifted duplicate arrives with a new ID and
  remounts. This matches the accepted trade-offs in section 3.
- Audio and video are excluded from retention so hidden media cannot keep playing. Autoplay
  elements still remount when displaced; their autoplay guard is keyed by ID in
  `elementStates`, which retention does not affect.

The architecture reference in
`.claude/skills/understanding-streamlit-architecture/references/element-identity.md` should be
updated to document identity domains and collision resolution.

## Testing plan

### Unit tests

- A unique frontend-state element receives exactly its current base ID.
- A unique element keeps its exact base ID after its delta path changes (for example, a
  conditional element is inserted above it).
- Two equal base IDs at different placements receive different valid IDs.
- Repeated claims from the same placement reuse the same ID.
- A duplicate explicit key raises regardless of placement or identity domain, including a
  widget and a passive chart sharing one key.
- Duplicate widget IDs continue to raise, including at different paths.
- Assignments survive `ScriptRunContext.reset()` and a fragment-only rerun.
- Assignments survive a fast rerun that creates a new `ScriptRunner`, and the stopped runner
  commits nothing.
- Full-run and fragment-scoped cleanup do not remove another scope's assignments; nested
  child fragments are pruned with their parent.
- Completed runs prune stale placements inside a still-live group.
- A full run that hits `st.stop()` before a previously assigned chart prunes that placement;
  runs stopped for rerun commit nothing.
- A single run that reruns two fragments replaces both fragments' placements and leaves the
  main script's assignments untouched.
- Parallel claims are atomic and result in one stable assignment per placement.
- Cached-message replay resolves an ID at the replay target rather than the cache-miss target.
- A cached passive chart replayed next to an identical uncached chart gets distinct IDs.
- Assignments persist across `AppTest.run()` calls; bare execution falls back to the base ID.
- Existing identity-input audit cases remain covered for all widgets.

### Element tests

- Multiple equal passive Plotly charts render without an exception.
- Equal interactive Plotly charts still raise.
- Multiple equal autoplay audio and video elements render without an exception.
- Repeated passive Plotly writes to one `st.empty()` render the last chart without raising.
- Writing a different figure into the same `st.empty()` produces a different ID.

### End-to-end tests

- Zoom a unique passive Plotly chart, show a conditional element above it, and verify the
  zoom is kept.
- Interact with two identical passive Plotly charts independently, trigger a rerun/remount,
  and verify each placement recovers its own figure state.
- Render identical passive elements in two fragments, rerun one fragment, and verify neither
  ID changes.
- Cover the same case during a parallel initial fragment run.
- Replay the same cached passive element into two locations and verify that both render.
- Render two identical autoplay `st.audio` elements, trigger a rerun that displaces them, and
  verify that neither restarts playback.

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

### Option 3: Resolve collisions per run only

Keep the resolution rule but store claims only on the current `ScriptRunContext`.

- Pros: No session-scoped registry, supersede ordering, or `AppSession` / `AppTest` wiring.
- Cons: A fragment rerun cannot see that a main-script duplicate already holds the base ID,
  so the fragment's copy would also take it and alias state. Fast-rerun runner replacement
  would also forget derived assignments and reset their state.

Rejected because fragment reruns are a primary use case for repeated passive charts.

### Option 4: Derive identity from Python call sites

Use the user filename, qualified code object, and bytecode/source position as an implicit
salt.

- Pros: Distinguishes two identical calls on separate source lines and survives layout moves.
- Cons: Refactoring or inserting code can reset state; stack walking adds overhead and is
  brittle through wrappers; one call site in a loop still needs an occurrence identity.

Not selected for the initial implementation. A call-site token could later replace numeric
placement segments if it proves stable enough, but it should not be required to solve passive
element collisions.

### Option 5: Use a per-type or per-base-ID occurrence counter

- Pros: Very small implementation and fixes loops.
- Cons: IDs shift when an earlier conditional instance appears or disappears; fragment-only
  reruns observe a different subset; parallel execution order can be nondeterministic.

Rejected because final structural placement is a more accurate and observable fallback.

### Option 6: Automatically disambiguate backend widgets too

- Pros: Removes the exception for repeated widgets and identical widgets in columns.
- Cons: No automatic discriminator can preserve item identity when a dynamic list reorders.
  Silent state transfer is worse than an actionable error.

Rejected for the initial scope. A safe future subset may use stable existing scopes, such as
the IDs of keyed ancestor containers, but must not fall back to raw occurrence order for
backend state.

### Option 7: Add `key` parameters or a configuration switch

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
| Existing non-colliding IDs | Unchanged, including when the element moves |
| Explicit-key uniqueness | Unchanged and strict |
| Backend widget uniqueness | Unchanged and strict |
| Cached-message replay | Now resolves and registers frontend IDs per replay target |
| Frontend-only state cleanup | Uses existing active-ID cleanup |
| Parallel execution | Registry is thread-safe; assignments persist across reruns |
| SiS / Community Cloud / embedded apps | Uses existing backend/frontend identity transport |
| Security or privacy impact | None; structural placements are hashed and not user data |
