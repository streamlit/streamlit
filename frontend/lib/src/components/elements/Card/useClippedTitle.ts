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

import { type RefObject, useEffect, useRef } from "react"

import { MARKDOWN_ELLIPSIS_CLASS } from "~lib/hooks/useLabelTitleTooltip"
import { plainTextWithBlockGaps } from "~lib/util/plainText"

/** Pixel slack so subpixel rounding does not count visible text as clipped. */
const CLIP_TOLERANCE_PX = 1

type ClipAxis = "horizontal" | "vertical"

function isClipped(node: HTMLElement, axis: ClipAxis): boolean {
  if (axis === "vertical") {
    // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Required to detect a clamped caption
    return node.scrollHeight > node.clientHeight + CLIP_TOLERANCE_PX
  }
  // The single-line markdown paints the ellipsis on its own root.
  const target = node.querySelector(`.${MARKDOWN_ELLIPSIS_CLASS}`) ?? node
  return (
    // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Required to detect a clipped label
    target.scrollWidth > target.clientWidth + CLIP_TOLERANCE_PX
  )
}

/**
 * Sets a native `title` with the plain text of the host while the text is cut
 * off, either by an ellipsis (`horizontal`) or by a line clamp (`vertical`),
 * so the full text can still be read on hover. The title tracks the card's
 * width, which changes when the page or its columns resize.
 *
 * @param axis Direction in which the text is cut off.
 * @param source The Markdown source, so the title re-syncs when it changes.
 * @returns A ref for the element that carries the title.
 */
export function useClippedTitle(
  axis: ClipAxis,
  source: string
): RefObject<HTMLDivElement> {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) {
      return
    }

    const syncTitle = (): void => {
      const text = isClipped(host, axis) ? plainTextWithBlockGaps(host) : ""
      if (text) {
        if (host.title !== text) {
          host.title = text
        }
      } else if (host.hasAttribute("title")) {
        host.removeAttribute("title")
      }
    }

    syncTitle()
    // Markdown can finish rendering after the first measurement.
    const mutationObserver = new MutationObserver(syncTitle)
    mutationObserver.observe(host, {
      childList: true,
      subtree: true,
      characterData: true,
    })
    const resizeObserver = new ResizeObserver(syncTitle)
    resizeObserver.observe(host)
    return () => {
      mutationObserver.disconnect()
      resizeObserver.disconnect()
    }
  }, [axis, source])

  return hostRef
}
