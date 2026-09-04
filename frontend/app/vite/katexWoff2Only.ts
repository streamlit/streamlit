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
 * Vite suffixes that ask for the file's contents rather than routing it through
 * the CSS asset pipeline. Those imports emit no font files, so rewriting them
 * would change a string someone is reading without saving anything.
 */
const NON_CSS_PIPELINE_QUERY = /[?&](raw|url|inline)\b/

/** A woff or ttf entry in a `src` list, including its leading comma. */
const NON_WOFF2_SRC =
  /,\s*url\([^)]*\.(?:woff|ttf)\)\s*format\("(?:woff|truetype)"\)/g

/**
 * Any surviving woff or ttf reference. `.woff2)` cannot match, because the
 * character after `woff` must be `)`.
 */
const SURVIVING_NON_WOFF2 = /url\([^)]*\.(?:woff|ttf)\)/

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
 * Only `frontend/app/build/` is rsynced into `lib/streamlit/static/`, so this is
 * the build whose font output actually ships.
 */
export const katexWoff2Only = (): Plugin => ({
  name: "streamlit-katex-woff2-only",
  // Must run before Vite turns the stylesheet's urls into emitted assets.
  enforce: "pre",

  transform(code, id) {
    if (NON_CSS_PIPELINE_QUERY.test(id)) {
      return null
    }
    // Vite appends markers like `?used` and `?direct` to stylesheet ids.
    const [path] = id.split("?")
    if (!KATEX_STYLESHEET_PATH.test(path)) {
      return null
    }

    const woff2Only = code.replace(NON_WOFF2_SRC, "")

    if (SURVIVING_NON_WOFF2.test(woff2Only)) {
      // KaTeX changed how it writes `src` declarations, so NON_WOFF2_SRC no
      // longer matches them. Failing the build is the point: returning quietly
      // would put ~600 KiB of fonts nothing fetches back into the wheel, and
      // nothing else would notice.
      this.error(
        "streamlit-katex-woff2-only: KaTeX's stylesheet still references woff " +
          "or ttf fonts after stripping. Its `src` format changed -- update " +
          "NON_WOFF2_SRC to match."
      )
    }

    return woff2Only === code ? null : woff2Only
  },
})
