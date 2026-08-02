---
author: lukasmasuch
created: 2026-08-02
---

# Scoped and Runtime Theme Overrides

## Summary

Add a typed theme-override mapping to `st.container` and `st.set_page_config`.
`st.container(theme=...)` changes semantic design tokens only for that container and its
descendants, while `st.set_page_config(theme=...)` applies the same tokens to the current
browser session at runtime. This supports targeted styling, per-page themes, and user-specific
themes without exposing Streamlit's DOM or CSS implementation. Optional `light` and `dark`
sections let one mapping follow the user's active theme mode.

## Problem

Streamlit themes are primarily deployment-level configuration. Users can define themes in
`config.toml`, but they cannot safely apply an accent to one region or choose a theme from app
logic. Common workarounds inject CSS against generated DOM selectors, which is global, brittle,
and difficult to compose.

The requests fall into several related use-case clusters:

- [#10749](https://github.com/streamlit/streamlit/issues/10749) requests a stylable container
  so a theme value can affect only selected elements. A follow-up also asks for page-specific
  themes.
- [#14172](https://github.com/streamlit/streamlit/issues/14172) requests runtime, per-session
  themes for account preferences and light/dark toggles.
- [#8271](https://github.com/streamlit/streamlit/issues/8271) and
  [#6649](https://github.com/streamlit/streamlit/issues/6649) ask more broadly for element
  customization or a `styles` argument on every widget.
- [#3656](https://github.com/streamlit/streamlit/issues/3656) shows a concrete need to visually
  distinguish buttons without global CSS selectors.
- [#6291](https://github.com/streamlit/streamlit/issues/6291) asks for reusable chart theming,
  while [#9034](https://github.com/streamlit/streamlit/issues/9034) asks for raw utility classes.
  The former fits semantic theme tokens; the latter remains intentionally out of scope.

Static custom light/dark variants are covered separately by
[#6813](https://github.com/streamlit/streamlit/issues/6813). Runtime theme awareness has a known
timing limitation tracked in [#11920](https://github.com/streamlit/streamlit/issues/11920).

The broad styling requests include unrelated layout and CSS use cases. This proposal addresses
the subset that maps cleanly to Streamlit's semantic theme tokens. It does not promise arbitrary
CSS, positioning, or element internals.

## Goals

- Make one element group use a different accent, surface, border, or chart palette.
- Let app logic update the effective theme for the current session without a server restart.
- Support page-specific themes in multipage apps.
- Let scoped and runtime themes define light/dark variants that react to the active app mode.
- Preserve Streamlit's design system and keep apps independent of internal CSS selectors.
- Use one mapping format for local and page-wide overrides.

## Proposal

### Theme mapping

Introduce public `ThemeConfig` and `ThemeVariantConfig` `TypedDict`s, re-exported from the
top-level `streamlit` namespace (for example, `from streamlit import ThemeConfig`) so IDEs can
discover them when annotating theme mappings. Python keys use `snake_case`, consistent with
Streamlit's Python API. Each visual key corresponds to an existing theme token.

```python
class ThemeVariantConfig(TypedDict, total=False):
    primary_color: str
    background_color: str
    secondary_background_color: str
    text_color: str
    link_color: str
    link_underline: bool
    code_text_color: str
    code_background_color: str
    border_color: str
    dataframe_border_color: str
    dataframe_header_background_color: str
    show_widget_border: bool
    base_radius: str
    button_radius: str
    chart_categorical_colors: Sequence[str]
    chart_sequential_colors: Sequence[str]
    chart_diverging_colors: Sequence[str]


class ThemeConfig(ThemeVariantConfig, total=False):
    base: Literal["inherit", "light", "dark"]
    light: ThemeVariantConfig
    dark: ThemeVariantConfig
```

This is a deliberately audited subset of `config.toml` theming. Additional semantic tokens can
be added later without changing either command signature.

`base` behaves as follows:

- Omitted or `"inherit"`: inherit from the effective parent theme.
- `"light"` or `"dark"`: start from the app's corresponding configured light/dark variant,
  falling back to Streamlit's preset when no configured variant exists, and then apply the
  remaining overrides.

Flat visual keys are shared between both modes. Optional `light` and `dark` mappings override the
shared values only when their mode is active. Variant mappings cannot contain `base`, `light`, or
`dark` recursively.

```python
brand_theme = {
    "primary_color": "#7C3AED",  # Shared by both modes.
    "button_radius": "full",
    "light": {
        "background_color": "#FAFAFF",
        "secondary_background_color": "#F3F0FF",
        "text_color": "#1F1733",
    },
    "dark": {
        "background_color": "#171221",
        "secondary_background_color": "#241B33",
        "text_color": "#F7F2FF",
    },
}
```

When `base` is inherited, switching Streamlit's theme menu or the operating-system theme switches
the active variant immediately in the browser. It does not require a Python rerun. If only one
variant is provided, the other mode uses the shared values over its inherited base.

Invalid keys and values raise a `StreamlitAPIException` with the invalid key/value and accepted
alternatives. The validation rules for colors, radii, and chart palettes match their existing
`config.toml` equivalents.

### Scoped themes with `st.container`

Add one keyword-only parameter:

```python
def st.container(
    *,
    # Existing parameters...
    theme: ThemeConfig | None = None,
) -> DeltaGenerator:
    ...
```

The simplest use case remains a regular container around the target element:

```python
import streamlit as st

with st.container(theme={"primary_color": "green"}):
    st.button("Approve", type="primary")

st.button("Unchanged", type="primary")
```

The returned container continues to support method calls:

```python
danger = st.container(theme={"primary_color": "#DC2626"})
danger.button("Delete account", type="primary")
```

A richer card can override several semantic tokens:

```python
card_theme = {
    "background_color": "#F0FDF4",
    "secondary_background_color": "#DCFCE7",
    "text_color": "#14532D",
    "primary_color": "#16A34A",
    "border_color": "#86EFAC",
    "base_radius": "large",
}

with st.container(border=True, theme=card_theme):
    st.subheader("Healthy")
    st.metric("Availability", "99.99%")
    st.button("View details", type="primary")
```

Scoped themes compose. An inner mapping inherits unspecified tokens from the nearest themed
container:

```python
with st.container(theme={"primary_color": "green", "button_radius": "full"}):
    st.button("Green pill", type="primary")

    with st.container(theme={"primary_color": "orange"}):
        st.button("Orange pill", type="primary")  # Inherits button_radius.
```

Inheritance from the nearest themed container applies only when the inner scope omits `base` (or
uses `"inherit"`). Setting `base="light"` or `base="dark"` resets the starting point to the app's
configured variant, so an outer scope's tokens (such as `primary_color`) no longer carry through.

A scope can follow the app's light/dark mode:

```python
with st.container(border=True, theme=brand_theme):
    st.subheader("Mode-aware card")
    st.button("Continue", type="primary")
```

Behavior:

- The override applies to the container surface and all descendants, including columns, tabs,
  expanders, charts, and custom components created inside it.
- The container paints a surface only when the scope sets `background_color`, and applies a new
  `text_color` only when the scope sets it. A primary-only override adds no opaque background, so
  it preserves today's stacking behavior. Existing padding behavior is unchanged; use `border=True`
  for an inset card.
- Siblings and ancestors remain unchanged.
- Portaled descendants such as select menus, tooltips, and popover bodies keep the scoped theme.
- Light/dark sections follow the effective parent mode unless `base` forces a mode.
- Changing the mapping on a rerun updates the theme without resetting widget identity or state.
- `theme=None` preserves current behavior and adds no theme provider.

### Runtime themes with `st.set_page_config`

Add a keyword-only `theme` parameter to the existing page-level configuration command:

```python
def st.set_page_config(
    # Existing parameters...
    *,
    theme: ThemeConfig | None = None,
) -> None:
    ...
```

This supports a user-controlled theme without restarting the server:

```python
import streamlit as st

mode = st.segmented_control(
    "Theme",
    ["light", "dark"],
    default="light",
    label_visibility="collapsed",
)

st.set_page_config(theme={**brand_theme, "base": mode})
```

Unlike most page settings, `theme` may be set after other commands have run, so the override can
depend on widget values from the same run. On the first run of a new session the control returns
its `default`, so the initial theme matches that default; persist the choice (for example in
`st.session_state` or a user profile) to restore a returning user's selection.

If the app should continue following the user's Streamlit/system theme selection, omit `base`:

```python
st.set_page_config(theme=brand_theme)
```

The runtime override is:

- Local to the current browser session. It does not modify `config.toml` or other sessions.
- Applied immediately when the frontend receives the command; it does not trigger an additional
  script rerun.
- Layered over the user's currently selected/configured theme unless `base` selects a mode.
- Re-resolved from `light` or `dark` whenever the underlying browser theme mode changes.
- Not persisted across a new browser session by Streamlit. Apps can persist a choice in
  `st.session_state`, a user profile, a cookie-backed component, or their own storage.

`st.set_page_config` remains additive at the parameter level:

- `theme=None` does not change the previous runtime theme override.
- A non-empty mapping replaces the previous runtime override mapping as a whole. This makes the
  result deterministic when app state changes and removes omitted old tokens.
- `theme={}` clears the runtime override and restores the configured/user-selected app theme.
- If multiple calls provide `theme` in one run, the last mapping wins.

This is a deliberate difference from `st.container`, where `theme=None` and `theme={}` both mean
"no scoped override." On `st.set_page_config`, `None` preserves the current runtime override while
`{}` clears it, because the page-level command is additive across reruns and navigation:

| `theme` value | `st.set_page_config` | `st.container` |
|---|---|---|
| `None` (default) | Keep the current runtime override | No scoped override |
| `{}` (empty) | Clear the runtime override | No scoped override |
| `{...}` (non-empty) | Replace the runtime override | Apply the scoped override |

For page-specific themes, each page sets its mapping. A page that wants the normal app theme uses
`theme={}` because page configuration otherwise inherits across navigation:

```python
# pages/finance.py
st.set_page_config(theme={"primary_color": "#0F766E"})

# pages/admin.py
st.set_page_config(theme={"primary_color": "#DC2626"})

# pages/home.py
st.set_page_config(theme={})
```

`st.context.theme.type` reflects the effective page theme on the next rerun the browser sends. It
cannot reflect a theme command from the current Python run because the browser has not yet
processed that run's forward message.

### Scope matrix

| Use case | API | Scope |
|---|---|---|
| One button or chart | Wrap it in `st.container(theme=...)` | That container subtree |
| A card, tab set, or group of columns | `st.container(theme=...)` | All nested content |
| One page | `st.set_page_config(theme=...)` in that page | Current session and page |
| Per-account preference | Load preference, then call `st.set_page_config(theme=...)` | Current session |
| Deployment branding | Existing `config.toml` theme | App defaults for all sessions |

## Alternatives Considered

**Option 1: `theme=` on `st.container` and `st.set_page_config`** ✅ PREFERRED

- Extends commands users already associate with composition and page configuration.
- Uses one reusable, typed mapping for local and page-wide cases.
- Adds one parameter rather than adding styling parameters to every element.
- Keeps the implementation based on semantic tokens instead of DOM/CSS details.

**Option 2: `with st.theme(primary_color="green"):` and `st.set_theme(...)`**

- Direct keyword arguments provide excellent autocomplete.
- A dedicated invisible theme block could avoid layout semantics.
- Introduces two new commands, and `st.theme(...)` is ambiguous between declaring a global theme
  and opening a local scope. A large and growing keyword signature would also duplicate the theme
  schema.

**Option 3: `styles={...}` or `theme={...}` on every element**

- Makes one-element overrides direct.
- Adds a parameter to dozens of commands, duplicates work across elements, and makes grouping
  verbose. Raw styles would expose unstable CSS implementation details and permit combinations
  Streamlit cannot keep visually coherent.

**Option 4: Continue supporting CSS classes via `key=`**

- Requires no new API and can express arbitrary CSS.
- Remains global, depends on DOM structure, is difficult to validate, and does not address
  per-session/page-wide runtime themes.

## Out of Scope (Future Work)

- Arbitrary CSS properties, class utilities, selectors, positioning, and animation.
- Layout customization already covered by width, height, alignment, gap, and container APIs.
- Typography and font loading. `base_font_size` is currently rooted at the global `html` element,
  and remote font sources are injected into the document head; both need a separate audit.
- A separate `sidebar` section and recursive `light`/`dark` sections. The flat mapping and its
  one-level light/dark variants apply consistently to the main app and derived sidebar theme.
- Theme parameters on `st.columns`, `st.tabs`, `st.expander`, or every element. They can be
  composed inside a themed container first.
- Scoped styling for inherently global effects such as `st.toast`, `st.balloons`, and `st.snow`.
- Named theme registries or automatic account persistence.
- New semantic widget variants such as `type="danger"`; scoped primary colors address some of
  the visual need but do not replace a dedicated semantic API.

## Checklist

| Item | ✅ or comment |
|---|---|
| Works on SiS, Cloud, etc? | ✅ Uses the existing session protocol and frontend theme system. |
| No breaking API changes | ✅ Both parameters are optional and keyword-only. |
| No new dependencies | ✅ |
| Metrics collected | Record command/scope usage only; never collect theme values. |
| Any security/legal impact? | No raw CSS or new remote resources; reuse existing value validation. |
| Any docs changes needed? | Add `st.container` and `st.set_page_config` docs plus a theming guide section, including a note that apps are responsible for color contrast (for example `primary_color`/`background_color`/`text_color` pairs), since the feature does not enforce WCAG. |
