import React, { ReactElement } from "react"
import TooltipIcon from "src/components/shared/TooltipIcon"
import { Placement } from "src/components/shared/Tooltip"
import { StyledTooltipNormal, StyledTooltipMobile } from "./styled-components"

interface Props {
  children: ReactElement
  help?: string
}

export function ButtonTooltip({ children, help }: Props): ReactElement {
  if (!help) {
    return children
  }
  return (
    <div className="stTooltipIcon">
      <StyledTooltipNormal>
        <TooltipIcon content={help} placement={Placement.TOP}>
          {children}
        </TooltipIcon>
      </StyledTooltipNormal>
      <StyledTooltipMobile>{children}</StyledTooltipMobile>
    </div>
  )
}
