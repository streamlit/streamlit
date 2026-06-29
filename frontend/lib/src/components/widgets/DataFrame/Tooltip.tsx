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

import { memo, ReactElement, useEffect } from "react"

import styled from "@emotion/styled"
import { FloatingPortal } from "@floating-ui/react"

import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown/StreamlitMarkdown"
import { StyledTooltipContentWrapper } from "~lib/components/shared/Tooltip/styled-components"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { useFloatingOverlay } from "~lib/hooks/useFloatingOverlay"

/**
 * Floating container rendered via FloatingPortal. Floating UI's floatingStyles
 * (position: fixed + transform: translate) position it relative to the anchor.
 * Fixed-position elements naturally shrink-wrap to content, so no explicit
 * width is needed.
 */
const StyledDataFrameTooltipContainer = styled.div(({ theme }) => ({
  zIndex: theme.zIndices.popup,
  pointerEvents: "none",
}))

export interface TooltipProps {
  /** The top position of the tooltip anchor (viewport coordinates). */
  top: number
  /** The left position of the tooltip anchor (viewport coordinates). */
  left: number
  /** The markdown content of the tooltip. */
  content: string
  /** Callback from useTooltips hook to clear the tooltip. */
  clearTooltip: () => void
}

/**
 * A tooltip that can be positioned anywhere on the screen using virtual
 * viewport coordinates from glide-data-grid's onItemHovered event.
 *
 * An invisible fixed-position `<div>` serves as the Floating UI reference
 * element. The tooltip content renders via FloatingPortal into document.body,
 * escaping any stacking context inside the DataFrame container.
 *
 * The component is always open while mounted — the parent (DataFrame.tsx)
 * controls visibility by only rendering this component when tooltip content
 * is present. Escape and click-outside both call clearTooltip() which causes
 * the parent to unmount this component.
 */
function Tooltip({
  top,
  left,
  content,
  clearTooltip,
}: TooltipProps): ReactElement {
  const theme = useEmotionTheme()

  const { refs, floatingStyles } = useFloatingOverlay({
    open: true,
    placement: "top",
    offsetPx: 5,
  })

  // Dismiss on Escape or a pointer-down outside the tooltip content (capture
  // phase, consistent with ColumnMenu pattern). Clicks inside the tooltip
  // (e.g. to copy text or follow a link) do not dismiss it.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape") clearTooltip()
    }
    const handlePointerDown = (e: Event): void => {
      if (refs.floating.current?.contains(e.target as Node)) return
      clearTooltip()
    }

    document.addEventListener("keydown", handleKeyDown, true)
    document.addEventListener("pointerdown", handlePointerDown, true)
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true)
      document.removeEventListener("pointerdown", handlePointerDown, true)
    }
  }, [clearTooltip, refs.floating])

  return (
    <>
      {/*
       * Invisible anchor div — gives Floating UI a real DOM reference element
       * at the cell's viewport coordinates so autoUpdate and flip/shift
       * middleware work correctly. Width/height 0 keeps it truly invisible.
       */}
      <div
        ref={refs.setReference}
        data-testid="stDataFrameTooltipTarget"
        style={{
          position: "fixed",
          top,
          left,
          width: 0,
          height: 0,
        }}
      />
      <FloatingPortal>
        <StyledDataFrameTooltipContainer
          ref={refs.setFloating}
          style={floatingStyles}
          role="tooltip"
        >
          <StyledTooltipContentWrapper data-testid="stDataFrameTooltipContent">
            <StreamlitMarkdown
              style={{ fontSize: theme.fontSizes.sm }}
              source={content}
              allowHTML={false}
            />
          </StyledTooltipContentWrapper>
        </StyledDataFrameTooltipContainer>
      </FloatingPortal>
    </>
  )
}

export default memo(Tooltip)
