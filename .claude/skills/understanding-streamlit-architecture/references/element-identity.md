# Element identity

How Streamlit preserves or reconstructs element state across reruns.

## Two identities

- **Delta path** is the element's current position in the render tree, for example `[0, 2, 3]`.
- **Element ID** is the element's stable logical identity across reruns.

The backend uses delta paths to address updates in `ForwardMsg.metadata.delta_path`. The frontend uses those paths to rewrite the immutable `AppRoot` tree. React preservation is then decided separately from the element's rendered key.

## Why element IDs matter

An element ID lets Streamlit reconnect a frontend component to the same logical element after reruns. This matters for:

- **Widgets**: syncing frontend state with backend `SessionState`
- **Frontend-only element state**: restoring component state after unmount/remount
- **`st.session_state` mapping**: connecting a user `key` to the internal element/widget ID

Without a stable element ID, the frontend falls back to positional React keys, so moves within a list become remounts.

## ID computation

Backend IDs are computed in `compute_and_register_element_id()` (`lib/streamlit/elements/lib/utils.py`).

Inputs can include:

- element type (for example `checkbox`, `slider`, `plotly_chart`)
- user-provided `key`
- `active_script_hash` for page/fragment scoping
- `form_id` and sometimes root-container context
- widget/element-specific stable parameters

Generated format:

```text
$$ID-<md5_hash>-<user_key>
```

Registration also enforces uniqueness within a run and records the ID/key in the current `ScriptRunContext`.

## `key` and `key_as_main_identity`

The user-facing `key` is the main stable identity anchor for many elements.

- `key_as_main_identity=True`: when a `key` is present, general command kwargs are ignored for ID computation.
- `key_as_main_identity=set[str]`: when a `key` is present, only the named kwargs stay in the ID computation.

This is used to avoid resetting state for harmless parameter changes while still allowing some commands to keep a small whitelist of identity-affecting fields. Current examples include interactive charts/dataframes that still include fields like `selection_mode` to avoid reusing incompatible old state.

## State categories

### Widgets

Widgets have bidirectional frontend/backend state:

- frontend stores values in `WidgetStateManager`
- frontend sends them in `BackMsg.ClientState.widget_states`
- backend restores/registers them in `SessionState`

Some commands are always widgets. Others become widgets only when interactive behavior is enabled, such as dataframe/chart selections.

## Stateful non-widgets

Some elements keep **frontend-only** state in `WidgetStateManager.elementStates`. This state is never sent to the backend.

API:

- `getElementState(id, key)`
- `setElementState(id, key, value)`
- `deleteElementState(id, key?)`

Current examples include:

- Plotly figure state
- Vega view state
- audio/video autoplay guards

## Static elements

Pure display elements such as markdown, text, and images generally do not need persistent state, so remounting is usually harmless.

## When state is lost

State is lost when the component is actually remounted or the old state is cleaned up.

Common causes:

1. **Delta path changes**
   A delta-path change can cause a remount, but not always. If the element has a stable `element.id` and React still sees it as the same keyed child under the same rendered parent list, it can be preserved. If there is no stable `id`, or an ancestor block changes/replaces, it remounts.
2. **Element ID changes**
   If identity inputs change, Streamlit treats the result as a new logical element.
3. **Element not rendered in a rerun**
   After a successful run, missing IDs are treated as inactive and their old state is removed.

## Frontend cleanup

After successful script runs, `App.tsx` collects active element IDs from the current render tree. `WidgetStateManager.removeInactive()` then removes:

- inactive widget values
- inactive form widget values
- inactive frontend-only `elementStates`

This is why an element can disappear for a rerun and later come back as a fresh instance rather than recovering prior state.

## Related files

- `lib/streamlit/elements/lib/utils.py`
- `lib/streamlit/runtime/state/session_state.py`
- `frontend/lib/src/WidgetStateManager.ts`
- `frontend/lib/src/components/core/Block/RenderNodeVisitor.tsx`
- `frontend/lib/src/render-tree/visitors/SetNodeByDeltaPathVisitor.ts`
- `frontend/app/src/App.tsx`

## References

[User-facing lifecycle/background docs](https://docs.streamlit.io/develop/concepts/architecture/widget-behavior)
