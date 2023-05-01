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

import { useTheme } from "@emotion/react"
import { Popover, PLACEMENT, ACCESSIBILITY_TYPE } from "baseui/popover"

import StreamlitMarkdown from "src/lib/components/shared/StreamlitMarkdown/StreamlitMarkdown"
import { StyledTooltipContentWrapper } from "src/lib/components/shared/Tooltip/styled-components"
import { hasLightBackgroundColor } from "src/lib/theme/utils"
import { EmotionTheme } from "src/lib/theme"

export interface TooltipProps {
  // The top position of the tooltip.
  top: number
  // The left position of the tooltip.
  left: number
  // The markdown content of the tooltip.
  content: string
  // Callback from useTooltips hook to clear the tooltip
  clearTooltip: () => void
}

/**
 * A tooltip that can be positioned anywhere on the screen.
 *
 * This is mostly the same as the shared tooltip implementation, but
 * we cannot use that one since it is a StatefulTooltip and requires
 * a target component and cannot be triggered programmatically.
 * We need to be able to position the tooltip anywhere on the screen, so we use a Popover
 * instead. Since Popover doesn't support positioning to a virtual position,
 * we are using an invisible div as a workaround.
 *
 * @param top The top position of the tooltip.
 * @param left The left position of the tooltip.
 * @param content The markdown content of the tooltip.
 * @returns The tooltip react element.
 */
function Tooltip({
  top,
  left,
  content,
  clearTooltip,
}: TooltipProps): ReactElement {
  const [open, setOpen] = React.useState(true)
  const theme: EmotionTheme = useTheme()
  const { colors, fontSizes, radii } = theme

  const closeTooltip = React.useCallback((): void => {
    setOpen(false)
    clearTooltip()
  }, [clearTooltip, setOpen])

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
      onClickOutside={closeTooltip}
      onEsc={closeTooltip}
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
        className="stTooltipTarget"
        style={{
          // This is an invisible div that's used to position the tooltip.
          // The position is provided from outside via the `top` and `left` properties.
          // This a workaround for the fact that BaseWeb's Popover  doesn't support
          // positioning to a virtual position and always requires a target
          // component for positioning.
          position: "fixed",
          top,
          left,
        }}
      ></div>
    </Popover>
  )
}

export default Tooltip
