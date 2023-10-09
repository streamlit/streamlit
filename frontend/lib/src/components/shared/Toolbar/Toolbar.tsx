/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import React, { ReactElement } from "react"

import { EmotionIcon } from "@emotion-icons/emotion-icon"
import { useTheme } from "@emotion/react"
import { Fullscreen, FullscreenExit } from "@emotion-icons/material-outlined"

import StreamlitMarkdown from "@streamlit/lib/src/components/shared/StreamlitMarkdown"
import Tooltip, {
  Placement,
} from "@streamlit/lib/src/components/shared/Tooltip"
import Button, {
  BaseButtonKind,
} from "@streamlit/lib/src/components/shared/BaseButton"
import Icon from "@streamlit/lib/src/components/shared/Icon"
import { EmotionTheme } from "@streamlit/lib/src/theme"

import { StyledToolbar } from "./styled-components"

interface ToolbarActionProps {
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
  const theme: EmotionTheme = useTheme()
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
        >
          {icon && <Icon content={icon} size="md" />}
          {displayLabel && <span>{displayLabel}</span>}
        </Button>
      </Tooltip>
    </div>
  )
}

export interface ToolbarProps {
  onExpand?: () => void
  onCollapse?: () => void
  isFullscreen?: boolean
}

const Toolbar: React.FC<ToolbarProps> = ({
  onExpand,
  onCollapse,
  isFullscreen,
  children,
}): ReactElement => {
  return (
    <StyledToolbar
      isFullscreen={isFullscreen}
      className={"stElementToolbar"}
      data-testid={"stElementToolbar"}
    >
      {children}
      {onExpand && !isFullscreen && (
        <ToolbarAction
          label={"Open in fullscreen"}
          icon={Fullscreen}
          onClick={() => onExpand()}
        />
      )}
      {onCollapse && isFullscreen && (
        <ToolbarAction
          label={"Close fullscreen"}
          icon={FullscreenExit}
          onClick={() => onCollapse()}
        />
      )}
    </StyledToolbar>
  )
}

export default Toolbar
