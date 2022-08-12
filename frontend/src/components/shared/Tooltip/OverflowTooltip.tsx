import React, { ReactNode, ReactElement, useState } from "react"

import Tooltip, { Placement } from "./Tooltip"
import { StyledWrapper, StyledEllipsizedDiv } from "./styled-components"

export interface OverflowTooltipProps {
  content: ReactNode
  placement: Placement
  children: ReactNode
  inline?: boolean
  style?: React.CSSProperties
}

/**
 * Tooltip that only shows when the children are overflowing (in which case,
 * this also ellipsizes the children).
 */
function OverflowTooltip({
  content,
  placement,
  children,
  inline,
  style,
}: OverflowTooltipProps): ReactElement {
  const childRef = React.useRef<HTMLDivElement>(null)
  const [allowTooltip, setAllowTooltip] = useState(false)

  React.useEffect(() => {
    const newAllowTooltip = childRef?.current
      ? childRef.current.offsetWidth < childRef.current.scrollWidth
      : false
    if (newAllowTooltip !== allowTooltip) {
      setAllowTooltip(newAllowTooltip)
    }
  }, [children, allowTooltip])

  return (
    <Tooltip
      content={allowTooltip ? content : ""}
      placement={placement}
      inline={inline}
    >
      <StyledWrapper>
        <StyledEllipsizedDiv ref={childRef} style={style}>
          {children}
        </StyledEllipsizedDiv>
      </StyledWrapper>
    </Tooltip>
  )
}

export default OverflowTooltip
