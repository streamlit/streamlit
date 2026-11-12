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

import { useCallback, useEffect, useMemo, useState } from "react"

import useTimeout from "~lib/hooks/useTimeout"
import type { EmotionTheme } from "~lib/theme/types"

/**
 * How long a chart waits for its fonts before it renders with the fallback,
 * so a blocked or slow font host doesn't leave the chart blank.
 */
export const CHART_FONT_TIMEOUT_MS = 3000

interface FontFaceSetLike {
  check: (font: string) => boolean
  load: (font: string) => Promise<unknown>
}

function getFontFaceSet(): FontFaceSetLike | undefined {
  return (document as { fonts?: FontFaceSetLike }).fonts
}

/**
 * Font specifications that loaded or timed out on this page. ECharts' width
 * cache is page-wide too, so once a specification settles, waiting again
 * can't help a later chart.
 */
const settledFontSpecs = new Set<string>()

/** Forget settled fonts between tests. */
export function resetChartFontsForTests(): void {
  settledFontSpecs.clear()
}

/**
 * CSS font shorthands for the body and heading fonts that chart text uses.
 * The size only satisfies the shorthand syntax.
 */
function chartFontSpecs(theme: EmotionTheme): string[] {
  const { bodyFont, headingFont } = theme.genericFonts
  const weight = theme.fontWeights.normal
  return [...new Set([bodyFont, headingFont])].map(
    family => `${weight} 1em ${family}`
  )
}

function areFontsLoaded(specs: string[]): boolean {
  const fonts = getFontFaceSet()
  if (fonts === undefined) {
    return true
  }
  try {
    return specs.every(spec => fonts.check(spec))
  } catch {
    // An unparsable font shorthand can't be waited for.
    return true
  }
}

/**
 * Report whether the chart's theme fonts have loaded, so the chart can wait
 * for them before its first layout.
 *
 * ECharts measures text once per font and caches the widths for the page. A
 * chart laid out while a theme font is still loading measures and draws the
 * fallback font, and every later repaint draws the loaded font into those
 * widths: legend items run into each other and right-aligned text is clipped.
 *
 * Fonts that are already loaded (the common case) report ready on the first
 * render. Once ready, the result stays true, so a later font change never
 * holds back a chart that is already showing.
 *
 * Only declared faces can be waited for: a theme font whose stylesheet hasn't
 * arrived yet is unknown to ``document.fonts`` and doesn't hold the chart
 * back. After a timeout, the fallback widths stay cached for the page.
 *
 * A chart without the Streamlit theme (``usesThemeFonts`` false) draws in
 * ECharts' own fonts, so it never waits.
 */
export function useChartFontsReady(
  theme: EmotionTheme,
  usesThemeFonts: boolean
): boolean {
  const specsKey = usesThemeFonts ? chartFontSpecs(theme).join("|") : ""
  // Derived from the joined key, so a new theme object with the same fonts
  // doesn't restart the effect below.
  const specs = useMemo(
    () => (specsKey === "" ? [] : specsKey.split("|")),
    [specsKey]
  )
  const [isReady, setIsReady] = useState(
    () => settledFontSpecs.has(specsKey) || areFontsLoaded(specs)
  )
  const markReady = useCallback((): void => {
    settledFontSpecs.add(specsKey)
    setIsReady(true)
  }, [specsKey])

  useTimeout(markReady, isReady ? null : CHART_FONT_TIMEOUT_MS)

  useEffect(() => {
    if (isReady) {
      return
    }
    const fonts = getFontFaceSet()
    if (fonts === undefined) {
      markReady()
      return
    }
    let cancelled = false
    // A font that fails to load renders with the fallback, like a timeout.
    void Promise.all(specs.map(spec => fonts.load(spec)))
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          markReady()
        }
      })
    return () => {
      cancelled = true
    }
  }, [isReady, markReady, specs])

  return isReady
}
