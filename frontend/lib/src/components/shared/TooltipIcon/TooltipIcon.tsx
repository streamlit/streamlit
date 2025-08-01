/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import React, { ReactElement, ReactNode } from "react"

import { HelpCircle as HelpCircleIcon } from "react-feather"

import StreamlitMarkdown, {
  StreamlitMarkdownProps,
} from "~lib/components/shared/StreamlitMarkdown"
import Tooltip, { Placement } from "~lib/components/shared/Tooltip"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { convertRemToPx } from "~lib/theme"

import {
  StyledLabelHelpInline,
  StyledTooltipIconWrapper,
} from "./styled-components"

export interface TooltipIconProps {
  placement?: Placement
  isLatex?: boolean
  content: string
  children?: ReactNode
  markdownProps?: Partial<StreamlitMarkdownProps>
  onMouseEnterDelay?: number
  containerWidth?: boolean
}

function TooltipIcon({
  placement = Placement.AUTO,
  isLatex = false,
  content,
  children,
  markdownProps,
  onMouseEnterDelay,
  containerWidth = false,
}: TooltipIconProps): ReactElement {
  const theme = useEmotionTheme()
  return (
    <StyledTooltipIconWrapper
      className="stTooltipIcon"
      data-testid="stTooltipIcon"
      isLatex={isLatex}
    >
      <Tooltip
        content={
          <StreamlitMarkdown
            style={{ fontSize: theme.fontSizes.sm }}
            source={content}
            allowHTML={false}
            {...(markdownProps || {})}
          />
        }
        placement={placement}
        onMouseEnterDelay={onMouseEnterDelay}
        inline
        containerWidth={containerWidth}
      >
        {children || (
          <HelpCircleIcon
            className="icon"
            /* Convert size to px because using rem works but logs a console error (at least on webkit) */
            size={convertRemToPx(theme.iconSizes.base)}
          />
        )}
      </Tooltip>
    </StyledTooltipIconWrapper>
  )
}

export const InlineTooltipIcon = ({
  placement = Placement.TOP_RIGHT,
  isLatex = false,
  content,
  children,
  markdownProps,
}: TooltipIconProps): ReactElement => {
  return (
    <StyledLabelHelpInline>
      <TooltipIcon
        placement={placement}
        isLatex={isLatex}
        content={content}
        markdownProps={markdownProps}
      >
        {children}
      </TooltipIcon>
    </StyledLabelHelpInline>
  )
}

export default TooltipIcon
