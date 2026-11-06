---
author: sfc-gh-lwilby-1
created: 2026-10-23
---

# Script-relative `asset_dir` for custom components v2: tech spec

## Summary

This spec describes how `st.components.v2.component(..., asset_dir=...)` resolves, validates,
stores, serves and watches a folder of component files that isn't part of an installed
package. The user-facing behavior is in the [product spec](./product-spec.md). This document
covers the implementation and weighs the alternatives for each open design question.

Most of the machinery already exists for packaged components: path and glob resolution
inside a root, the serving route, and the file watcher. The feature adds a second source of
asset roots, the `component()` call. Everything downstream should treat that root like a
manifest root, except for a few extra safety rules.

An unpublished local prototype of the parameter produced the measurements in the product
spec. This spec keeps the prototype's resolution and validation rules. It changes where the
root is stored, and adds what the prototype lacks: hidden-file refusal, file watching, and
reload on change.

## How asset roots work today

All paths are under `lib/streamlit/components/v2/` unless noted.

1. **Discovery.** At runtime start, `BidiComponentManager.discover_and_register_components`
   calls `manifest_scanner.scan_component_manifests()`, which reads
   `[[tool.streamlit.component.components]]` from installed distributions. For each
   component, `ComponentManifestHandler.process_manifest` stores
   `asset_roots["<project>.<component>"]`, and the registry gets a name-only placeholder.
2. **Definition.** `component()` calls `build_definition_with_validation`
   (`component_definition_resolver.py`). It fetches the root with
   `manager.get_component_asset_root(name)`, which only asks the manifest handler. Then it
   classifies `css` and `js` as inline or path-like, and resolves path-like values strictly
   inside the root. The result is a `BidiComponentDefinition` with absolute file paths and
   root-relative URLs (`js_url`, `css_url`).
3. **Serving.** `create_bidi_component_routes` (`web/server/starlette/starlette_routes.py`)
   serves `/_stcore/bidi-components/<name>/<path>`. It requires a registered definition and
   `manager.get_component_path(name)`, and joins the path with `build_safe_abspath`
   (`web/server/component_file_utils.py`). That function rejects unsafe patterns and any
   real path outside the real root, so symlinks can't escape. It does not refuse hidden
   files.
4. **Watching.** `start_file_watching` hands the manifest roots to `ComponentFileWatcher`
   once, at startup. On a change, `_on_components_changed` rebuilds the definition from the
   recorded `css` and `js` inputs and calls `registry.update_component`. Nothing tells
   sessions, so the app doesn't rerun.
5. **Loading.** The frontend loads file-backed JS with a module script and `import(url)`
   (`frontend/lib/src/components/widgets/BidiComponent/hooks/useHandleJsContent.ts`). The
   browser keeps one module per URL per document, so a rerun with the same `js_source_path`
   reuses the old module even if the file changed.
6. **Import outside a runtime.** `get_bidi_component_manager()` returns a new, empty manager
   when no runtime exists, for example when a module is imported before `AppTest` starts.
   At mount, `_ensure_component_on_active_runtime` (`__init__.py`) registers the captured
   inputs on the runtime's manager through `ensure_definition_if_missing_or_placeholder`.
   The empty manager has never scanned manifests.

## Design decisions

Each decision has a recommendation, followed by the alternatives that were weighed.

### Resolution base

**Recommended: the folder of the file that calls `component()`**, taken from
`inspect.currentframe().f_back.f_code.co_filename`. If that isn't an existing file
(`<stdin>`, `<string>`, a notebook cell), fall back to the working directory. Absolute paths
are used as is. The root is then `Path.resolve()`d, so symlinks are followed before any
check.

This works the same wherever a component is defined:

- **Main script.** Streamlit compiles the script with its real path, so `co_filename` is the
  script.
- **Pages in a multipage app.** A page in `pages/` resolves against `pages/`, just as the page
  would with `Path(__file__).parent`.
- **Imported modules.** A module in `components/` resolves against `components/`, whichever
  page imports it.

The precedents point the same way. `AppTest.from_file` resolves a relative script path
against its caller's file, and the `Path(__file__).parent` idiom is what authors already
write.

The known limitation is wrappers: a helper that calls `component()` on behalf of its caller
resolves against the helper's file. The docstring and docs tell wrapper authors to pass an
absolute path. A `stacklevel`-style parameter would fix it but adds an API for a rare case.

Alternatives:

- **The main script's folder.** Predictable for single-file apps, but a component defined in
  an imported module would resolve against whichever app imports it. That breaks reusing a
  module across apps or across pages in other folders. It's also unknown at import time
  outside a runtime.
- **The working directory.** This is what v1's `declare_component(path=...)` does in
  practice (`os.path.abspath`), and v1's docstring asks for absolute paths because of it.
  It changes with where `streamlit run` is launched, which differs between local runs, CI
  and hosting platforms.

### Where the root is stored

**Recommended: on the definition.** Add a field `local_asset_root: Path | None` to
`BidiComponentDefinition`. "Local" means the root came from app code rather than a package
manifest. `build_definition_with_validation` takes an `asset_root` argument for it, and
`get_component_asset_root` / `get_component_path` return the manifest root if there is one,
otherwise the registered definition's `local_asset_root`.

This makes the conflict rules fall out of existing behavior:

- Registering the same name with a different folder produces a different definition, so the
  registry's existing "already registered" warning fires. Reruns with the same arguments
  produce an equal definition and stay quiet.
- Registering without `asset_dir` clears the root, because the new definition has none.
- The root and the paths resolved against it change together, under the registry lock.
- `ensure_definition_if_missing_or_placeholder` carries the root to the runtime's manager
  along with `css` and `js`.
- The watcher's re-resolution reads the root from the existing definition, as it already
  does for `html`.

Alternative: **a separate `name -> root` map on the manager**, which is what the prototype
does (`set_local_asset_root`). It works, but the root and the definition are updated in two
steps. The prototype also needs explicit code to clear the root on re-registration and to
copy it at mount, and differing folders don't trigger the duplicate-name warning.

### Validation and security

Every non-hidden file in the folder becomes publicly readable by anyone who can load the app.
The rules below target the realistic mistakes: pointing `asset_dir` at the app folder, the
project root, or a frontend project root that holds `.env` next to `dist/`.

**At registration**, raise `StreamlitAPIException` with a fix in the message if:

1. `asset_dir` isn't `str` or `Path` (`StreamlitInvalidParameterTypeError`).
2. The resolved root isn't an existing directory.
3. The root is the calling file's folder or one of its ancestors.
4. The root is the working directory or one of its ancestors. This rejects `/`, the home
   folder and the project root regardless of where the component is defined.
5. When a script run context exists, the root is the main script's folder
   (`ctx.main_script_parent`) or one of its ancestors. This covers a module in a subfolder
   that passes `asset_dir=".."`.
6. The root directly contains `.streamlit`. Rule 8 would hide its contents anyway, but its
   presence means the folder is an app folder, so failing early gives a clearer message.
7. A `js=` or `css=` path or glob resolves to a file under a hidden segment.

Rules 3 to 6 are cheap path comparisons and one `stat`. They need no directory scan, which
matters because a mistaken root may contain `node_modules`.

**At serving**, for components whose root is a `local_asset_root`:

8. Return 404 for any request path with a segment that starts with `.`. This keeps `.env`,
   `.git/`, `.streamlit/`, `.npmrc` and similar private wherever they sit in the folder.
   Vite's optional `.vite/manifest.json` is also not served, and browsers never need it.

Unchanged, and covered by tests for local roots:

- `build_safe_abspath` rejects traversal and any real path outside the real root, so a
  symlink inside the folder that points elsewhere isn't served. Glob resolution and
  `ensure_within_root` apply the same rule to `js=` and `css=`.
- A root that is itself a symlink is checked and served as its target.

Alternatives:

- **An extension allow-list** (for example `.js`, `.mjs`, `.css`, `.map`, `.json`, `.wasm`,
  fonts, images). Rejected. Bundler output varies, so a missing type would show up as a 404
  for a font or a WASM file. It would also need upkeep, and would differ from packaged roots,
  which have no list. The rules above already cover where secrets conventionally live.
- **A warning when the folder contains suspicious files** (`.env`, `*.pem`, `*.py`). It needs
  a recursive scan on registration, which `component()` does on every rerun. Rule 8 already
  makes the most common case harmless.
- **Refusing `.py` files.** Rules 3 to 5 already keep the app's own code out. A
  Python-file rule would give false assurance about other kinds of files.
- **Applying rule 8 to packaged roots too.** It would be simpler, and packages rarely ship
  hidden files. It's kept out because it changes what existing packages serve, and package
  contents are already curated by package-data rules. It can follow separately if wanted.

v1 components serve any `declare_component(path=...)` folder with none of these checks. That
isn't a reason to be as permissive here.

### Conflicts

**Recommended: raise if the component's package declares an `asset_dir`, and otherwise let
the last registration win.**

- **Manifest root plus `asset_dir`.** Raise. Alternatives: let the argument override the
  manifest, which would hide which files a packaged component serves and break the package's
  contract (an editable install already covers local development of a package). Or silently
  prefer the manifest, which would make the argument a no-op that looks like it worked. A
  manifest entry without `asset_dir` doesn't conflict.
- **The import-time gap.** The empty manager used outside a runtime has no manifest data, so
  this check can only run once the definition reaches the runtime's manager. The check
  therefore belongs in the shared path both reach: `build_definition_with_validation`, given
  the manager it registers on. The prototype skips setting the root at mount in this case
  instead of raising. That should become the same error.
- **Same name, different folder.** The last call wins and the existing warning is logged,
  through the definition change above. Raising was considered and rejected: editing
  `asset_dir` in a running app re-registers the name with a new folder in the same process,
  and that must keep working.
- **Several names, one folder.** Allowed. `ComponentFileWatcher` already groups names by
  directory.

### Registration outside a runtime and `AppTest`

A component defined outside a running runtime, for example in a module imported before
`AppTest` starts, registers on a throwaway manager (see step 6 of
[How asset roots work today](#how-asset-roots-work-today)). With the root stored on the
definition:

- `component()` resolves and validates the root against the calling file, then builds the
  definition on whichever manager `get_bidi_component_manager()` returns.
- The mount callable captures the resolved root next to `html`, `css` and `js`, and passes it
  to `_ensure_component_on_active_runtime` and
  `ensure_definition_if_missing_or_placeholder`. That call runs the shared validation on the
  runtime's manager, including the manifest conflict check and the main-script rule.
- `AppTest` creates its manager with `start_file_watching=False`. The lazy watching below
  must respect that, so tests never start file watchers.
- `AppTest.from_string` and `from_function` write the script into a temporary folder, so a
  relative `asset_dir` in that script resolves there. That's expected given the resolution
  rule. The product spec documents using an absolute path.

### File watching and reload

**Recommended: watch local roots once they are registered, tell sessions when any watched
root changes, and put a version token in file-backed asset URLs so a rerun loads the
change.**

1. **Watch.** `BidiComponentManager` remembers whether watching is enabled, which is true
   only after the runtime calls `start_file_watching`. When a definition with a
   `local_asset_root` is registered and that root isn't watched yet, the manager restarts
   `ComponentFileWatcher` with the manifest roots plus every local root.
   `start_file_watching` is already idempotent, and this happens once per new folder, not
   per rerun. `server.fileWatcherType = "none"` keeps the existing no-op behavior. Watchers
   for a folder that a later registration dropped stay until the process exits. Their
   callback re-resolves nothing, so that's harmless.
2. **Notify.** After `_on_components_changed` updates definitions, the manager sends a
   `blinker.Signal`, `asset_change_listener`. `AppSession.register_file_watchers` connects
   to it the same way it connects to `secrets_singleton.file_change_listener`, and calls
   `_on_source_file_changed()`. That gives the standard behavior: a rerun with `runOnSave`,
   otherwise the "Source file changed" prompt. This also applies to manifest roots, which
   are already watched but never notify. That's a small, intended improvement for authors
   developing a package with an editable install.
3. **Version token.** Without it, step 2 is half a fix: a rerun keeps the same `js_url`, the
   frontend's effect doesn't run again, and the browser reuses the cached module. Resolution
   already finds each file. It also records `st_mtime_ns` and `st_size` (one `stat`, no read)
   on the definition, and the proto sets `js_source_path` / `css_source_path` to
   `<url>?v=<token>`. `buildHttpUri` keeps the query string, and the route ignores it, so
   there is no proto or frontend change. The token fields use `field(compare=False)`, so an
   edited file doesn't make the next `register()` log the duplicate-name warning when
   watching is off. Chunks imported by the entry don't get the token. Hashed chunk names
   handle that, and otherwise a tab reload does.

Steps 1 and 2 can ship without step 3, but then only bundles with hashed entry names reload
on rerun. Step 3 applies to packaged components too, because they share the code path. It
also means a package upgrade changes the URL of any file whose size or mtime changed.

Alternatives:

- **Add the folder to each session's `LocalSourcesWatcher`**, as `server.folderWatchList`
  does. This reuses an existing per-session path, but duplicates watchers per session,
  needs the root passed into every session, and leaves the registry stale (globs not
  re-resolved). The manager already watches roots, so it's the natural owner.
- **Tell authors to add the folder to `server.folderWatchList`.** That's the workaround
  today. It needs an absolute path in config, and doesn't re-resolve globs.
- **A full page reload on asset change.** There's no such server-to-browser message, and it
  would drop session state.
- **No watching (the prototype).** Edits need a manual rerun and, for stable file names, a
  tab reload. That's a poor fit for the build-watch workflow this feature targets.

### Bundler manifests

**Recommended: out of scope for now.** `js="assets/index-*.js"` already handles hashed entry
names, and code-split chunks, fonts and images load by relative URL once the build uses a
relative base (Vite `base: "./"`). Reading a manifest needs a choice between formats (Vite's
`.vite/manifest.json`, esbuild's metafile, webpack's asset manifest), and probably a new
parameter or naming convention to opt in. That's API surface better added once authors ask
for it. Nothing here blocks it later: the server can read a manifest directly even though
rule 8 keeps `.vite/` from being served.

### Docstring changes

As listed in the [product spec](./product-spec.md#docstring-changes), plus the internal
docstrings that describe roots as manifest-only:

- `build_definition_with_validation` (Raises, Notes);
- `get_component_asset_root` and `get_component_path`;
- the lifecycle notes on `BidiComponentManager`.

The `component-missing-asset-dir` message mentions both ways to get a root.

## Relation to other work

- **Inline JS served by content hash** (a separate change in progress). Inline JS would be
  stored in server memory and served from the same route by a content-addressed URL, so it
  isn't resent on every rerun and needs no `blob:` script. It touches the same proto field
  (`js_source_path`) and route as this feature. The only interaction is in `bidi_component/main.py`: inline JS gets a
  content-addressed URL, and file-backed JS gets `js_url` plus the version token. Whichever
  lands second rebases onto the other. Neither depends on the other.
- **Cache validators for component assets** (a separate change in progress). Component
  files are served with `Cache-Control: public` and no validator, so a reload downloads
  them again. That change adds `ETag` and `Last-Modified` and decides `Cache-Control` for
  the same route. The
  version token here is about the browser's module cache within a page, not HTTP caching, so
  the two are complementary. Whatever `Cache-Control` that work picks applies to local roots
  unchanged.

## Implementation plan

Steps 1–6 are one PR. Step 7 can be a follow-up PR if the first one gets large.

1. **Root on the definition.** `component_registry.py`: add
   `local_asset_root: Path | None = None` to `BidiComponentDefinition`.
   `component_manager.py`: `get_component_asset_root` and `get_component_path` fall back to
   the registered definition's root. Add a `has_manifest_asset_root(name)` helper.
   `ensure_definition_if_missing_or_placeholder` and `_recompute_definition_from_api` carry
   the root through.
2. **Resolution and validation.** `__init__.py`: add the `asset_dir` parameter, capture the
   caller frame in `component()`, and resolve the root with rules 1–3. Pass the root through
   `_create_component_callable`, `_register_component` and
   `_ensure_component_on_active_runtime`. `component_definition_resolver.py`: accept
   `asset_root`, run rules 4–7 and the manifest conflict check, and update the missing-root
   message.
3. **Serving.** `starlette_routes.py`: in `_bidi_component_endpoint`, return 404 for hidden
   segments when the component's root is local. Expose this through a manager method rather
   than reading the definition in the route.
4. **Watching and notification.** `component_manager.py` and `component_file_watcher.py`:
   record whether watching is enabled, restart with merged roots when a new local root
   appears, and send `asset_change_listener` after updates. `runtime/app_session.py`:
   connect and disconnect the signal next to the secrets listener.
5. **Docstrings.** As above.
6. **Tests.**
   - `lib/tests/streamlit/components/v2/test_component_api_paths.py`:
     - resolution against the calling file and the working-directory fallback;
     - absolute `Path` input and a symlinked root;
     - each rejection rule, including `..` from a module in a subfolder (rule 5) and a
       hidden `js=` path (rule 7);
     - manifest conflict, last-registration-wins with the warning, and clearing on
       re-registration without `asset_dir`.

     The prototype's tests are a base for most of these.
   - `lib/tests/streamlit/testing/imported_v2_component_test.py`: a module with a
     script-relative `asset_dir` imported before `AppTest` runs. The proto has file-backed
     paths and the runtime's manager serves the root (the prototype has this test). Also: a
     manifest conflict that is only detected at mount raises.
   - `lib/tests/streamlit/web/server/starlette/starlette_routes_test.py`:
     - files under a local root are served;
     - `.env`, `.git/config` and `sub/.hidden/x.js` return 404;
     - traversal and outward symlinks are still rejected;
     - hidden files under a manifest root are unchanged.
   - Manager and watcher tests: a local root starts a watcher only when watching is
     enabled, never under `AppTest`; a change updates the definition and sends the signal.
     `app_session_test.py`: the signal leads to a rerun with `runOnSave`, and to a
     file-change message without it.
   - Type test: `lib/tests/streamlit/typing/` covers `asset_dir` as `str` and `Path`.
   - E2E: `e2e_playwright/bidi_components/` gets an app whose component loads `js=` and
     `css=` from a script-relative folder with a relative import, plus a test that it renders
     and reacts to interaction. CCv2 has no file-backed E2E coverage today because it needed
     an installed package. Run the `assessing-external-test-risk` skill, since this adds
     served files on an existing route.
7. **Version token.** `component_definition_resolver.py` and `component_registry.py`:
   record the stat-based token with `compare=False`. `bidi_component/main.py`: append
   `?v=<token>` to file-backed `js_source_path` and `css_source_path`. Tests:
   - the token changes when the file changes;
   - re-registering after an edit doesn't log the duplicate warning;
   - the route serves a URL with the query;
   - an E2E or manual check that a rerun after an edit runs the new code without a tab
     reload.
8. **Manual checks before release.**
   - Deploy a Vite app (`base: "./"`, code-split chunk, font) to Community Cloud and to the
     SiS container runtime. Confirm it renders and that hidden files return 404 there.
   - Check that a build-watch loop (`vite build --watch`) reruns the app on each build.
