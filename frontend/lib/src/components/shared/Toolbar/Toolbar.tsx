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

import { ReactElement, useLayoutEffect, useRef } from "react"

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
  const wrapperRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (isFullScreen) return

    const updatePosition = (): void => {
      if (!wrapperRef.current || !anchorRef.current?.parentElement) return

      // eslint-disable-next-line streamlit-custom/no-force-reflow-access
      const rect = anchorRef.current.parentElement.getBoundingClientRect()
      wrapperRef.current.style.top = `${rect.top}px`
      wrapperRef.current.style.left = `${rect.left}px`
      wrapperRef.current.style.width = `${rect.width}px`
      wrapperRef.current.style.height = `${rect.height}px`
    }

    updatePosition()

    window.addEventListener("resize", updatePosition)
    window.addEventListener("scroll", updatePosition, true)

    let resizeObserver: ResizeObserver | null = null
    const parent = anchorRef.current?.parentElement

    if (parent) {
      resizeObserver = new ResizeObserver(updatePosition)
      resizeObserver.observe(parent)

      parent.addEventListener("mouseenter", updatePosition)
    }

    return () => {
      window.removeEventListener("resize", updatePosition)
      window.removeEventListener("scroll", updatePosition, true)
      if (parent) {
        parent.removeEventListener("mouseenter", updatePosition)
      }
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

      {isFullScreen ? (
        toolbar
      ) : (
        <div
          ref={wrapperRef}
          data-testid="stElementToolbarWrapper"
          style={{
            position: "fixed",
            pointerEvents: "none",
            zIndex: "auto",
          }}
        >
          {toolbar}
        </div>
      )}
    </>
  )
}

export default Toolbar
