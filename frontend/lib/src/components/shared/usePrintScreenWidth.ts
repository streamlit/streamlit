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

import { type RefObject, useEffect } from "react"

/**
 * The element's on-screen width in px, recorded on `beforeprint`. Print CSS
 * reads it to grow a box past its screen width only by a limited factor.
 * It is unset when print media applies without `beforeprint` (for example
 * a headless PDF), so readers need a fallback.
 */
export const PRINT_SCREEN_WIDTH_VAR = "--st-print-screen-width"

/**
 * How much wider than on screen a chart and its stacked column may print.
 * More than this enlarges the chart's text well past the surrounding text.
 */
const PRINT_MAX_UPSCALE = 1.25

/**
 * CSS width that grows up to `PRINT_MAX_UPSCALE` times the recorded screen
 * width, never past the containing block. Without a recorded width it is
 * `100%`.
 */
export const PRINT_UPSCALED_WIDTH = `min(100%, calc(var(${PRINT_SCREEN_WIDTH_VAR}, 100%) * ${PRINT_MAX_UPSCALE}))`

/**
 * Records the element's on-screen width in `PRINT_SCREEN_WIDTH_VAR` before
 * printing and clears it afterwards, so a later print measures the current
 * layout. `beforeprint` fires while screen layout is still active.
 */
export function usePrintScreenWidth(
  ref: RefObject<HTMLElement | null>,
  enabled = true
): void {
  useEffect(() => {
    if (!enabled) {
      return
    }

    const handleBeforePrint = (): void => {
      const element = ref.current
      if (element) {
        // Clear a width left over from a print whose afterprint never fired.
        element.style.removeProperty(PRINT_SCREEN_WIDTH_VAR)
        // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Print starts right after beforeprint, before a resize observer could report
        const { width } = element.getBoundingClientRect()
        // A hidden element measures 0, which would collapse the print width
        // instead of using the variable's 100% fallback.
        if (width > 0) {
          element.style.setProperty(PRINT_SCREEN_WIDTH_VAR, `${width}px`)
        }
      }
    }
    const handleAfterPrint = (): void => {
      ref.current?.style.removeProperty(PRINT_SCREEN_WIDTH_VAR)
    }

    window.addEventListener("beforeprint", handleBeforePrint)
    window.addEventListener("afterprint", handleAfterPrint)
    return () => {
      window.removeEventListener("beforeprint", handleBeforePrint)
      window.removeEventListener("afterprint", handleAfterPrint)
    }
  }, [ref, enabled])
}
