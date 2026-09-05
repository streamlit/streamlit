/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { Plugin } from "vite"

/**
 * KaTeX's own stylesheet, minified or not. Deliberately does not match the
 * `katex-swap` variants, which we never import.
 */
const KATEX_STYLESHEET_PATH = /[\\/]katex[\\/]dist[\\/]katex(\.min)?\.css$/

/**
 * Coarse prefilter for the transform hook so Rolldown does not call into JS for
 * every module in the graph. Unanchored, because ids arrive with query markers.
 * Drift against KATEX_STYLESHEET_PATH is safe both ways: too tight and `buildEnd`
 * fails the build, too loose and the handler's own check rejects the id.
 */
const KATEX_STYLESHEET_FILTER = /[\\/]katex[\\/]dist[\\/]katex(\.min)?\.css/

/**
 * Ids Vite keeps out of the CSS pipeline, mirroring its own `SPECIAL_QUERY_RE`,
 * which is the `exclude` filter on `vite:css`, `vite:css-post` and
 * `vite:css-analysis`. Those imports hand back the module's contents or URL and
 * emit no font files, so rewriting them would alter a string someone is reading
 * without saving anything.
 *
 * This has to match Vite exactly: anything Vite CSS-processes but we skip emits
 * the fonts we are trying to drop. Note `inline` is deliberately absent — an
 * `?inline` stylesheet still runs through `compileCSS`, which resolves its
 * `url()`s into emitted assets, so it belongs to us.
 */
const NON_CSS_PIPELINE_QUERY = /[?&](?:worker|sharedworker|raw|url)\b/

/** A woff or ttf entry in a `src` list, including its leading comma. */
const NON_WOFF2_SRC =
  /,\s*url\([^)]*\.(?:woff|ttf)\)\s*format\("(?:woff|truetype)"\)/g

/** A whole `src` declaration -- the only place a font file is referenced. */
const SRC_DECLARATION = /src:[^;}]*/g

/**
 * Any surviving woff or ttf reference. Deliberately looser than NON_WOFF2_SRC: if
 * KaTeX starts quoting its urls or appending query strings, the strip stops
 * matching, and a guard sharing that assumption would go quiet with it. `\b` keeps
 * `.woff2` from matching, since `2` is a word character -- but it would match a
 * name like `Foo.ttf.woff2`, so this is applied per `src` declaration rather than
 * to the whole stylesheet.
 */
const SURVIVING_NON_WOFF2 = /\.(?:woff|ttf)\b/

/**
 * Emits only woff2 for KaTeX's fonts.
 *
 * KaTeX declares every font face with woff2, woff and ttf sources. Browsers
 * download the first format they support, and every browser that can run our
 * ES-module bundle supports woff2, so the woff and ttf files are emitted into
 * the build and never requested. Stripping them before Vite resolves the
 * stylesheet's assets keeps those urls from becoming files at all. Only `src`
 * declarations change; faces, weights and `font-display` are untouched.
 *
 * `frontend/lib` imports the stylesheet twice -- statically in
 * `StreamlitMarkdown/Heading.tsx` and as a prefetch in `StreamlitMarkdown/utils.ts`
 * -- and only `frontend/app/build/` is rsynced into `lib/streamlit/static/`, so
 * this is the build whose font output ships.
 */
export const katexWoff2Only = (): Plugin => {
  let sawStylesheet = false
  let isBuild = false

  return {
    name: "streamlit-katex-woff2-only",
    // Must run before Vite turns the stylesheet's urls into emitted assets. Under
    // `post` the urls are already `__VITE_ASSET__` placeholders, the strip would
    // match nothing, and every check below would pass while the fonts came back.
    enforce: "pre",

    configResolved(config) {
      isBuild = config.command === "build"
    },

    buildStart() {
      // Reset per build, so a watch-mode rebuild must see the stylesheet again
      // rather than trusting an earlier pass.
      sawStylesheet = false
    },

    transform: {
      filter: { id: KATEX_STYLESHEET_FILTER },

      handler(code, id) {
        // Vite appends markers such as `?direct` to stylesheet ids.
        const [path] = id.split("?")
        if (!KATEX_STYLESHEET_PATH.test(path)) {
          return null
        }
        if (NON_CSS_PIPELINE_QUERY.test(id)) {
          return null
        }

        sawStylesheet = true
        const woff2Only = code.replace(NON_WOFF2_SRC, "")

        const srcDeclarations = woff2Only.match(SRC_DECLARATION) ?? []
        if (srcDeclarations.some(src => SURVIVING_NON_WOFF2.test(src))) {
          // Fail loudly: returning quietly would put ~600 KiB of fonts nothing
          // fetches back into the wheel, with nothing else to notice. Reaching
          // here means KaTeX reformatted its `src` declarations and
          // NON_WOFF2_SRC needs updating to match.
          this.error(
            "KaTeX's stylesheet still references woff or ttf fonts after " +
              "stripping. Its `src` format changed -- update NON_WOFF2_SRC."
          )
        }

        return woff2Only === code ? null : { code: woff2Only, map: null }
      },
    },

    buildEnd(error) {
      // Fail if the stylesheet never reached us; a path or id change, or nothing
      // importing it any more, would otherwise restore the fonts with a green
      // build. Stay quiet when:
      // - the build already failed (do not mask that error)
      // - this is `serve` (nothing is emitted)
      //
      // These hooks are per-environment. Today's app build resolves one client
      // environment; a second one would need this narrowed to it, because that
      // environment's buildStart would clear the flag.
      if (!error && isBuild && !sawStylesheet) {
        this.error(
          "Could not verify that KaTeX's woff and ttf fonts were stripped: its " +
            "stylesheet never reached this plugin. Either nothing imports it any " +
            "more, or KATEX_STYLESHEET_PATH no longer matches the id Vite gives " +
            "katex/dist/katex.min.css."
        )
      }
    },
  }
}
