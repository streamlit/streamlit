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

    const findVisibleLabel = (): HTMLElement | null => {
      const labels = container.querySelectorAll<HTMLElement>(
        '[data-testid="stMarkdownContainer"]'
      )
      // The label may be duplicated for the desktop/mobile tooltip split; the
      // hidden copy has no offsetParent, so measure the visible one.
      for (const candidate of labels) {
        // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- truncation detection
        if (candidate.offsetParent !== null) {
          return candidate
        }
      }
      return labels[0] ?? null
    }

    // StreamlitMarkdown applies the ellipsis to the inner <p>, so that is the
    // element whose content overflows; fall back to the label otherwise.
    const getClip = (label: HTMLElement): HTMLElement =>
      label.querySelector<HTMLElement>("p") ?? label

    const measure = (): void => {
      const label = findVisibleLabel()
      if (!label) {
        // No label is rendered (e.g. an icon-only control, or the label was
        // cleared on a rerun). Clear any stale truncation state so a previously
        // measured tooltip doesn't linger.
        setResult(prev =>
          prev.isTruncated || prev.labelText !== ""
            ? { isTruncated: false, labelText: "" }
            : prev
        )
        return
      }

      const clip = getClip(label)
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
    // Also observe the inner label node. Inside a fixed-width control, sibling
    // size changes (e.g. an icon swapping for a loading spinner) redistribute
    // flex space and change the label width without resizing the container, so
    // the container observer alone would miss them.
    const initialLabel = findVisibleLabel()
    if (initialLabel) {
      resizeObserver.observe(getClip(initialLabel))
    }

    // A web font or icon glyph can finish loading after the first measurement
    // and change the label's intrinsic width without resizing it, so re-measure
    // whenever fonts finish loading. Using the `loadingdone` event (rather than
    // the one-shot `fonts.ready`) also covers fonts injected by a later rerun.
    const handleFontsLoaded = (): void => measure()
    const fontSet: FontFaceSet | undefined = document.fonts
    fontSet?.addEventListener("loadingdone", handleFontsLoaded)

    return () => {
      fontSet?.removeEventListener("loadingdone", handleFontsLoaded)
      resizeObserver.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps are caller-provided re-measure triggers
  }, [containerRef, enabled, ...deps])

  return result
}
