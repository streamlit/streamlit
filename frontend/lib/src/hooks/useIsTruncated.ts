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

import { RefObject, useLayoutEffect, useState } from "react"

/** Sub-pixel rounding tolerance when comparing scroll and client widths. */
const TRUNCATION_TOLERANCE_PX = 1

export interface UseIsTruncatedResult {
  /** Whether the measured label is currently truncated with an ellipsis. */
  isTruncated: boolean
  /** The plain-text content of the measured label (its accessible name). */
  labelText: string
}

/**
 * Detects whether a label rendered by `StreamlitMarkdown` inside `containerRef`
 * is truncated (its content is wider than the space available for it).
 *
 * The measurement targets the first visible `stMarkdownContainer` inside the
 * container, so it stays correct even when the label is duplicated for the
 * desktop/mobile tooltip split (the hidden copy has no `offsetParent`). It
 * re-measures whenever the container resizes via a `ResizeObserver` and whenever
 * one of the provided `deps` changes (e.g. the label text).
 *
 * @param containerRef Ref to an element that contains the label markdown.
 * @param enabled When false, detection is skipped and `isTruncated` stays false.
 * @param deps Values that should trigger a re-measure when they change.
 */
export function useIsTruncated(
  containerRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  deps: unknown[] = []
): UseIsTruncatedResult {
  const [result, setResult] = useState<UseIsTruncatedResult>({
    isTruncated: false,
    labelText: "",
  })

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!enabled || !container) {
      setResult(prev =>
        prev.isTruncated ? { isTruncated: false, labelText: "" } : prev
      )
      return undefined
    }

    const measure = (): void => {
      const labels = container.querySelectorAll<HTMLElement>(
        '[data-testid="stMarkdownContainer"]'
      )
      // The label may be duplicated for the desktop/mobile tooltip split; the
      // hidden copy has no offsetParent, so measure the visible one.
      let label: HTMLElement | null = null
      for (const candidate of labels) {
        // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- truncation detection
        if (candidate.offsetParent !== null) {
          label = candidate
          break
        }
      }
      label = label ?? labels[0] ?? null
      if (!label) {
        return
      }

      // StreamlitMarkdown applies the ellipsis to the inner <p>, so that is the
      // element whose content overflows; fall back to the container otherwise.
      const clip = label.querySelector<HTMLElement>("p") ?? label
      // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- truncation detection
      const scrollWidth = clip.scrollWidth
      // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- truncation detection
      const clientWidth = clip.clientWidth
      const isTruncated = scrollWidth - clientWidth > TRUNCATION_TOLERANCE_PX
      const labelText = label.textContent ?? ""
      setResult(prev =>
        prev.isTruncated === isTruncated && prev.labelText === labelText
          ? prev
          : { isTruncated, labelText }
      )
    }

    measure()

    const resizeObserver = new ResizeObserver(() => measure())
    resizeObserver.observe(container)

    return () => resizeObserver.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps are caller-provided re-measure triggers
  }, [containerRef, enabled, ...deps])

  return result
}
