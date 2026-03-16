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

import { ReactElement, useLayoutEffect, useRef, useState } from "react"

import { EmotionIcon } from "@emotion-icons/emotion-icon"
import { Fullscreen, FullscreenExit } from "@emotion-icons/material-outlined"

import Button, {
  BaseButtonKind,
} from "~lib/components/shared/BaseButton/BaseButton"
import Icon from "~lib/components/shared/Icon/Icon"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown/StreamlitMarkdown"
import Tooltip, { Placement } from "~lib/components/shared/Tooltip/Tooltip"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"

import {
  StyledToolbar,
  StyledToolbarWrapper,
  type StyledToolbarWrapperProps,
} from "./styled-components"

export interface ToolbarActionProps {
  label: string
  icon?: EmotionIcon
  show_label?: boolean
  onClick: () => void
}

export function ToolbarAction({
  label,
  show_label,
  icon,
  onClick,
}: ToolbarActionProps): ReactElement {
  const theme = useEmotionTheme()

  const displayLabel = show_label ? label : ""
  return (
    <div data-testid="stElementToolbarButton">
      <Tooltip
        content={
          <StreamlitMarkdown
            source={label}
            allowHTML={false}
            style={{ fontSize: theme.fontSizes.sm }}
          />
        }
        placement={Placement.TOP}
        // The default tooltip delay (== how fast the tooltip is triggered) of 200ms
        // is a bit too fast for the toolbar use case. Therefore, we are setting it to 1000ms.
        onMouseEnterDelay={1000}
        inline
      >
        <Button
          onClick={event => {
            if (onClick) {
              onClick()
            }
            event.stopPropagation()
          }}
          kind={BaseButtonKind.ELEMENT_TOOLBAR}
          aria-label={label}
        >
          {icon && (
            <Icon
              content={icon}
              size="md"
              testid="stElementToolbarButtonIcon"
            />
          )}
          {displayLabel && <span>{displayLabel}</span>}
        </Button>
      </Tooltip>
    </div>
  )
}

export interface ToolbarProps {
  onExpand?: () => void
  onCollapse?: () => void
  isFullScreen?: boolean
  locked?: boolean
  target?: StyledToolbarWrapperProps["target"]
  disableFullscreenMode?: boolean
}

const Toolbar: React.FC<React.PropsWithChildren<ToolbarProps>> = ({
  onExpand,
  onCollapse,
  isFullScreen,
  locked,
  children,
  target,
  disableFullscreenMode,
}): ReactElement => {
  const showFullscreenButton =
    onExpand && !disableFullscreenMode && !isFullScreen
  const showCloseFullscreenButton =
    onCollapse && !disableFullscreenMode && isFullScreen

  const anchorRef = useRef<HTMLDivElement>(null)
  const [parentRect, setParentRect] = useState<DOMRect | null>(null)

  // Uses a fixed overlay to bypass ancestor overflow:hidden constraints.
  useLayoutEffect(() => {
    if (isFullScreen) return

    const updatePosition = (): void => {
      if (anchorRef.current?.parentElement) {
        // eslint-disable-next-line streamlit-custom/no-force-reflow-access
        setParentRect(anchorRef.current.parentElement.getBoundingClientRect())
      }
    }

    updatePosition()

    window.addEventListener("resize", updatePosition)
    window.addEventListener("scroll", updatePosition, true)

    let resizeObserver: ResizeObserver | null = null
    if (anchorRef.current?.parentElement) {
      resizeObserver = new ResizeObserver(() => {
        updatePosition()
      })
      resizeObserver.observe(anchorRef.current.parentElement)
    }

    return () => {
      window.removeEventListener("resize", updatePosition)
      window.removeEventListener("scroll", updatePosition, true)
      if (resizeObserver) resizeObserver.disconnect()
    }
  }, [isFullScreen])

  const toolbar = (
    <StyledToolbarWrapper
      className="stElementToolbar"
      data-testid="stElementToolbar"
      locked={locked || isFullScreen}
      target={target}
      style={{ pointerEvents: "auto" }}
    >
      <StyledToolbar data-testid="stElementToolbarButtonContainer">
        {children}
        {showFullscreenButton && (
          <ToolbarAction
            label="Fullscreen"
            icon={Fullscreen}
            onClick={() => onExpand()}
          />
        )}
        {showCloseFullscreenButton && (
          <ToolbarAction
            label="Close fullscreen"
            icon={FullscreenExit}
            onClick={() => onCollapse()}
          />
        )}
      </StyledToolbar>
    </StyledToolbarWrapper>
  )

  return (
    <>
      <div
        ref={anchorRef}
        style={{
          position: "absolute",
          visibility: "hidden",
        }}
      />

      {/* Fullscreen uses native positioning; standard mode uses a fixed overlay. */}
      {isFullScreen ? (
        toolbar
      ) : parentRect ? (
        <div
          data-testid="stElementToolbarWrapper"
          style={{
            position: "fixed",
            top: `${parentRect.top}px`,
            left: `${parentRect.left}px`,
            width: `${parentRect.width}px`,
            height: `${parentRect.height}px`,
            pointerEvents: "none",
            zIndex: "auto",
          }}
        >
          {toolbar}
        </div>
      ) : null}
    </>
  )
}

export default Toolbar
