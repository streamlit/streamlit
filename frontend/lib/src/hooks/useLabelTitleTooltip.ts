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
  for (const el of root.querySelectorAll("*")) {
    if (hasEllipsisOverflow(el)) {
      return true
    }
  }
  return false
}

/**
 * Web fonts can widen text without changing the element's border box, so a
 * ResizeObserver on the host would miss the new overflow.
 */
function scheduleFontLoadRecheck(recheck: () => void): () => void {
  // FontFaceSet is missing in jsdom. The DOM type always declares it, so read
  // the property through a narrower shape and ignore a missing implementation.
  let fonts: { ready: Promise<unknown> } | undefined
  try {
    fonts = (document as { fonts?: { ready: Promise<unknown> } }).fonts
  } catch {
    return () => undefined
  }
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
 *   fits does not get a title.
 * - A MutationObserver re-syncs the title after async Markdown plugins (e.g.
 *   emoji) replace a loading skeleton with the real label. A ResizeObserver
 *   and `document.fonts.ready` re-check after the width or font metrics
 *   change. When `addTitleTooltip` is false, no observer is attached.
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

    let cancelled = false

    const syncTitle = (): void => {
      if (cancelled) {
        return
      }
      const labelNode = labelTextRef.current
      if (!labelNode) {
        node.removeAttribute("title")
        return
      }
      const labelText = plainTextWithBlockGaps(labelNode)
      if (!labelText || !isLabelTextOverflowing(node)) {
        node.removeAttribute("title")
        return
      }
      node.title = labelText
    }

    syncTitle()

    const mutationObserver = new MutationObserver(syncTitle)
    mutationObserver.observe(node, {
      childList: true,
      subtree: true,
      characterData: true,
    })

    const resizeObserver = new ResizeObserver(syncTitle)
    resizeObserver.observe(node)

    const cancelFontRecheck = scheduleFontLoadRecheck(syncTitle)

    return () => {
      cancelled = true
      cancelFontRecheck()
      mutationObserver.disconnect()
      resizeObserver.disconnect()
    }
  }, [addTitleTooltip, effectIdentityKey])

  return { titleRef, labelTextRef }
}
