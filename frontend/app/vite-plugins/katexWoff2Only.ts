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
 * Ids Vite keeps out of the CSS pipeline, mirroring its own `SPECIAL_QUERY_RE`,
 * which is the `exclude` filter on `vite:css`, `vite:css-post` and
 * `vite:css-analysis`. Those imports hand back the module's contents or URL and
 * emit no font files, so rewriting them would alter a string someone is reading
 * without saving anything.
 *
 * This has to match Vite exactly: anything Vite CSS-processes but we skip emits
 * the fonts we are trying to drop. Note `inline` is deliberately absent -- an
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
 * matching, and a check sharing that assumption would go quiet with it. `\b` keeps
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
 * ES-module bundle supports woff2, so the woff and ttf files are emitted into the
 * build and never requested. Stripping them before Vite resolves the stylesheet's
 * assets keeps those urls from becoming files at all. Only `src` declarations
 * change; faces, weights and `font-display` are untouched.
 *
 * `frontend/lib` imports the stylesheet twice -- statically in
 * `StreamlitMarkdown/Heading.tsx` and as a prefetch in `StreamlitMarkdown/utils.ts`
 * -- and only `frontend/app/build/` is rsynced into `lib/streamlit/static/`, so
 * this is the build whose font output ships.
 *
 * If this plugin ever stops matching, the fonts simply come back: that is a ~600
 * KiB jump in total bundle size, which CI's bundle check flags at 0.5%. The one
 * assertion below exists to name the cause rather than to detect the regression.
 */
export const katexWoff2Only = (): Plugin => ({
  name: "streamlit-katex-woff2-only",
  // Must run before Vite turns the stylesheet's urls into emitted assets. Under
  // `post` the urls are already `__VITE_ASSET__` placeholders and the strip would
  // match nothing.
  enforce: "pre",

  transform(code, id) {
    // Vite appends markers such as `?direct` to stylesheet ids.
    const [path] = id.split("?")
    if (!KATEX_STYLESHEET_PATH.test(path)) {
      return null
    }
    if (NON_CSS_PIPELINE_QUERY.test(id)) {
      return null
    }

    const woff2Only = code.replace(NON_WOFF2_SRC, "")

    const srcDeclarations = woff2Only.match(SRC_DECLARATION) ?? []
    if (srcDeclarations.some(src => SURVIVING_NON_WOFF2.test(src))) {
      this.error(
        "KaTeX's stylesheet still references woff or ttf fonts after " +
          "stripping. Its `src` format changed -- update NON_WOFF2_SRC."
      )
    }

    return woff2Only === code ? null : { code: woff2Only, map: null }
  },
})
