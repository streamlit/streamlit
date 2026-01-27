# Dynamic PyDeck Chart State Persistence (Codex Deep Dive)

## Plan

1. Validate the current state lifecycle for `st.pydeck_chart` selections:
   - Backend: element ID generation and widget registration path.
   - Frontend: React keying and widget state lookup via `element.id`.
2. Align PyDeck with the existing widget + Vega/Arrow patterns:
   - Make user-provided `key` the primary identity for selection-enabled PyDeck charts.
   - Allow only a minimal set of parameters to invalidate state (at least `selection_mode`).
3. Identify minimal follow-up tweaks that keep the fix simple:
   - Optional frontend guardrails that reduce confusing visuals with stale selections.
4. Propose targeted tests (backend + optional frontend) to lock the behavior in.

## Findings

### 1) Root cause: PyDeck IDs change whenever the spec changes

**Backend** (`lib/streamlit/elements/deck_gl_json_chart.py`):

When selections are enabled, PyDeck becomes a widget. Its ID is computed with:

```
compute_and_register_element_id(
    "deck_gl_json_chart",
    user_key=key,
    key_as_main_identity=False,
    ...,
    selection_mode=selection_mode,
    use_container_width=use_container_width,
    spec=spec,
)
```

Because `key_as_main_identity=False`, **the full JSON spec is always part of the ID**, even when a `key` is provided. Any change in the pydeck object (data updates, layers, view state changes) changes `spec` and therefore changes the element ID.

### 2) Frontend uses element ID for both React identity and widget state

**Frontend**:

- React keys are derived from `element.id` (`RenderNodeVisitor` uses `getElementId`).
- Widget state is stored/retrieved by `element.id` via `WidgetStateManager`.
- `useBasicWidgetClientState` initializes selection state on mount only.

So when the ID changes:

1. React unmounts the existing component and mounts a new one.
2. The new component reads widget state using the new ID.
3. That state does not exist, so it falls back to empty selection.

**Result**: selection always resets when the pydeck spec changes, even when a `key` is provided.

### 3) Other widgets already use key-as-main-identity with a whitelist

Examples:

- **Vega** (`lib/streamlit/elements/vega_charts.py`):
  - `key_as_main_identity={"selection_mode"}`
- **DataFrame selection** (`lib/streamlit/elements/arrow.py`):
  - `key_as_main_identity={"selection_mode", "is_selection_activated"}`

This pattern preserves selection state for a stable `key` while still resetting when critical parameters change.

### 4) Minimal backend tweak to match the established pattern

**Recommended minimal change** (backend-only):

```
key_as_main_identity={"selection_mode"}
```

This means:

- When `key` is provided, the selection state persists across changes to the pydeck spec.
- Selection resets if the selection mode changes (single <-> multi), which is the safe default.
- When `key` is not provided, the current behavior is unchanged.

This aligns PyDeck with Vega and other selection-enabled widgets.

### 5) Selection correctness edge cases (known tradeoffs)

If we preserve selection across spec changes, a few scenarios can produce stale selections:

- **Layer IDs change**: selection references a layer that no longer exists.
- **Data length shrinks**: selection indices are out of range.
- **Data content changes** but index counts are the same: selection may highlight a different object than the one stored in `selection.objects`.

These scenarios are not new to Streamlit; other widgets already accept similar tradeoffs when key-based persistence is enabled.

### 6) Optional (simple) frontend polish

Not required for the core goal, but two low-effort tweaks could reduce confusing visuals:

1. **Smarter dimming check** in `useDeckGl.tsx`:
   - Only dim if there is at least one valid selected index for the current layer/data length.
2. **Layer-ID filtering**:
   - If selection references a non-existent layer, drop those entries locally (without rerun).

These are optional and can be deferred if the focus is strictly “simple tweaks.”

## Suggested Implementation Outline

### Backend (required)

In `lib/streamlit/elements/deck_gl_json_chart.py`:

- Change `key_as_main_identity=False` to:
  - `key_as_main_identity={"selection_mode"}`

This matches Vega and ensures selection is preserved when a `key` is used.

### Frontend (optional)

If adding a small UX improvement:

- In `frontend/lib/src/components/elements/DeckGlJsonChart/useDeckGl.tsx`:
  - Adjust `anyLayersHaveSelection` to ignore invalid indices for current data.

## Testing Suggestions

Backend unit test (minimal):

- Create two `pydeck` specs with the same `key` but different JSON.
- Ensure the generated ID is stable when `key` is provided (and selection mode unchanged).

Frontend test (optional):

- Ensure selection state persists when `element.json` changes but `element.id` stays the same.

---

### Bottom line

A **single backend change** (key-as-main-identity with `selection_mode` as the only invalidating parameter) is the simplest and most consistent fix. It mirrors existing widget behavior, preserves selection when a user provides a `key`, and keeps current behavior unchanged for apps without a key. Optional frontend polish can be layered on later if we want to reduce confusing stale-selection visuals.
