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
import { dirname, join, resolve } from "node:path"

import { katexWoff2Only } from "./katexWoff2Only"

/**
 * Reads the installed stylesheet so KaTeX reformatting its `src` declarations
 * fails here too, not only at build time. Deliberately walks the filesystem
 * instead of importing it: `katex` is declared by `frontend/lib`, and adding it
 * to this workspace would create a second version range to keep in step with
 * rehype-katex -- the duplication this plugin's sibling commit removes.
 */
const readInstalledKatexCss = (): string => {
  let dir = resolve(process.cwd())
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

/**
 * Runs the plugin's transform with a minimal Rollup plugin context, turning
 * `this.error` into a thrown error so tests can assert on it.
 */
const transform = (code: string, id: string): string | null => {
  const plugin = katexWoff2Only()
  const hook = plugin.transform
  if (typeof hook !== "function") {
    throw new TypeError("expected a transform function")
  }

  const context = {
    error: (message: string) => {
      throw new Error(message)
    },
  }
  return hook.call(context as never, code, id, {
    environment: {},
  } as never) as string | null
}

const count = (css: string, pattern: RegExp): number =>
  (css.match(pattern) ?? []).length

describe("katexWoff2Only", () => {
  it("keeps every woff2 source and drops woff and ttf", () => {
    const result = transform(INSTALLED_KATEX_CSS, KATEX_ID)
    expect(result).not.toBeNull()
    const css = result as string

    const woff2Before = count(INSTALLED_KATEX_CSS, /url\([^)]*\.woff2\)/g)
    expect(woff2Before).toBeGreaterThan(0)

    expect(count(css, /url\([^)]*\.woff2\)/g)).toBe(woff2Before)
    expect(count(css, /url\([^)]*\.woff\)/g)).toBe(0)
    expect(count(css, /url\([^)]*\.ttf\)/g)).toBe(0)
  })

  it("leaves faces, font-display and rule count untouched", () => {
    const css = transform(INSTALLED_KATEX_CSS, KATEX_ID) as string

    for (const pattern of [/@font-face/g, /font-display:block/g, /\{/g]) {
      expect(count(css, pattern)).toBe(count(INSTALLED_KATEX_CSS, pattern))
    }
    // Nothing outside a `src` declaration may change.
    const withoutSrc = (s: string): string => s.replace(/src:[^;}]*/g, "src:X")
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
    // These read the file's contents instead of emitting font assets, so there
    // is nothing to save and the contents must not be rewritten.
    ["a ?raw import of the stylesheet", `${KATEX_ID}?raw`],
    ["a ?url import of the stylesheet", `${KATEX_ID}?url`],
    ["an ?inline import of the stylesheet", `${KATEX_ID}?inline`],
  ])("ignores %s", (_label, id) => {
    expect(transform(INSTALLED_KATEX_CSS, id)).toBeNull()
  })

  it("matches the unminified stylesheet and Vite's query suffixes", () => {
    for (const id of [
      "/repo/node_modules/katex/dist/katex.css",
      `${KATEX_ID}?used`,
      `${KATEX_ID}?direct`,
    ]) {
      expect(transform(INSTALLED_KATEX_CSS, id)).not.toBeNull()
    }
  })

  it("returns null when the stylesheet is already woff2-only", () => {
    const css =
      '@font-face{font-family:KaTeX_AMS;src:url(fonts/a.woff2) format("woff2")}'
    expect(transform(css, KATEX_ID)).toBeNull()
  })

  it("fails the build when KaTeX reformats its src declarations", () => {
    // Single quotes: the strip pattern no longer matches, so without this guard
    // the woff and ttf files would silently return to the build.
    const reformatted =
      "@font-face{font-family:KaTeX_AMS;src:url(fonts/a.woff2) format('woff2')," +
      "url(fonts/a.woff) format('woff'),url(fonts/a.ttf) format('truetype')}"

    expect(() => transform(reformatted, KATEX_ID)).toThrow(
      /still references woff or ttf fonts/
    )
  })
})
