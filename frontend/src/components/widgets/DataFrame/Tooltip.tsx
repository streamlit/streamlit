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

import StreamlitMarkdown from "src/components/shared/StreamlitMarkdown/StreamlitMarkdown"
import { StyledTooltipContentWrapper } from "src/components/shared/Tooltip/styled-components"
import { Popover, PLACEMENT, ACCESSIBILITY_TYPE } from "baseui/popover"
import { hasLightBackgroundColor } from "src/theme/utils"

import { useTheme } from "@emotion/react"

import { EmotionTheme } from "src/theme"

export interface TooltipProps {
  top: number
  left: number
  content: string
}

function Tooltip({ top, left, content }: TooltipProps): ReactElement {
  const [open, setOpen] = React.useState(true)
  const theme: EmotionTheme = useTheme()
  const { colors, fontSizes, radii } = theme

  return (
    <Popover
      content={
        <StyledTooltipContentWrapper className="stTooltipContent">
          <StreamlitMarkdown
            style={{ fontSize: fontSizes.sm }}
            source={content}
            allowHTML={false}
          />
        </StyledTooltipContentWrapper>
      }
      placement={PLACEMENT.top}
      accessibilityType={ACCESSIBILITY_TYPE.tooltip}
      showArrow={false}
      popoverMargin={5}
      onClickOutside={() => setOpen(false)}
      onEsc={() => setOpen(false)}
      overrides={{
        Body: {
          style: {
            // This is annoying, but a bunch of warnings get logged when the
            // shorthand version `borderRadius` is used here since the long
            // names are used by BaseWeb and mixing the two is apparently
            // bad :(
            borderTopLeftRadius: radii.md,
            borderTopRightRadius: radii.md,
            borderBottomLeftRadius: radii.md,
            borderBottomRightRadius: radii.md,

            paddingTop: "0 !important",
            paddingBottom: "0 !important",
            paddingLeft: "0 !important",
            paddingRight: "0 !important",

            backgroundColor: "transparent",
          },
        },
        Inner: {
          style: {
            backgroundColor: hasLightBackgroundColor(theme)
              ? colors.bgColor
              : colors.secondaryBg,
            color: colors.bodyText,
            fontSize: fontSizes.sm,
            fontWeight: "normal",
            // See the long comment about `borderRadius`. The same applies here
            // to `padding`.
            paddingTop: "0 !important",
            paddingBottom: "0 !important",
            paddingLeft: "0 !important",
            paddingRight: "0 !important",
          },
        },
      }}
      isOpen={open}
    >
      <div
        style={{
          position: "fixed",
          top,
          left,
        }}
      ></div>
    </Popover>
  )
}

export default Tooltip
