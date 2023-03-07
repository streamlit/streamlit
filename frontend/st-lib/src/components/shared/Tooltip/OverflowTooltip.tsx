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
