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

/**
 * True when `el` is painting a CSS ellipsis. The ellipsis is not part of the
 * DOM text, so a trailing "..." check cannot detect it.
 */
function hasEllipsisOverflow(el: Element): boolean {
  // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Required to detect a clipped label
  if (el.scrollWidth <= el.clientWidth + ELLIPSIS_OVERFLOW_TOLERANCE_PX) {
    return false
  }
  return getComputedStyle(el).textOverflow === "ellipsis"
}

/**
 * The title host is not always the ellipsis box. Button and checkbox labels
 * put `display: contents` around the text and ellipsize a descendant; headings
 * and `st.text` ellipsize the host itself.
 */
function isLabelTextOverflowing(root: HTMLElement): boolean {
  if (hasEllipsisOverflow(root)) {
    return true
  }
  for (const el of root.querySelectorAll(ELLIPSIS_TARGET_SELECTOR)) {
    if (hasEllipsisOverflow(el)) {
      return true
    }
  }
  return false
}

function clearTitle(node: HTMLElement): void {
  if (node.hasAttribute("title")) {
    node.removeAttribute("title")
  }
}

/**
 * The first measure can run against a fallback font. Remeasure once when the
 * document's current fonts finish loading. Later font swaps are ignored.
 */
function remeasureWhenFontsReady(recheck: () => void): () => void {
  const fonts = (document as { fonts?: { ready: Promise<unknown> } }).fonts
  if (fonts === undefined) {
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
 * - The native `title` is set only when an ellipsis box inside the host is
 *   actually clipped (`scrollWidth` wider than `clientWidth`). A label that
 *   fits does not get a title. Overflow is measured when the label renders,
 *   and once more when `document.fonts.ready` settles. A later resize or
 *   font swap can leave the title stale until the next render.
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

    const syncTitle = (): void => {
      const labelNode = labelTextRef.current
      if (!labelNode || !isLabelTextOverflowing(node)) {
        clearTitle(node)
        return
      }
      const labelText = plainTextWithBlockGaps(labelNode)
      if (!labelText) {
        clearTitle(node)
        return
      }
      if (node.getAttribute("title") !== labelText) {
        node.title = labelText
      }
    }

    syncTitle()
    const cancelFontRecheck = remeasureWhenFontsReady(syncTitle)

    const mutationObserver = new MutationObserver(syncTitle)
    mutationObserver.observe(node, {
      childList: true,
      subtree: true,
      characterData: true,
    })

    return () => {
      cancelFontRecheck()
      mutationObserver.disconnect()
    }
  }, [addTitleTooltip, effectIdentityKey])

  return { titleRef, labelTextRef }
}
