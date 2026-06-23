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

import { memo, ReactElement, useCallback, useEffect, useRef } from "react"

import { FloatingPortal } from "@floating-ui/react"

import { DynamicIcon } from "~lib/components/shared/Icon/DynamicIcon"
import { useCopyToClipboard } from "~lib/hooks/useCopyToClipboard"
import { useFloatingOverlay } from "~lib/hooks/useFloatingOverlay"

import {
  StyledCopyButton,
  StyledJsonPathTooltipBody,
  StyledPathTooltip,
} from "./styled-components"

export interface JsonPathTooltipProps {
  top: number
  left: number
  path: string
  clearTooltip: () => void
}

/**
 * A tooltip that displays a JSON path and allows copying it to clipboard.
 *
 * Uses floating-ui for virtual-element positioning (no DOM anchor required).
 * The parent (`Json.tsx`) controls mount/unmount — this component is always
 * "open" while mounted, and calls `clearTooltip` to signal the parent to
 * unmount it.
 */
function JsonPathTooltip({
  top,
  left,
  path,
  clearTooltip,
}: JsonPathTooltipProps): ReactElement {
  const { isCopied, copyToClipboard, label } = useCopyToClipboard()

  const { refs, floatingStyles } = useFloatingOverlay({
    open: true,
    placement: "top",
    offsetPx: 15,
  })

  // Track when the component mounted so the click-outside handler can ignore
  // the same click that caused the tooltip to appear (timestamp guard mirrors
  // the pattern in Popover.tsx).
  const openedAtRef = useRef(0)

  // Ref for the floating body element — needed for click-outside detection.
  const tooltipBodyRef = useRef<HTMLDivElement | null>(null)

  // Set a floating-ui virtual element from the (top, left) click coordinates.
  // A virtual element satisfies the ReferenceElement interface via
  // getBoundingClientRect, so no invisible DOM anchor div is needed.
  // Also record the mount time here so the click-outside handler can apply
  // the timestamp guard against the click that triggered the tooltip.
  useEffect(() => {
    openedAtRef.current = Date.now()
    refs.setReference({
      getBoundingClientRect: () => ({
        x: left,
        y: top,
        top,
        left,
        bottom: top,
        right: left,
        width: 0,
        height: 0,
      }),
    })
  }, [refs, top, left])

  // Merge the floating ref with our local tooltipBodyRef for dismissal logic.
  const setFloatingRef = useCallback(
    (node: HTMLDivElement | null): void => {
      refs.setFloating(node)
      tooltipBodyRef.current = node
    },
    [refs]
  )

  // Document-level click-outside and Escape dismissal.
  useEffect(() => {
    const handleClick = (e: MouseEvent): void => {
      // Guard against the click that opened the tooltip closing it immediately.
      if (Date.now() - openedAtRef.current < 50) return
      if (!tooltipBodyRef.current?.contains(e.target as Node)) {
        clearTooltip()
      }
    }

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        e.stopPropagation()
        clearTooltip()
      }
    }

    document.addEventListener("click", handleClick)
    document.addEventListener("keydown", handleKeyDown, true)
    return () => {
      document.removeEventListener("click", handleClick)
      document.removeEventListener("keydown", handleKeyDown, true)
    }
  }, [clearTooltip])

  const handleCopyPath = useCallback((): void => {
    copyToClipboard(path)
  }, [copyToClipboard, path])

  return (
    <FloatingPortal>
      <StyledJsonPathTooltipBody
        ref={setFloatingRef}
        data-testid="stJsonPathTooltipBody"
        style={floatingStyles}
        role="dialog"
        aria-label="JSON path"
      >
        <StyledPathTooltip data-testid="stJsonPathTooltip">
          <code>{path}</code>
          <StyledCopyButton
            onClick={handleCopyPath}
            title={label}
            aria-label={label}
            autoFocus
          >
            <DynamicIcon
              size="sm"
              iconValue={
                isCopied ? ":material/check:" : ":material/content_copy:"
              }
            />
          </StyledCopyButton>
        </StyledPathTooltip>
      </StyledJsonPathTooltipBody>
    </FloatingPortal>
  )
}

export default memo(JsonPathTooltip)
