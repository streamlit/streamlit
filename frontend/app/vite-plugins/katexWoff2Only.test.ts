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

import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"

import { katexWoff2Only } from "./katexWoff2Only"

/**
 * Reads the installed stylesheet so KaTeX reformatting its `src` declarations
 * fails here too, not only at build time. Walks the filesystem rather than
 * importing it, because `katex` is declared by `frontend/lib`; declaring it here
 * as well would create a second version range to keep in step with rehype-katex.
 * Anchored to this file rather than the working directory so it can only find the
 * copy Node and Vite would resolve.
 */
const readInstalledKatexCss = (): string => {
  let dir = import.meta.dirname
  for (;;) {
    const candidate = join(dir, "node_modules/katex/dist/katex.min.css")
    if (existsSync(candidate)) {
      return readFileSync(candidate, "utf8")
    }

    const parent = dirname(dir)
    if (parent === dir) {
      throw new Error("could not locate an installed katex.min.css")
    }
    dir = parent
  }
}

const INSTALLED_KATEX_CSS = readInstalledKatexCss()
const KATEX_ID = "/repo/frontend/node_modules/katex/dist/katex.min.css"

/** Narrow view of the hook, so the arguments the plugin reads stay typechecked. */
type TransformFn = (
  this: { error: (message: string) => never },
  code: string,
  id: string
) => { code: string } | string | null

/**
 * Runs the plugin's transform with a minimal plugin context, turning `this.error`
 * into a thrown error so tests can assert on it. Neither Vite nor Rolldown ships a
 * plugin-context harness; Vite's own tests do the same.
 */
const transform = (code: string, id: string): string | null => {
  const hook = katexWoff2Only().transform as unknown as TransformFn
  const result = hook.call(
    {
      error: (message: string) => {
        throw new Error(message)
      },
    },
    code,
    id
  )
  return typeof result === "object" && result !== null ? result.code : result
}

const count = (css: string, pattern: RegExp): number =>
  (css.match(pattern) ?? []).length

describe("katexWoff2Only", () => {
  it("runs before Vite rewrites the stylesheet's urls to asset placeholders", () => {
    // Under `enforce: "post"` the strip silently matches nothing.
    expect(katexWoff2Only().enforce).toBe("pre")
  })

  it("keeps every woff2 source and drops woff and ttf", () => {
    const css = transform(INSTALLED_KATEX_CSS, KATEX_ID)
    expect(css).not.toBeNull()

    const woff2Before = count(INSTALLED_KATEX_CSS, /url\([^)]*\.woff2\)/g)
    expect(woff2Before).toBeGreaterThan(0)

    expect(count(css as string, /url\([^)]*\.woff2\)/g)).toBe(woff2Before)
    expect(count(css as string, /\.woff\b/g)).toBe(0)
    expect(count(css as string, /\.ttf\b/g)).toBe(0)
  })

  it("changes nothing outside the src declarations", () => {
    const css = transform(INSTALLED_KATEX_CSS, KATEX_ID) as string

    for (const pattern of [/@font-face/g, /font-display:block/g, /\{/g]) {
      expect(count(css, pattern)).toBe(count(INSTALLED_KATEX_CSS, pattern))
    }
    const withoutSrc = (s: string): string =>
      s.replaceAll(/src:[^;}]*/g, "src:X")
    expect(withoutSrc(css)).toBe(withoutSrc(INSTALLED_KATEX_CSS))
  })

  it.each([
    [
      "a stylesheet from another package",
      "/repo/node_modules/other/style.css",
    ],
    [
      "the katex-swap variant we do not import",
      "/repo/node_modules/katex/dist/katex-swap.min.css",
    ],
    ["katex's JavaScript", "/repo/node_modules/katex/dist/katex.mjs"],
    // Vite's SPECIAL_QUERY_RE keeps these out of the CSS pipeline, so they hand
    // back contents or a URL and emit no fonts; their text must not be rewritten.
    ["a ?raw import of the stylesheet", `${KATEX_ID}?raw`],
    ["a ?url import of the stylesheet", `${KATEX_ID}?url`],
    ["?raw= with a value", `${KATEX_ID}?raw=value`],
    ["?url= with a value", `${KATEX_ID}?url=value`],
    ["a ?worker import", `${KATEX_ID}?worker`],
    ["raw anywhere in the query", `${KATEX_ID}?x=1&raw`],
  ])("ignores %s", (_label, id) => {
    expect(transform(INSTALLED_KATEX_CSS, id)).toBeNull()
  })

  it.each([
    ["the unminified stylesheet", "/repo/node_modules/katex/dist/katex.css"],
    ["Vite's ?direct marker", `${KATEX_ID}?direct`],
    ["an arbitrary query", `${KATEX_ID}?v=abc123`],
    // `inline` is absent from SPECIAL_QUERY_RE: an ?inline stylesheet still runs
    // through compileCSS, which turns its url()s into emitted font assets.
    ["an ?inline import", `${KATEX_ID}?inline`],
    ["?no-inline", `${KATEX_ID}?no-inline`],
  ])("transforms %s", (_label, id) => {
    expect(transform(INSTALLED_KATEX_CSS, id)).not.toBeNull()
  })

  it("returns null when the stylesheet is already woff2-only", () => {
    const css =
      '@font-face{font-family:KaTeX_AMS;src:url(fonts/a.woff2) format("woff2")}'
    expect(transform(css, KATEX_ID)).toBeNull()
  })

  it.each([
    [
      "single-quoted formats",
      "src:url(fonts/a.woff2) format('woff2'),url(fonts/a.woff) format('woff')",
    ],
    [
      "quoted urls",
      'src:url("fonts/a.woff2") format("woff2"),url("fonts/a.woff") format("woff")',
    ],
    [
      "version-suffixed urls",
      'src:url(fonts/a.woff2?v=1) format("woff2"),url(fonts/a.woff?v=1) format("woff")',
    ],
  ])("names the cause when KaTeX reformats src with %s", (_label, src) => {
    // The strip pattern stops matching for each of these. CI's bundle check would
    // catch the resulting size jump; this turns it into a message.
    expect(() => transform(`@font-face{${src}}`, KATEX_ID)).toThrow(
      /still references woff or ttf fonts/
    )
  })
})
