import React, { ReactElement, ReactNode } from "react"
import { StatefulTooltip, ACCESSIBILITY_TYPE, PLACEMENT } from "baseui/tooltip"

export enum Placement {
  AUTO = "auto",
  TOPLEFT = "topLeft",
  TOP = "top",
  TOPRIGHT = "topRight",
  RIGHTTOP = "rightTop",
  RIGHT = "right",
  RIGHTBOTTOM = "rightBottom",
  BOTTOMRIGHT = "bottomRight",
  BOTTOM = "bottom",
  BOTTOMLEFT = "bottomLeft",
  LEFTBOTTOM = "leftBottom",
  LEFT = "left",
  LEFTTOP = "leftTop",
}

export interface TooltipProps {
  content: ReactNode
  placement: Placement
  children: ReactNode
}

function Tooltip({
  content,
  placement,
  children,
}: TooltipProps): ReactElement {
  return (
    <StatefulTooltip
      content={content}
      placement={PLACEMENT[placement]}
      accessibilityType={ACCESSIBILITY_TYPE.tooltip}
      showArrow
      overrides={{
        Arrow: {
          style: {
            backgroundColor: "black",
            opacity: 0.9,
          },
        },
        Body: {
          style: {
            backgroundColor: "black",
            borderRadius: "0.25rem",
            opacity: 0.9,
          },
        },
        Inner: {
          style: {
            backgroundColor: "transparent",
            color: "white",
            fontSize: "0.875rem",
            fontWeight: "normal",
          },
        },
      }}
    >
      {/* BaseWeb does manipulates its child, so we create a wrapper div for protection */}
      <div>{children}</div>
    </StatefulTooltip>
  )
}

export default Tooltip
