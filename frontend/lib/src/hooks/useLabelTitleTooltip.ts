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

import { plainTextWithBlockGaps } from "~lib/util/plainText"

/**
 * Pixel slack so subpixel scrollWidth/clientWidth rounding does not count a
 * fully visible label as clipped. Matches the horizontal-scroll tolerance.
 */
const ELLIPSIS_OVERFLOW_TOLERANCE_PX = 1

/**
 * Class on a markdown root whose `truncate` styles paint the ellipsis.
 * Production code must not query `data-testid` for this.
 */
export const MARKDOWN_ELLIPSIS_CLASS = "stMarkdownEllipsis"

/**
 * Ellipsis boxes that are not the title host. Button, checkbox, and markdown
 * labels ellipsize the markdown root (or a badge inside it); headings and
 * st.text ellipsize the host itself.
 */
const ELLIPSIS_TARGET_SELECTOR = `.${MARKDOWN_ELLIPSIS_CLASS}, .stMarkdownBadge`

type OverflowMeasure = "overflow" | "fits" | "unmeasured"

/**
 * A 0×0 box has not been laid out yet (a hidden tab or collapsed expander).
 * That is distinct from a label that fits.
 */
function measureEllipsis(el: Element): OverflowMeasure {
  // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Required to detect a clipped label
  const scrollWidth = el.scrollWidth
  // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Required to detect a clipped label
  const clientWidth = el.clientWidth
  if (scrollWidth === 0 && clientWidth === 0) {
    return "unmeasured"
  }
  if (scrollWidth <= clientWidth + ELLIPSIS_OVERFLOW_TOLERANCE_PX) {
    return "fits"
  }
  return getComputedStyle(el).textOverflow === "ellipsis" ? "overflow" : "fits"
}

/**
 * The title host is not always the ellipsis box. Button and checkbox labels
 * put `display: contents` around the text and ellipsize a descendant; headings
 * and `st.text` ellipsize the host itself.
 */
function labelOverflowState(root: HTMLElement): OverflowMeasure {
  const rootState = measureEllipsis(root)
  if (rootState === "overflow") {
    return "overflow"
  }
  let sawBox = rootState === "fits"
  for (const el of root.querySelectorAll(ELLIPSIS_TARGET_SELECTOR)) {
    const state = measureEllipsis(el)
    if (state === "overflow") {
      return "overflow"
    }
    if (state === "fits") {
      sawBox = true
    }
  }
  return sawBox ? "fits" : "unmeasured"
}

function clearTitle(node: HTMLElement): void {
  if (node.hasAttribute("title")) {
    node.removeAttribute("title")
  }
}

interface FontFaceSetLike {
  ready: Promise<unknown>
  status?: string
}

/**
 * The first measure can run against a fallback font. Remeasure once when the
 * document's current fonts finish loading. Skip that when they are already
 * loaded, and ignore later font swaps.
 */
function remeasureWhenFontsReady(recheck: () => void): () => void {
  const fonts = (document as { fonts?: FontFaceSetLike }).fonts
  if (fonts === undefined || fonts.status === "loaded") {
    return () => undefined
  }

  let cancelled = false
  void fonts.ready.then(
    () => {
      if (!cancelled) {
        recheck()
      }
      return undefined
    },
    () => undefined
  )
  return () => {
    cancelled = true
  }
}

interface LabelTitleTooltipRefs<
  ContainerElement extends HTMLElement,
  LabelElement extends HTMLElement,
> {
  /** Attach to the element that should carry the native `title` attribute. */
  titleRef: RefObject<ContainerElement>
  /** Attach to the element wrapping the rendered label text. */
  labelTextRef: RefObject<LabelElement>
}

/**
 * Syncs a native browser tooltip (`title`) exposing the full label text so a
 * label truncated with an ellipsis (e.g. `wrap=false`) can still be read on
 * hover.
 *
 * - The hook reads rendered plain text from the DOM so a Markdown label is
 *   shown without its raw syntax (Markdown only yields plain text after it
 *   renders).
 * - The native `title` is set only when the host, or an ellipsis box inside
 *   it, is actually clipped (`scrollWidth` wider than `clientWidth`). A label
 *   that fits does not get a title. Overflow is measured when the label
 *   renders, once more when `document.fonts.ready` settles, and again if the
 *   label had no box at mount once it is first laid out. A later resize or
 *   font swap keeps that result until the label text or its rendered content
 *   changes.
 * - A MutationObserver re-syncs the title after async Markdown plugins (e.g.
 *   emoji) replace a loading skeleton with the real label. When
 *   `addTitleTooltip` is false, no observer is attached.
 *
 * @param addTitleTooltip Whether to attach the native title tooltip.
 * @param identityKey Value whose change forces a title re-sync. Usually the
 *   raw label source; headings pass their tag.
 * @returns Refs to attach to the title container and the label text wrapper.
 */
export function useLabelTitleTooltip<
  ContainerElement extends HTMLElement = HTMLDivElement,
  LabelElement extends HTMLElement = HTMLSpanElement,
>(
  addTitleTooltip: boolean,
  identityKey: string | null | undefined
): LabelTitleTooltipRefs<ContainerElement, LabelElement> {
  const titleRef = useRef<ContainerElement>(null)
  const labelTextRef = useRef<LabelElement>(null)
  // Skip identityKey in the dependency list when the tooltip is off so
  // streaming updates on this shared renderer do not re-run a no-op effect.
  const effectIdentityKey = addTitleTooltip ? identityKey : undefined

  useEffect(() => {
    const node = titleRef.current
    if (!node) {
      return
    }

    if (!addTitleTooltip) {
      node.removeAttribute("title")
      return
    }

    // Returns false when the label has no box yet, so the caller can retry.
    const syncTitle = (): boolean => {
      const labelNode = labelTextRef.current
      if (!labelNode) {
        clearTitle(node)
        return true
      }
      const overflow = labelOverflowState(node)
      if (overflow === "unmeasured") {
        return false
      }
      if (overflow === "fits") {
        clearTitle(node)
        return true
      }
      const labelText = plainTextWithBlockGaps(labelNode)
      if (!labelText) {
        clearTitle(node)
        return true
      }
      if (node.getAttribute("title") !== labelText) {
        node.title = labelText
      }
      return true
    }

    const cancelFontRecheck = remeasureWhenFontsReady(syncTitle)

    const mutationObserver = new MutationObserver(syncTitle)
    mutationObserver.observe(node, {
      childList: true,
      subtree: true,
      characterData: true,
    })

    // Hidden tabs and collapsed expanders mount at 0×0. Watch only until the
    // first real box, then disconnect so later resizes do not force layout.
    let resizeObserver: ResizeObserver | undefined
    if (!syncTitle()) {
      resizeObserver = new ResizeObserver(() => {
        if (syncTitle()) {
          resizeObserver?.disconnect()
        }
      })
      resizeObserver.observe(node)
    }

    return () => {
      cancelFontRecheck()
      mutationObserver.disconnect()
      resizeObserver?.disconnect()
    }
  }, [addTitleTooltip, effectIdentityKey])

  return { titleRef, labelTextRef }
}
