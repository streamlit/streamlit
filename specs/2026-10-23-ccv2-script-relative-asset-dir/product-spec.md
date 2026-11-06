---
author: sfc-gh-lwilby-1
created: 2026-10-23
---

# Script-relative `asset_dir` for custom components v2

## Summary

Add an `asset_dir` parameter to `st.components.v2.component()`, the custom components v2
(CCv2) API. A relative path resolves
against the folder of the Python file that calls `component()`. Streamlit then serves the
folder's files the same way it serves an installed package's `asset_dir`, so app authors can
reference JS, CSS, fonts, images and code-split chunks by path without packaging the
component. This matters most for JavaScript-only components, whose Python side is a single
`component()` call and whose code is built with JavaScript tooling.

Tracking issue: [#17633](https://github.com/streamlit/streamlit/issues/17633).

## Problem

### Files are only possible for installed packages

A component defined inside an app has to pass its HTML, CSS and JavaScript as inline
strings. The `component()` docstring says paths and globs are "only possible for installed
components". Inline strings work for snippets, but not for a component built with a
bundler:

- **One file only.** Inline JS can't import other files by relative path, so there are no
  code-split chunks.
- **No other assets.** Fonts, images and WASM can only be embedded as data URIs.
- **Awkward workflow.** The build output has to be read into a Python string, and devtools
  show one long string instead of files.
- **Strict CSPs.** Released versions load inline JS from a `blob:` URL, which a
  Content Security Policy without `blob:` in `script-src` blocks. File-backed JS loads from
  the app's own origin.

### What packaging costs today

Porting a React dashboard (Instant BI, a 794 KB bundle) to custom components v2 showed what
using files takes today. The component needed:

- a separate package with its own `pyproject.toml`: build-system config, a name and version,
  package-data rules so the JS is included, and a `[[tool.streamlit.component.components]]`
  entry declaring `asset_dir`;
- a Python package folder to hold the built bundle;
- `pip install -e ./component` on every machine, in CI and in every deployment. Streamlit
  finds `asset_dir` by scanning installed distributions at startup, so a `pyproject.toml`
  next to the app isn't enough, and without the install the app fails;
- calling the component by its package-qualified name, `st-instant-bi.instant_bi`.

Hosted environments install from a requirements file, so a local package also needs a path
dependency or a package index. Neither was tested for the port. The Streamlit in Snowflake
(SiS) container runtime installs dependencies from Snowflake's shared PyPI repository, which
won't have an app's private package.

Packaging is the right model for components meant to be shared or published. For a component
that belongs to one app, it's a lot of machinery for serving files from a folder next to the
script.

### Measured effect

An unpublished local prototype of this parameter ran the same dashboard from a folder next
to the script:

| | Load: WebSocket | Load: bundle over HTTP | Per rerun: WebSocket |
|---|---|---|---|
| Inline JS, Streamlit 1.66.1 | 3.70 MB | none | 798 KB |
| Script-relative `asset_dir`, prototype | 1.32 MB | 301 KB (compressed) | 4 KB |

The `asset_dir` variant also rendered under a CSP that blocks `blob:` scripts, where inline
JS on 1.66.1 rendered blank. Serving inline JS by content hash is a separate effort that
closes most of the byte gap for inline code (see [Related work](#related-work)). The case
for this feature is therefore files, not bytes: chunks, fonts, images and a normal build
workflow.

## Proposal

### API

```python
st.components.v2.component(
    name: str,
    *,
    html: str | None = None,
    css: str | None = None,
    js: str | None = None,
    asset_dir: str | Path | None = None,
    isolate_styles: bool = True,
) -> ComponentRenderer
```

`asset_dir` is keyword-only, like every other parameter after `name`. It reuses the name of
the `asset_dir` key in a package's `pyproject.toml`, because it is the same concept: the one
folder whose files a component can reference and Streamlit serves. Paths in `html`, `css`
and `js` stay relative to it, exactly as for packaged components.

Proposed docstring text:

```text
asset_dir : str, Path, or None
    A folder of frontend files for the component, like a bundler's build
    output. A relative path is resolved against the folder of the Python file
    that calls ``component()``. If this is ``None`` (default), the component
    uses the ``asset_dir`` declared in its package's ``pyproject.toml``, if
    any.

    Streamlit serves every file in this folder except hidden files and
    folders (names starting with ``.``). It can't contain the app's script or
    a ``.streamlit`` folder. You can't pass ``asset_dir`` for a component
    whose package already declares one.
```

### Examples

The simplest case: a folder of hand-written files next to the script.

```python
# streamlit_app.py
# frontend/index.js
# frontend/style.css
import streamlit as st

hello = st.components.v2.component(
    "hello", js="index.js", css="style.css", asset_dir="frontend"
)
hello()
```

A bundler's output folder, with a hashed entry file picked by glob. Chunks, fonts and images
that the entry imports by relative URL load from the same folder.

```python
dashboard = st.components.v2.component(
    "dashboard",
    js="assets/index-*.js",
    css="assets/index-*.css",
    asset_dir="frontend/dist",
)
```

A component defined in a module that several pages import. `asset_dir` resolves against
`components/chart.py`, so every page gets the same folder.

```python
# components/chart.py
# components/chart_frontend/index.js
import streamlit as st

chart = st.components.v2.component(
    "chart", js="index.js", asset_dir="chart_frontend"
)
```

A wrapper that builds components for its callers should pass an absolute path, because
`asset_dir` resolves against the wrapper's file, not its caller's:

```python
from pathlib import Path

FRONTEND = Path(__file__).parent / "frontend"
widget = st.components.v2.component("widget", js="index.js", asset_dir=FRONTEND)
```

### Behavior

#### Where the folder is resolved

- A relative `asset_dir` resolves against the folder of the file that calls `component()`.
  This matches the Python idiom `Path(__file__).parent / "frontend"` and how
  `AppTest.from_file` resolves relative script paths. It works the same for the main script,
  for pages in a multipage app, and for imported modules.
- When the caller isn't a file, for example in a notebook or `python -c`, a relative path
  resolves against the working directory.
- An absolute path is used as is. Symlinks are followed, and the checks below apply to the
  real folder.

The [tech spec](./tech-spec.md#resolution-base) weighs this against the main script's folder
and the working directory.

#### What is served

Files are served from `/_stcore/bidi-components/<name>/<path>`, the route packaged components
already use, with its existing protection against path traversal and symlinks that leave the
folder. On top of that, for a script-relative `asset_dir`:

- **Hidden files and folders are never served.** A request with any path segment starting
  with `.` returns 404, and `js=` or `css=` pointing at one is an error. This keeps `.env`,
  `.git` and `.streamlit` private even when they sit inside the folder.
- **There is no file-type allow-list.** Bundler output legitimately includes `.js`, `.mjs`,
  `.css`, `.map`, `.json`, `.wasm`, fonts and images, and an allow-list would break those in
  confusing ways. The docstring states plainly that every other file is public.

#### Errors

`component()` raises a `StreamlitAPIException` that says what's wrong and how to fix it when:

| Condition | Why |
|---|---|
| `asset_dir` isn't a `str` or `Path` | Type error, as for the other parameters |
| The resolved path isn't an existing folder | Fail fast instead of a 404 in the browser |
| The folder contains the calling file, the main script, or the working directory (so `.`, `..`, `/` and the home folder are rejected) | Every file would be public, including app code and anything else in the project |
| The folder directly contains a `.streamlit` folder | A sign that it is an app folder, not an asset folder |
| The component's package already declares an `asset_dir` | See [Conflicts](#conflicts) |
| A path or glob in `js=` or `css=` doesn't resolve to exactly one file in the folder | Unchanged from packaged components |

The existing `component-missing-asset-dir` error, raised when `js=` or `css=` is a path but
the component has no `asset_dir`, changes to suggest passing `asset_dir` as well as declaring
it in `pyproject.toml`.

#### Conflicts

- **The package already declares `asset_dir`.** Passing `asset_dir` for a component whose
  package's `pyproject.toml` declares one raises an error that tells the author to remove the
  argument. Script-relative components usually have bare names, while packaged ones are
  named `<project>.<component>`, so this only happens if an author reuses a package's name on
  purpose.
- **The same name is registered again with a different folder.** The last call wins. This is
  the existing rule for component names, and it keeps editing `asset_dir` in a running app
  working. When the new definition differs from the previous one, Streamlit logs the
  existing "already registered" warning.
- **The same name is registered again without `asset_dir`.** The component no longer has a
  folder, so its files stop being served.
- **Two components share a folder.** That's allowed. Each is served under its own name.

#### Development reload

Editing a file under `asset_dir` behaves like editing the script: with `runOnSave` the app
reruns, otherwise the "Source file changed" prompt appears. A rerun loads a changed entry
file (`js=`) and stylesheet (`css=`) without reloading the browser tab, because their URLs
carry a version that changes with the file. Chunks imported by
the entry with an unchanged name stay cached by the browser until the tab reloads, so
bundler output with hashed file names gives the most reliable reload. Watching follows
`server.fileWatcherType`, so `none` turns it off.

The same applies to packaged components' `asset_dir`, which Streamlit already watches but
doesn't currently tell open sessions about.

#### Bundlers

Pointing `asset_dir` at a bundler's output folder works without Streamlit knowing which
bundler built it, as long as the output uses relative URLs. Vite's default `base: "/"`
writes absolute URLs that miss the component route, so builds need `base: "./"`. The docs
should say this with a minimal `vite.config` example, and show using
`new URL("./logo.png", import.meta.url)` to reference other files from JavaScript.

Reading the entry file and CSS from the bundler's manifest is
[out of scope](#out-of-scope-future-work); a glob like `assets/index-*.js` already handles
hashed names.

#### Testing with `AppTest`

`AppTest` renders components defined with a script-relative `asset_dir`, including
components defined in modules imported before the test runs. Tests can assert on the
resolved asset paths. `AppTest` doesn't serve HTTP or watch files. With
`AppTest.from_string` and `AppTest.from_function` the script runs from a temporary file, so
a relative `asset_dir` in that script resolves inside a temporary folder. Use an absolute
path there.

#### Platforms

| Platform | Behavior |
|---|---|
| Local, Community Cloud | Works. The folder is deployed with the app. |
| Multi-replica deployments | Works without session affinity, because the files exist on every replica. |
| Streamlit in Snowflake, container runtime | Expected to work. Snowflake documents CCv2 with `asset_dir` as supported, and a script-relative folder is just files in the app, which avoids installing a private package from Snowflake's PyPI mirror. Needs a manual check before release. |
| Streamlit in Snowflake, warehouse runtime | CCv2 isn't supported there, so this changes nothing. |
| Embedded apps | Same origin and CORS handling as packaged component assets. |

### Docstring changes

- Replace the paragraph that ties `asset_dir` to installed packages with one that names both
  ways to get one: the `asset_dir` parameter, or the package's `pyproject.toml`.
- In the `.. important::` block, drop "as declared in the component manifest. This is only
  possible for installed components."
- Narrow "paths and globs must be provided as strings and not `Path` objects" to `html`,
  `css` and `js`. `asset_dir` accepts `str` or `Path`.
- Add the `asset_dir` parameter as above.
- The `html` bullet says HTML can be a path to a file in `asset_dir`, but only `css` and
  `js` paths are resolved today. The same edit should remove that bullet, since this feature
  would make the claim more visible.

## Out of scope (future work)

- **Reading the entry from a bundler manifest**, so `js=` and `css=` become optional. It
  needs a choice of manifest formats (Vite, esbuild and webpack differ), and globs cover the
  common case. Revisit if authors find globs awkward.
- **Running the previous module's cleanup when a component's JS changes.** A reloaded entry
  file runs in the same `parentElement` without the old module being told to stop. This
  predates the feature and also affects inline JS.
- **`Path` objects for `html`, `css` and `js`.**
- **Fonts in shadow roots.** `@font-face` inside a component's shadow root is ignored by
  browsers. That's separate from how files are served.

## Related work

- **Serving inline JS by content hash** (in progress, separate PR). Inline JS would no longer
  be resent on every rerun or need `blob:` scripts. The two features are complementary:
  inline-by-hash helps single-file components with no change to app code, and `asset_dir`
  adds multiple files and a build workflow. They don't share code. Inline-by-hash is held
  in server memory, while `asset_dir` files exist on every replica.
- **Cache validators for component assets** (in progress, separate PR). Component files are
  served with `Cache-Control: public` and no `ETag` or `Last-Modified`, so a reload
  downloads them again. That PR fixes this for packaged and script-relative folders alike,
  so this spec doesn't specify it.
- **[#15484](https://github.com/streamlit/streamlit/issues/15484)** (`AppTest` discovery of
  installed CCv2 components). A script-relative folder needs no discovery, so it sidesteps
  that issue for app-local components.

## Checklist

| Item | ✅ or comment |
|---|---|
| Works on SiS, Cloud, etc? | ✅ Local, Cloud and multi-replica. SiS container runtime expected, with a manual check before release. SiS warehouse runtime doesn't support CCv2. |
| No breaking API changes | ✅ New optional keyword-only parameter. Existing components are unaffected, apart from now getting a rerun prompt when packaged asset files change. |
| No new dependencies | ✅ |
| Metrics collected | `component()` isn't tracked today, only mounts are. Add `gather_metrics` to `component()` so that use of `asset_dir` shows up in argument metadata. |
| Any security/legal impact? | Yes. App authors choose a folder to make public. Mitigated by refusing hidden files, folders that contain the app or working directory, and `.streamlit` folders. The [tech spec](./tech-spec.md#validation-and-security) has the full rules. |
| Any docs changes needed? | ✅ The `component()` docstring, plus a docs page section on serving a build folder (Vite `base: "./"`, globs for hashed names, absolute paths in wrappers). |
