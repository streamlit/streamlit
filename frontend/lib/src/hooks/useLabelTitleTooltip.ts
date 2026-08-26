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

import { RefObject, useEffect, useRef } from "react"

/**
 * Read plain text from a label, inserting a space where leftover block
 * elements or hard breaks would otherwise concatenate (`onetwo`). CSS
 * generated content is not included in `textContent`.
 */
function plainTextWithBlockGaps(root: HTMLElement): string {
  const clone = root.cloneNode(true) as HTMLElement
  clone.querySelectorAll("br").forEach(br => {
    br.replaceWith(document.createTextNode(" "))
  })
  clone.querySelectorAll("p").forEach((paragraph, index) => {
    if (index > 0) {
      paragraph.prepend(document.createTextNode(" "))
    }
  })
  return (clone.textContent ?? "").replace(/\s+/g, " ").trim()
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
 * - The native `title` is always set when enabled; the browser shows it on hover
 *   without measuring whether the label is actually clipped.
 * - A MutationObserver re-syncs the title after async Markdown plugins (e.g.
 *   emoji) replace a loading skeleton with the real label. When
 *   `addTitleTooltip` is false, no observer is attached.
 *
 * @param addTitleTooltip Whether to attach the native title tooltip.
 * @param label The raw label source, used to re-sync when it changes.
 * @returns Refs to attach to the title container and the label text wrapper.
 */
export function useLabelTitleTooltip<
  ContainerElement extends HTMLElement = HTMLDivElement,
  LabelElement extends HTMLElement = HTMLSpanElement,
>(
  addTitleTooltip: boolean,
  label: string | null | undefined
): LabelTitleTooltipRefs<ContainerElement, LabelElement> {
  const titleRef = useRef<ContainerElement>(null)
  const labelTextRef = useRef<LabelElement>(null)
  // Skip label in the dependency list when the tooltip is off so streaming
  // updates on this shared renderer do not re-run a no-op effect.
  const labelKey = addTitleTooltip ? label : undefined

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
      if (!labelNode) {
        node.removeAttribute("title")
        return
      }
      const labelText = plainTextWithBlockGaps(labelNode)
      if (labelText) {
        node.title = labelText
      } else {
        node.removeAttribute("title")
      }
    }

    syncTitle()

    const observer = new MutationObserver(syncTitle)
    observer.observe(node, {
      childList: true,
      subtree: true,
      characterData: true,
    })
    return () => observer.disconnect()
  }, [addTitleTooltip, labelKey])

  return { titleRef, labelTextRef }
}
