---
author: lukasmasuch
created: 2026-03-13
---

# `st.iframe` - Embed content in an iframe

## Summary

Add `st.iframe` to the main Streamlit namespace to embed external URLs, HTML content, or
local files in an iframe. This consolidates the functionality of `st.components.v1.iframe`
and `st.components.v1.html` into a single, discoverable command while adding support for
local files (HTML, PDF, images, SVG, etc.) and relative URLs to static assets.

## Problem

### Current State

Streamlit provides two ways to embed content in iframes, both buried in the `st.components.v1`
namespace:

```python
import streamlit.components.v1 as components

# Embed a URL
components.iframe("https://example.com", height=500)

# Embed HTML content
components.html("<p>Hello World</p>", height=100)
```

**Issues with the current approach:**

1. **Discoverability**: Users don't expect iframe functionality in `st.components.v1`, which
   is primarily for building custom components. Many users don't know these functions exist.

2. **Deprecation path**: With the release of Custom Components v2 in Streamlit 1.51, we want
   to move away from the v1 API. Having `iframe` and `html` in `st.components.v1` creates
   confusion about their relationship to the components system.

3. **Limited file support**: There's no way to embed a local file (HTML, PDF, image, etc.)
   or reference static assets relative to the app—users must read HTML files manually and
   pass as a string, and non-HTML files require static file serving setup.

### User Requests

**Primary:**

- [#12977](https://github.com/streamlit/streamlit/issues/12977) - Add `st.iframe` command

**Related:**

- [#4659](https://github.com/streamlit/streamlit/issues/4659) - Dynamic height for iframe/html
  (25 👍) — Addressed by `height="content"` for HTML strings and local files
- [#5632](https://github.com/streamlit/streamlit/issues/5632) - Scale iframe option (2 👍) —
  Future consideration for thumbnail/preview use cases
- [#6195](https://github.com/streamlit/streamlit/issues/6195) - Host folder as website (6 👍) —
  Addressed by Starlette integration in 1.53; can combine with `st.iframe` to preview

### Use Cases

1. **Embed external content**: Dashboards, documentation, third-party widgets
2. **Render static HTML**: Generated reports, HTML exports from visualization libraries
3. **Display PDFs**: Embed PDF documents in the app (note: `st.pdf` is preferred for PDF display)
4. **Preview generated sites**: Show mkdocs/sphinx builds, static site previews
5. **Isolated JavaScript**: Run JavaScript in a sandboxed environment

---

## Proposal

### API

```python
st.iframe(
    src: str | Path,
    *,
    width: int | Literal["stretch", "content"] = "stretch",
    height: int | Literal["stretch", "content"] = "content",
    tab_index: int | None = None,
)
```

### Parameters

| Parameter   | Type                                  | Default     | Description                                                                                                              |
| ----------- | ------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| `src`       | `str \| Path`                         | (required)  | Content to embed: a URL, file path, or HTML string. Streamlit auto-detects the type (see Input Modes below).             |
| `width`     | `int \| "stretch" \| "content"`       | `"stretch"` | Width of the iframe in CSS pixels, or `"stretch"` to fill container width, or `"content"` to match content width. For URLs, `"content"` falls back to `"stretch"` due to cross-origin restrictions (see note below). |
| `height`    | `int \| "stretch" \| "content"`       | `"content"` | Height in CSS pixels, `"stretch"` to fill container, or `"content"` to auto-size. For URLs, `"content"` falls back to 400px due to cross-origin restrictions (see note below). |
| `tab_index` | `int \| None`                         | `None`      | Controls sequential focus navigation. See [tabindex docs](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/tabindex). |

> **Note on `"content"` sizing:** For HTML strings and local HTML files (embedded via `srcdoc`),
> Streamlit can measure the content and auto-size the iframe. For external URLs and non-HTML
> local files (served via media storage), browsers block cross-origin content measurement,
> so `height="content"` falls back to 400px and `width="content"` falls back to `"stretch"`. Libraries like
> [iframe-resizer](https://github.com/davidjbradshaw/iframe-resizer) can enable content-based
> sizing for cross-origin iframes, but require the external site to include a guest script—
> this could be explored as a future enhancement for `srcdoc` content.

### Input Modes

The `src` parameter accepts four types of input, auto-detected in this order:

**1. Absolute URL** — Embed external content:

```python
st.iframe("https://docs.streamlit.io", height=600)

# Data URLs are also supported (e.g., for inline PDFs or images)
st.iframe("data:text/html,<h1>Hello</h1>", height=100)
```

**2. Relative URL** — Reference static files served by Streamlit:

```python
# Assumes file exists at ./static/report.html (with static file serving enabled)
st.iframe("/app/static/report.html", height=400)
```

**3. Local file path** — Embed a local file:

```python
from pathlib import Path

# HTML files are read and embedded directly
st.iframe(Path("reports/dashboard.html"), height=500)
st.iframe("reports/dashboard.html", height=500)  # Also works with string paths

# Non-HTML files (PDF, images, SVG, etc.) are served via media storage
st.iframe(Path("documents/manual.pdf"), height=600)
st.iframe("charts/visualization.svg", height=400)
```

When a path is detected (either a `Path` object or a string that resolves to an existing
file), Streamlit handles it based on file type:

- **HTML files** (`.html`, `.htm`, `.xhtml`): Read content and embed using `srcdoc`
- **Other files** (PDF, images, SVG, text, etc.): Upload to media file storage and
  embed using the resulting URL in `src`. The browser's native viewer handles rendering.

**4. HTML string** — Embed HTML directly (fallback when no other type matches):

```python
st.iframe("<h1>Hello World</h1><p>This is embedded HTML.</p>", height=100)
```

### Behavior

**Input type detection:**

Streamlit determines the input type in this order:

1. If `src` is a `Path` object → local file path
2. If `src` starts with `http://`, `https://`, `data:`, or `/` → URL
3. If `src` is a string that exists as a local file → local file path
4. Otherwise → HTML string (embedded via `srcdoc`)

This order ensures URL patterns are detected before filesystem checks, preventing relative URLs
like `/app/static/report.html` from being misinterpreted as file paths. Plain strings that don't
match URLs or existing files (e.g., `"foo"`) are treated as HTML and embedded via `srcdoc`.

**Local file handling:**

When `src` points to a local file, Streamlit handles it based on the file extension:

**HTML files** (`.html`, `.htm`, `.xhtml`):

1. Read the file content with UTF-8 encoding
2. Embed using the iframe's `srcdoc` attribute
3. Relative paths are resolved from the working directory (where `streamlit run` executes)

**Other files** (PDF, images, SVG, text, etc.):

1. Read the file content as binary
2. Upload to the media file storage (same system used by `st.image`, `st.audio`, `st.video`)
3. Embed using the resulting URL in the iframe's `src` attribute
4. The browser's native viewer handles rendering (e.g., PDF viewer, image display)

This approach leverages the browser's built-in capabilities—PDFs render in the browser's
PDF viewer, images display natively, SVGs render as vector graphics, and text files show
as plain text. File types the browser doesn't support natively (e.g., `.docx`, `.xlsx`)
will typically trigger a download prompt instead of rendering inline.

**Note on relative asset references:** When embedding a local HTML file via `srcdoc`, relative
asset references inside that HTML (e.g., `./styles.css`, `images/foo.png`) will **not** resolve
relative to the file's original directory—they resolve relative to the app URL. To reference
assets from local HTML files, either:

- Use absolute paths to static files: `/app/static/styles.css` (with static serving enabled)
- Inline assets directly in the HTML file
- Use data URLs for small assets

**Static file serving:**

Relative URLs like `/app/static/...` work when static file serving is enabled in
`config.toml`:

```toml
[server]
enableStaticServing = true
```

This allows serving files from the `./static` directory at `/app/static/...`.

**Sandbox policy:**

The iframe uses the same sandbox policy as `st.components.v1.iframe`:

- `allow-forms`
- `allow-modals`
- `allow-popups`
- `allow-popups-to-escape-sandbox`
- `allow-same-origin`
- `allow-scripts`
- `allow-downloads`

This permissive policy is necessary for most use cases (forms, JavaScript execution,
downloads) while still providing basic isolation.

**Permissions policy:**

The iframe uses the same permissive `allow` policy as `st.components.v1.iframe`, which includes:

- `fullscreen`, `autoplay`, `camera`, `microphone`, `geolocation`, `payment`
- `accelerometer`, `gyroscope`, `magnetometer`, `ambient-light-sensor`
- `clipboard-write`, `encrypted-media`, `picture-in-picture`, `usb`, `midi`
- And other browser features (see `DEFAULT_IFRAME_FEATURE_POLICY` in frontend code)

This permissive default maintains compatibility with existing components and enables common
use cases. A future `allow` parameter could let users restrict permissions for specific embeds.

**Height modes:**

The `height` parameter supports three modes:

- **`"content"` (default)**: Automatically sizes to match content height.
  - For HTML strings and local HTML files: Streamlit injects JavaScript to measure and report height.
  - For URLs and non-HTML local files: Falls back to 400px (cross-origin security prevents height measurement).
- **Pixel value**: Fixed height in CSS pixels (e.g., `height=500`). Use when you need
  precise control or know the content dimensions.
- **`"stretch"`**: Fills available vertical space. Works best inside flex containers or
  elements with defined heights. Uses `height: 100%` and `flex-grow: 1`.

This smart default means most embeds "just work" without specifying height:

```python
# HTML auto-sizes to content
st.iframe("<p>Short content</p>")  # → small iframe
st.iframe("<div>..." + "x" * 1000 + "</div>")  # → taller iframe

# URLs use sensible fallback
st.iframe("https://example.com")  # → 400px default
st.iframe("https://example.com", height=600)  # → explicit override
```

### Examples

**Embed an external website:**

```python
import streamlit as st

st.iframe("https://docs.streamlit.io", height=600)
```

**Embed HTML content directly:**

```python
import streamlit as st

st.iframe(
    """
    <style>
        body { font-family: sans-serif; padding: 1rem; }
        .highlight { background: yellow; }
    </style>
    <p>This is <span class="highlight">highlighted</span> text.</p>
    """,
    height=100,
)
```

**Embed a local HTML report:**

```python
import streamlit as st
from pathlib import Path

# Generated by another tool (e.g., pandas profiling, pytest-html)
st.iframe(Path("reports/analysis.html"), height=800)
```

**Embed a PDF document:**

```python
import streamlit as st
from pathlib import Path

# Note: For displaying PDFs, st.pdf is the preferred method.
# st.iframe can be used as an alternative when needed.

# Local PDF file (uploaded to media storage, rendered by browser's PDF viewer)
st.iframe(Path("documents/manual.pdf"), height=600)

# External PDF (via URL)
st.iframe("https://example.com/document.pdf", height=600)

# Local PDF via static serving
st.iframe("/app/static/manual.pdf", height=600)
```

**Embed an SVG or image:**

```python
import streamlit as st
from pathlib import Path

# SVG files render as vector graphics
st.iframe(Path("charts/diagram.svg"), height=400)

# Images display natively
st.iframe(Path("assets/preview.png"), height=300)
```

**Preview a generated static site:**

```python
import streamlit as st

# Use with Starlette static file mounting (Streamlit 1.53+)
# The site is mounted at /preview via streamlit.starlette.App
st.iframe("/preview/index.html", height=800)
```

---

## Migration from `st.components.v1`

Users can migrate with minimal changes:

```python
# Before
import streamlit.components.v1 as components
components.iframe("https://example.com", height=500)
components.html("<p>Hello</p>", height=100)

# After
import streamlit as st
st.iframe("https://example.com", height=500)
st.iframe("<p>Hello</p>", height=100)
```

**Deprecation plan:** With the introduction of `st.iframe`, the legacy `st.components.v1.iframe`
and `st.components.v1.html` functions will begin a soft deprecation (log + docstring deprecation
warning).

---

## Alternatives Considered

### Naming: `st.iframe` vs `st.embed`

**Option A: `st.iframe`** ✅ PREFERRED

```python
st.iframe("https://example.com", height=600)
st.iframe("<p>Hello</p>", height=100)
```

**Pros:**

- Technically accurate — content is rendered in an HTML `<iframe>`
- Familiar to web developers
- Clear about the isolation/sandboxing behavior
- Matches `st.components.v1.iframe` for easier migration

**Cons:**

- "iframe" is technical jargon that non-web-developers may not recognize

**Option B: `st.embed`**

```python
st.embed("https://example.com", height=600)
st.embed("<p>Hello</p>", height=100)
```

**Pros:**

- More semantic/user-friendly name
- Describes the intent (embed content) rather than the implementation
- Consistent with "embed codes" terminology users see on YouTube, Twitter, etc.

**Cons:**

- Less precise — could be confused with other embedding mechanisms
- Doesn't convey the iframe's security/isolation properties
- Could conflict if we later add other embedding features (e.g., oEmbed support)

**Decision:** `st.iframe` is preferred because it's technically precise, familiar to
the target audience, and makes the migration path from `st.components.v1.iframe` obvious.
However, `st.embed` could be considered as an alias if user feedback shows confusion.


---

## Out of Scope (Future Work)

The following features are intentionally excluded from the initial implementation but
could be added later based on user feedback.

### Dynamic/Auto Height for External URLs

Auto-height for external URLs is not supported due to cross-origin browser restrictions—there
is no way to measure content height without cooperation from the embedded page. When
`height="content"` is used with URLs, it falls back to 400px.

### `scrolling` Parameter

Scrolling is always enabled (`scrolling="auto"`), so scrollbars only appear when content
overflows. Users who need to hide scrollbars can use CSS: `<style>body { overflow: hidden; }</style>`.

### Scale/Zoom Parameter

[#5632](https://github.com/streamlit/streamlit/issues/5632) requests a scale option to
render wide viewports in narrow spaces (e.g., show desktop version in a mobile-width
column). This could be added later:

```python
# Potential future API
st.iframe("https://example.com", width=300, viewport_width=1200, scale=0.25)
```

This would use CSS transforms to scale the iframe. Worth revisiting if demand grows.

### Folder Serving

[#6195](https://github.com/streamlit/streamlit/issues/6195) requests serving a local
folder as a website. This is now possible with the Starlette integration (1.53+):

```python
from streamlit.starlette import App
from starlette.routing import Mount
from starlette.staticfiles import StaticFiles

app = App("main.py", routes=[
    Mount("/preview", app=StaticFiles(directory="./site", html=True)),
])

# In main.py
st.iframe("/preview/", height=600)
```

This is the recommended approach and doesn't require changes to `st.iframe`.

### `title` Parameter (Accessibility)

Screen readers use the `title` attribute to describe iframe content. This is a best
practice for accessibility and trivial to implement.

```python
st.iframe(
    "https://docs.streamlit.io",
    title="Streamlit documentation",
    height=600,
)
```

### `border` Parameter (Styling)

Consistent with `st.container(border=True)`. Allows users to visually distinguish
embedded content without custom CSS.

```python
st.iframe("https://example.com", border=True)  # Shows a subtle border
```

### `loading` Parameter (Performance)

Native browser lazy loading can significantly improve page load time when apps have
multiple iframes or iframes below the fold.

```python
st.iframe(
    "https://heavy-dashboard.com",
    loading="lazy",  # "eager" (default) or "lazy"
    height=600,
)
```

### Theme-Aware HTML Content

[#4198](https://github.com/streamlit/streamlit/issues/4198) requests exposing theme
colors to HTML components. When embedding HTML strings, we could inject CSS variables:

```python
st.iframe(
    """
    <style>
        body { background: var(--background-color); color: var(--text-color); }
        a { color: var(--primary-color); }
    </style>
    <p>This adapts to <a href="#">Streamlit's theme</a>!</p>
    """,
    inject_theme=True,  # Inject CSS variables matching st.context.theme
)
```

**Trade-off:** Adds complexity; users can achieve this manually with `st.context.theme`.

### `on_load` Callback

Know when the iframe has finished loading. Useful for showing loading states or
triggering subsequent actions.

```python
def handle_load():
    st.session_state.iframe_loaded = True

st.iframe("https://example.com", on_load=handle_load)
```

**Trade-off:** Requires frontend-to-backend communication; adds complexity.

### `aspect_ratio` Parameter

Maintain aspect ratio (useful for video embeds). Height auto-calculated from width.

```python
# 16:9 video embed
st.iframe("https://youtube.com/embed/...", aspect_ratio="16:9")

# Square embed
st.iframe("https://instagram.com/...", aspect_ratio="1:1")
```

### `allow` Parameter (Feature Policy)

Customize which browser features the iframe can access. Important for embeds that need
camera, microphone, or payment APIs.

```python
# Video chat embed needs camera/mic
st.iframe("https://meet.example.com", allow="camera; microphone")

# Payment form
st.iframe("https://checkout.stripe.com/...", allow="payment")

# Media player with autoplay
st.iframe("https://player.vimeo.com/...", allow="autoplay; fullscreen")
```

### `caption` Parameter

Add descriptive text below the iframe, similar to `st.image(caption=...)`.

```python
st.iframe(
    "https://example.com/chart",
    height=400,
    caption="Source: Example Analytics Dashboard",
)
```

### `referrer_policy` Parameter

Control what referrer information is sent when loading external URLs. Useful for privacy
and when embedding content that shouldn't know the referring page.

```python
st.iframe(
    "https://external-widget.com",
    referrer_policy="no-referrer",  # Options: "no-referrer", "origin", etc.
)
```

**Trade-off:** Niche use case; default policy is usually fine.

### `sandbox` Parameter (Security)

Allow users to customize sandbox restrictions for specific use cases:

```python
# Restrictive: No scripts, no forms
st.iframe("https://untrusted.com", sandbox="allow-same-origin")

# Permissive: Full access (current default)
st.iframe("https://trusted.com", sandbox=None)
```

**Trade-off:** Exposes complexity; wrong settings can break functionality. Current
permissive default works for most cases.

---

## Checklist

| Item                       | ✅ or comment                                                                                      |
| -------------------------- | -------------------------------------------------------------------------------------------------- |
| Works on SiS, Cloud, etc?  | ✅ Yes - uses existing iframe infrastructure                                                       |
| No breaking API changes    | ✅ Yes - new command, existing `st.components.v1` functions remain                                 |
| No new dependencies        | ✅ Yes - uses existing protobuf and frontend components                                            |
| Metrics collected          | ✅ Yes - via `@gather_metrics("iframe")` (new metric name; legacy APIs use `_iframe`/`_html`)      |
| Any security/legal impact? | ✅ No - uses same sandbox policy as existing iframe; content isolation unchanged                   |
| Any docs changes needed?   | ✅ Yes - add `st.iframe` to API reference, add migration note to `st.components.v1` docs           |
