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

/** `transform` is an ObjectHook; ours carries a `filter` alongside the handler. */
const transformHandler = (plugin: Plugin): unknown =>
  typeof plugin.transform === "function"
    ? plugin.transform
    : plugin.transform?.handler

/**
 * Runs the plugin's transform with a minimal plugin context, turning
 * `this.error` into a thrown error so tests can assert on it. Neither Vite nor
 * Rolldown ships a plugin-context harness; Vite's own tests do the same.
 */
const transform = (code: string, id: string): string | null => {
  const plugin = katexWoff2Only()
  const handler = transformHandler(plugin)
  if (typeof handler !== "function") {
    throw new TypeError("expected a transform handler")
  }

  const hook = handler as unknown as TransformFn
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

/**
 * Drives one plugin instance through a whole build: `configResolved`,
 * `buildStart`, optionally a stylesheet passing through `transform`, then
 * `buildEnd`. Throws whatever the plugin reports via `this.error`.
 */
const runBuildLifecycle = (options: {
  command: "build" | "serve"
  transformsStylesheet: boolean
  error?: Error
}): void => {
  const plugin = katexWoff2Only()
  const context = {
    error: (message: string) => {
      throw new Error(message)
    },
  }

  const call = (hook: unknown, ...args: unknown[]): unknown => {
    if (typeof hook !== "function") {
      throw new TypeError("expected a function hook")
    }
    return (hook as (this: typeof context, ...a: unknown[]) => unknown).call(
      context,
      ...args
    )
  }

  call(plugin.configResolved, { command: options.command })
  call(plugin.buildStart, {})
  if (options.transformsStylesheet) {
    call(transformHandler(plugin), INSTALLED_KATEX_CSS, KATEX_ID)
  }
  call(plugin.buildEnd, options.error)
}

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
    // These read the file's contents or URL instead of emitting font assets, so
    // there is nothing to save and the contents must not be rewritten.
    ["a ?raw import of the stylesheet", `${KATEX_ID}?raw`],
    ["a ?url import of the stylesheet", `${KATEX_ID}?url`],
    ["an ?inline import of the stylesheet", `${KATEX_ID}?inline`],
  ])("ignores %s", (_label, id) => {
    expect(transform(INSTALLED_KATEX_CSS, id)).toBeNull()
  })

  it.each([
    ["the unminified stylesheet", "/repo/node_modules/katex/dist/katex.css"],
    ["Vite's ?direct marker", `${KATEX_ID}?direct`],
    ["an arbitrary query", `${KATEX_ID}?v=abc123`],
    // Vite's rawRE/urlRE require the token to end the query segment, so these
    // are CSS imports rather than raw/URL ones and their fonts must be stripped.
    ["?raw= with a value", `${KATEX_ID}?raw=value`],
    ["?url= with a value", `${KATEX_ID}?url=value`],
    ["?no-inline", `${KATEX_ID}?no-inline`],
  ])("transforms %s", (_label, id) => {
    expect(transform(INSTALLED_KATEX_CSS, id)).not.toBeNull()
  })

  it("ignores raw and url markers that do end the query segment", () => {
    for (const id of [`${KATEX_ID}?raw&x=1`, `${KATEX_ID}?x=1&url`]) {
      expect(transform(INSTALLED_KATEX_CSS, id)).toBeNull()
    }
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
  ])("fails the build when KaTeX reformats src with %s", (_label, src) => {
    // The strip pattern stops matching for each of these, so without a looser
    // guard the woff and ttf files would silently return to the build.
    expect(() => transform(`@font-face{${src}}`, KATEX_ID)).toThrow(
      /still references woff or ttf fonts/
    )
  })

  describe("requires the stylesheet to have been transformed", () => {
    it("fails a build that never saw it", () => {
      // Catches the stylesheet becoming unreachable, which no per-transform
      // check can see: the transform simply never runs.
      expect(() =>
        runBuildLifecycle({ command: "build", transformsStylesheet: false })
      ).toThrow(/never reached this plugin/)
    })

    it("stays quiet when the build already failed", () => {
      // A build that failed on its own may never reach the stylesheet, and
      // reporting here would bury the real error.
      expect(() =>
        runBuildLifecycle({
          command: "build",
          transformsStylesheet: false,
          error: new Error("some other build failure"),
        })
      ).not.toThrow()
    })

    it("stays quiet for a build that saw it", () => {
      expect(() =>
        runBuildLifecycle({ command: "build", transformsStylesheet: true })
      ).not.toThrow()
    })

    it("stays quiet in serve, where nothing is emitted", () => {
      expect(() =>
        runBuildLifecycle({ command: "serve", transformsStylesheet: false })
      ).not.toThrow()
    })
  })
})
