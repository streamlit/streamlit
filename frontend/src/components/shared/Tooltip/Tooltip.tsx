import React, { ReactElement, ReactNode } from "react"
import { useTheme } from "@emotion/react"
import { Theme, hasLightBackgroundColor } from "src/theme"
import { StatefulTooltip, ACCESSIBILITY_TYPE, PLACEMENT } from "baseui/tooltip"
import { StyledTooltipContentWrapper } from "./styled-components"

export enum Placement {
  AUTO = "auto",
  TOP_LEFT = "topLeft",
  TOP = "top",
  TOP_RIGHT = "topRight",
  RIGHT_TOP = "rightTop",
  RIGHT = "right",
  RIGHT_BOTTOM = "rightBottom",
  BOTTOM_RIGHT = "bottomRight",
  BOTTOM = "bottom",
  BOTTOM_LEFT = "bottomLeft",
  LEFT_BOTTOM = "leftBottom",
  LEFT = "left",
  LEFT_TOP = "leftTop",
}

export interface TooltipProps {
  content: ReactNode
  placement: Placement
  children: ReactNode
  inline?: boolean
  style?: React.CSSProperties
}

function Tooltip({
  content,
  placement,
  children,
  inline,
  style,
}: TooltipProps): ReactElement {
  const theme: Theme = useTheme()
  const { colors, fontSizes } = theme

  return (
    <StatefulTooltip
      content={
        content ? (
          <StyledTooltipContentWrapper>{content}</StyledTooltipContentWrapper>
        ) : null
      }
      placement={PLACEMENT[placement]}
      accessibilityType={ACCESSIBILITY_TYPE.tooltip}
      showArrow={false}
      popoverMargin={10}
      overrides={{
        Body: {
          style: {
            // This is annoying, but a bunch of warnings get logged when the
            // shorthand version `borderRadius` is used here since the long
            // names are used by BaseWeb and mixing the two is apparently
            // bad :(
            borderTopLeftRadius: "0.25rem",
            borderTopRightRadius: "0.25rem",
            borderBottomLeftRadius: "0.25rem",
            borderBottomRightRadius: "0.25rem",

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
    >
      {/* BaseWeb manipulates its child, so we create a wrapper div for protection */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          justifyContent: inline ? "flex-end" : "",
          ...style,
        }}
        data-testid="tooltipHoverTarget"
      >
        {children}
      </div>
    </StatefulTooltip>
  )
}

export default Tooltip
