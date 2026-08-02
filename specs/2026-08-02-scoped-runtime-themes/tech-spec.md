---
author: lukasmasuch
created: 2026-08-02
---

# Scoped and Runtime Theme Overrides

## Summary

Implement theme overrides as a partial layer over an existing `ThemeConfig`. A block-level layer
wraps only an `st.container` React subtree, while a session-level layer sits between the selected
app theme and `RootStyleProvider`. Both use the existing `CustomThemeConfig`, theme derivation,
Emotion, and BaseWeb infrastructure.

The architecture is feasible without CSS selector rewriting. The frontend already scopes the
sidebar through a nested `ThemeProvider`, charts and custom components read the Emotion theme from
context, React context crosses portals, and the static theme code already merges shared plus
light/dark sections.

## Problem

The current app theme arrives in `NewSession.custom_theme` and is converted into a full frontend
`ThemeConfig`. `RootStyleProvider` provides one Emotion/BaseWeb theme to the app. The sidebar is a
special case with its own nested provider, but ordinary render-tree blocks carry no theme data.

This creates two limitations:

- A backend block cannot describe a partial theme for its descendants.
- `st.set_page_config` can send runtime page metadata, but no per-session theme layer exists; the
  static `NewSession` theme and the user's browser selection are the only app-wide inputs.

Relevant requests are [#10749](https://github.com/streamlit/streamlit/issues/10749),
[#14172](https://github.com/streamlit/streamlit/issues/14172),
[#8271](https://github.com/streamlit/streamlit/issues/8271), and
[#6649](https://github.com/streamlit/streamlit/issues/6649).

## Feasibility Findings

### Existing primitives

- `frontend/lib/src/components/core/ThemeProvider.tsx` already nests both Emotion and BaseWeb
  theme providers.
- `ThemedSidebar.tsx` proves that a full derived theme can be confined to a React subtree.
- `createTheme`/`createEmotionTheme` already complete a partial `CustomThemeConfig` from a base
  theme and recompute derived colors, radii, chart palettes, and the BaseWeb theme.
- `handleSectionInheritance` already merges shared, light, and dark inputs while skipping protobuf
  defaults; scoped/runtime resolution can reuse the same merge rules against a dynamic base.
- Plotly, Vega-Lite, PyDeck, DataFrame, Components v1, and Components v2 consume the local Emotion
  theme. They therefore update when rendered below a scoped provider.
- Popovers, menus, and other React portals retain their creating React context even though their
  DOM nodes mount under a body-level portal host.

### Feasibility spike

A temporary Vitest test used the repository's actual `createTheme`, `ThemeProvider`, Emotion, and
portal dependencies. It verified that:

1. Overriding only `primaryColor` preserved the inherited background color.
2. A sibling outside the provider kept the original primary color.
3. A child and a portaled child inside the provider both received the override.

The focused test passed (`1 test, 1 passed`). The temporary file was removed after validation.

### Known boundaries

- `baseFontSize` is applied by root `Global` styles to `html`, so it cannot be honestly scoped by
  a nested provider.
- Font source declarations live in the document head and need global lifecycle management.
- `st.toast` copies content into a global queue whose renderer is outside the originating block;
  its scope cannot be preserved without changing the queue payload/rendering architecture.
- A scoped `backgroundColor` does not paint a surface automatically today. The themed container
  must explicitly use its effective `bgColor` and `bodyText` on its inner flex block.

These are why the MVP uses an audited theme-token subset and excludes global effects/fonts.

## Proposal

### Theme layers

Theme resolution follows a fixed order:

```text
Configured/user-selected app theme
        ↓
Session runtime override from st.set_page_config(theme=...)
        ↓
Nearest ancestor st.container(theme=...)
        ↓
Nested st.container(theme=...) overrides
```

Each layer is partial. Unspecified values come from the layer directly above it. A layer with an
explicit light/dark `base` first selects that app mode and then applies its values. Otherwise, its
active `light` or `dark` section follows the effective mode of the layer above it.

An explicit `base` also changes where unspecified tokens come from: it starts from the app's
configured light/dark variant (falling back to the preset) instead of the nearest scoped
container, so an outer scope's tokens do not inherit through it. Implementations must not merge the
explicit-`base` path against `parentEmotion`.

### Protobuf

Define a reusable wrapper next to `CustomThemeConfig` in `NewSession.proto`:

```protobuf
message ThemeOverride {
  // Presence distinguishes inherited mode from an explicit LIGHT value.
  optional CustomThemeConfig.BaseTheme base = 1;
  // Flat values are shared; values.light/dark are optional mode overrides.
  CustomThemeConfig values = 2;
}
```

The wrapper is necessary because `CustomThemeConfig.base` is a non-optional proto3 enum whose
unset value is indistinguishable from `LIGHT`. Do not change the existing field's presence or move
`CustomThemeConfig` to another proto file because `NewSession` is consumed by external services.

The wrapper is only needed for `base`. The scalar visual tokens already carry proto3 field
presence: `CustomThemeConfig` declares `show_widget_border` and `link_underline` (and the other
override tokens) as `optional`, so an explicit `false`/empty value is distinguishable from an
omitted field. `skipProtobufDefaults` therefore only guards against genuinely unset scalars and
never erases a deliberate `false`.

Importing `NewSession.proto` into `Block.proto` and `PageConfig.proto` creates a dependency on the
session-initialization message definitions. An alternative is a shared `Theme.proto` imported by
all three messages, but relocating
`CustomThemeConfig` would move its wire location and break external `NewSession` consumers, so this
proposal keeps the message in place and revisits extraction only if the coupling becomes a problem.

Import `NewSession.proto` from `Block.proto` and `PageConfig.proto`, then add:

```protobuf
message Block {
  // Existing fields...
  ThemeOverride theme = 18;
  // Next ID: 19
}

message PageConfig {
  // Existing fields...
  ThemeOverride theme = 7;
}
```

Message-field presence has two uses:

- An absent `PageConfig.theme` means `theme=None`: keep the previous runtime layer.
- A present but empty `PageConfig.theme` means `theme={}`: clear the runtime layer.

For `Block.theme`, omit the message for `None` and empty mappings because both mean ordinary
inheritance for a newly declared container.

Regenerate Python and TypeScript protobufs with `make protobuf`.

### Backend schema and serialization

Add a shared `ThemeConfig` `TypedDict` and serializer under
`lib/streamlit/elements/lib/theme_utils.py` (exact module name can follow nearby conventions).
The serializer is used by both public commands and must:

1. Require a mapping and reject unknown/camelCase keys with an actionable snake_case suggestion.
2. Map `base="inherit"` to no wrapper `base`, and map light/dark to the optional enum.
3. Populate shared fields in `ThemeOverride.values` and populate the optional one-level
   `values.light`/`values.dark` messages with the same field schema.
4. Reject `base`, `light`, or `dark` inside a variant mapping to prevent recursive sections.
5. Validate CSS colors with the same parser used by config theming.
6. Validate radius literals/units and chart-palette lengths before enqueueing.
7. Reject excluded fields rather than silently ignoring them.

Unlike startup configuration, public API validation should fail fast with
`StreamlitAPIException`; logging a warning and falling back would make conditional runtime styling
hard to debug.

`st.container` copies a non-empty serialized override to `block_proto.theme`. The theme must not
participate in `Block.id` or descendant widget IDs: changing appearance must not reset widgets.

`st.set_page_config` sets `msg.page_config_changed.theme` whenever `theme` is not `None`. For an
empty mapping, call `SetInParent()` without values so the frontend receives a present empty
message. Multiple messages naturally produce last-write-wins behavior.

### Scoped frontend provider

Add a `ScopedThemeProvider` in `frontend/lib`:

```tsx
function ScopedThemeProvider({ override, children }): ReactElement {
  const parentEmotion = useEmotionTheme()
  const { availableThemes } = useContext(ThemeContext)

  const scopedTheme = useMemo(
    () => createThemeFromOverride(override, parentEmotion, availableThemes),
    [override, parentEmotion, availableThemes]
  )

  return (
    <ThemeProvider
      theme={scopedTheme.emotion}
      baseuiTheme={scopedTheme.basewebTheme}
    >
      {children}
    </ThemeProvider>
  )
}
```

`createThemeFromOverride` should reuse `createTheme`, not mutate the parent theme. When `base` is
absent, construct the base from the nearest Emotion theme rather than `ThemeContext.activeTheme`.
This is required for nested scoped containers and containers inside the already-themed sidebar.
Preserve `parentEmotion.inSidebar` when deriving the new theme. When `base` is explicit, resolve
the matching configured light/dark theme from `availableThemes`, falling back to the preset.

Before calling `createTheme`, determine the mode from the explicit `base` or the inherited base
theme, merge flat `values` with `values.light` or `values.dark`, and strip all section fields. Use
the existing `mergeWith`/`skipProtobufDefaults` behavior so unset protobuf scalar defaults do not
erase shared values. Select the variant before applying color overrides; this prevents a custom
background color from making its own branch selection oscillate.

In `BlockNodeRenderer`, wrap the `FlexBoxContainer` for a block with `deltaBlock.theme`:

```tsx
const flexContainer = <FlexBoxContainer {...childProps} />
containerElement = node.deltaBlock.theme ? (
  <ScopedThemeProvider override={node.deltaBlock.theme}>
    {flexContainer}
  </ScopedThemeProvider>
) : (
  flexContainer
)
```

The provider must wrap the `FlexBoxContainer`, not just `ChildRenderer`, so the container's border,
radii, gap-related styles, and surface use the effective scope. Gate surface painting on the tokens
the scope actually sets: apply `backgroundColor: theme.colors.bgColor` only when the override
includes `background_color`, and `color: theme.colors.bodyText` only when it includes `text_color`.
A primary-only scope therefore adds no opaque `StyledFlexContainerBlock` background and preserves
today's stacking behavior, matching the product spec. Do not add padding or a border beyond the
existing `border` behavior.

This design also handles elements inserted later through `container.button(...)`: their render-tree
nodes remain descendants of the same block.

### Runtime frontend layer

Do not pass runtime updates through `App.processThemeInput`. That method manages static available
themes from `NewSession`; reusing it would replace available themes and could briefly reapply the
static theme on every rerun.

Instead, extend `useThemeManager` to track two independent values:

- `selectedTheme`: the host/user/config-derived theme whose selection may be persisted.
- `runtimeOverride`: the optional `ThemeOverride` received from `PageConfigChanged`.

Compute the exported `activeTheme` as:

```tsx
const activeTheme = useMemo(
  () =>
    runtimeOverride
      ? createThemeFromOverride(
          runtimeOverride,
          selectedTheme.emotion,
          availableThemes
        )
      : selectedTheme,
  [runtimeOverride, selectedTheme, availableThemes]
)
```

Theme-menu selections update `selectedTheme`; the runtime layer remains applied until cleared.
Only `selectedTheme` is cached as the user's browser preference. Changing static themes in a new
session updates the base/available themes without clearing the runtime layer, preventing a
static→runtime flash during reruns.

Because `activeTheme` depends on `selectedTheme`, a runtime mapping with light/dark sections is
re-resolved immediately when a user changes the Streamlit theme menu or an auto theme responds to
the operating-system preference. The mapping follows that mode unless its wrapper `base` is
explicit.

Extend the page-config handler:

- Absent theme field: no update.
- Present empty field: set `runtimeOverride` to `undefined`.
- Present non-empty field: replace `runtimeOverride`.

`RootStyleProvider`, `ThemeContext.activeTheme`, host `SET_THEME_CONFIG` messages, exported custom
component themes, and `App.getThemeColorScheme()` must all consume the effective `activeTheme`.
This makes app-wide colors update immediately and makes `st.context.theme.type` correct on the
next client-originated rerun. Do not trigger a rerun automatically.

### Updates, reruns, and cleanup

- Scoped providers are pure render-tree data and require no frontend state store or cleanup.
- A full or fragment rerun can replace a block's override at the same delta path.
- A fragment rerun replaces only the fragment's delta subtree; an enclosing themed container's
  provider stays mounted and keeps scoping its descendants.
- Changing a theme does not change container or widget identity.
- The session runtime layer lives for the websocket/app session and is discarded on disconnect.
- Navigation inherits the previous page-config layer until another page replaces or clears it,
  matching other additive `st.set_page_config` fields.

### Performance

Only blocks with a theme mapping create a nested provider. Memoize the full theme by the decoded
override, inherited Emotion theme, and available-theme identities. Theme creation is pure and does
not traverse descendants; Emotion updates only consumers in that subtree.

The runtime layer creates one full theme per change. It replaces the root theme once and has the
same render cost as a user changing the theme in Streamlit's menu today.

### Compatibility and security

- Older frontends ignore unknown protobuf fields; older backends never send them.
- No CSS text or selectors cross the protocol. Values pass existing theme validation and Emotion's
  structured style generation.
- Font URLs remain unsupported in the API, so this proposal adds no resource-loading or CSP path.
- SiS, Community Cloud, embedded apps, and local apps use the same ForwardMsg/render-tree path.
- Host theme messages must contain the effective runtime theme so an embedding host is not left
  with stale colors.

## Testing Plan

### Python unit tests

- Serialize every supported `ThemeConfig` key for `st.container` and `st.set_page_config`.
- Verify `None`, empty, and non-empty presence semantics.
- Verify base enum presence for inherit/light/dark.
- Serialize shared plus optional light/dark sections and reject recursive sections.
- Reject unknown/camelCase keys, invalid colors/radii, and invalid chart palettes.
- Verify changing the theme does not change a keyed container ID.

### Frontend unit tests

- A themed block updates its own surface and descendants but not siblings/ancestors.
- A scope that sets `background_color`/`text_color` paints the container surface, while a
  primary-only scope leaves `StyledFlexContainerBlock` without an opaque background.
- Nested partial scopes inherit unspecified tokens and override specified tokens.
- A scope with light/dark sections switches variants when its inherited mode changes; an explicit
  base stays fixed.
- A scope inside the sidebar inherits the sidebar theme and preserves `inSidebar`.
- Portaled content receives the scoped Emotion and BaseWeb theme.
- Plotly/Vega/DataFrame and Components v1/v2 receive the local theme.
- Runtime override replacement, empty reset, user selection changes, and static theme refreshes
  produce the expected effective theme and light/dark variant without flashing.
- Host messages and `getThemeColorScheme` use the effective theme.

### E2E tests

- Toggle a page-wide light/dark runtime mapping and assert app, sidebar, chart, and widget colors.
- Change the Streamlit/system theme with `base` inherited and verify both page-wide and scoped
  mappings switch variants without a script rerun.
- Render green/red scoped primary buttons beside an unchanged button.
- Verify a themed popover body/select menu and a chart palette.
- Navigate among two themed pages and one page that clears the override.
- Interact with a widget before and after a scoped theme change and verify its state is retained.

Run focused unit tests during development, the new E2E file with `make run-e2e-test <file>`, and
`make check` before finalizing.

## Alternatives Considered

### Dedicated `st.theme` block

A new transparent block could wrap children in `ScopedThemeProvider` without adding a DOM node.
It is technically feasible, but it adds a public container-like primitive and makes `st.theme(...)`
ambiguous between local and app-wide behavior. `st.container(theme=...)` uses existing composition
and gives `background_color` a concrete surface.

### Per-element `styles`/`theme` fields

This would require widespread public signatures and/or element protobuf fields. A CSS mapping
would couple apps to DOM details; a theme mapping on every element would duplicate a capability
already achieved by wrapping the element in one container.

### CSS variables on a keyed wrapper

Emitting local CSS custom properties is lightweight, but Streamlit components currently consume
typed Emotion/BaseWeb themes and derived tokens. Reimplementing derivation as CSS variables would
miss charts, canvas renderers, custom-component payloads, and BaseWeb components.

### Reprocess runtime input as a new static custom theme

Calling `processThemeInput` for every page-config update reuses more code but conflates a temporary
session overlay with available/cached themes. It risks selection resets and static-theme flashes
between NewSession and PageConfig messages. Keeping a separate runtime layer is more predictable.
