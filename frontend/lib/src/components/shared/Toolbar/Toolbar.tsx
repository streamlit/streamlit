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

import type { ReactElement } from "react"

import type { EmotionIcon } from "@emotion-icons/emotion-icon"
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

/**
 * Compose an icon-only toolbar button's accessible name.
 * The tooltip and visible label stay as `label`. When `labelContext` is
 * non-blank, aria-label becomes `{label}: {context}`
 * (e.g. "Fullscreen: Revenue table").
 */
function toolbarActionAriaLabel(label: string, labelContext?: string): string {
  const context = labelContext?.trim()
  return context ? `${label}: ${context}` : label
}

export interface ToolbarActionProps {
  label: string
  icon?: EmotionIcon
  show_label?: boolean
  onClick: () => void
  /** Element name composed into aria-label only (not the tooltip). */
  labelContext?: string
}

export function ToolbarAction({
  label,
  show_label,
  icon,
  onClick,
  labelContext,
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
        closeDelay={0}
        dismissOnClick
        interactive={false}
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
          aria-label={toolbarActionAriaLabel(label, labelContext)}
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
  /**
   * Element name composed into Fullscreen / Close fullscreen aria-labels.
   * Child ToolbarActions must pass the same prop.
   */
  labelContext?: string
}

const Toolbar: React.FC<React.PropsWithChildren<ToolbarProps>> = ({
  onExpand,
  onCollapse,
  isFullScreen,
  locked,
  children,
  target,
  disableFullscreenMode,
  labelContext,
}): ReactElement => {
  const showFullscreenButton =
    onExpand && !disableFullscreenMode && !isFullScreen
  const showCloseFullscreenButton =
    onCollapse && !disableFullscreenMode && isFullScreen

  return (
    <StyledToolbarWrapper
      className="stElementToolbar"
      data-testid="stElementToolbar"
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- a false locked flag still locks in fullscreen
      locked={locked || isFullScreen}
      target={target}
    >
      <StyledToolbar data-testid="stElementToolbarButtonContainer">
        {children}
        {showFullscreenButton && (
          <ToolbarAction
            label="Fullscreen"
            icon={Fullscreen}
            onClick={() => onExpand()}
            labelContext={labelContext}
          />
        )}
        {showCloseFullscreenButton && (
          <ToolbarAction
            label="Close fullscreen"
            icon={FullscreenExit}
            onClick={() => onCollapse()}
            labelContext={labelContext}
          />
        )}
      </StyledToolbar>
    </StyledToolbarWrapper>
  )
}

export default Toolbar
