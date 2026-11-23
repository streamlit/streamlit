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
 * Report whether the chart's theme fonts have loaded, so its first layout
 * can wait for them.
 *
 * ECharts caches text widths per font for the whole page. A chart laid out
 * while a theme font is loading keeps the fallback widths, so later repaints
 * draw the real font into them (overlapping legend items, clipped text).
 *
 * - Already-loaded fonts (the common case) are ready on the first render.
 * - Once ready, the hook stays ready, so a later font change never hides a
 *   visible chart.
 * - The chart waits until every font has loaded or failed. After a failure
 *   or timeout, the fallback widths stay cached for the page, and later
 *   charts with the same fonts don't wait.
 * - Only faces in ``document.fonts`` can be awaited. A font whose stylesheet
 *   hasn't arrived yet doesn't hold the chart back.
 * - Charts without the Streamlit theme use ECharts' own fonts and never wait.
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
    // A font that fails to load renders with the fallback, like a timeout,
    // while the other fonts are still awaited.
    void Promise.allSettled(specs.map(spec => fonts.load(spec))).finally(
      () => {
        if (!cancelled) {
          markReady()
        }
      }
    )
    return () => {
      cancelled = true
    }
  }, [isReady, markReady, specs])

  return isReady
}
