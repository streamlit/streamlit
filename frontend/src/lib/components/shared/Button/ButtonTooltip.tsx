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
import TooltipIcon from "src/lib/components/shared/TooltipIcon"
import { Placement } from "src/lib/components/shared/Tooltip"
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
