/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { ReactElement } from "react"
import { Metrics as MetricsProto } from "src/autogen/proto"
import { StyledText, StyledText2 } from "./styled-components"

export interface MetricsProps {
  width: number
  element: MetricsProto
}

export default function Metrics({
  width,
  element,
}: MetricsProps): ReactElement {
  const styleProp = { width }
  /*if element.delta_colors == 0:
  elif element.delta_colors == 1:
  else:*/
  return (
    <div>
      <StyledText data-testid="stMetrics" style={styleProp}>
        {element.title}
      </StyledText>
      <StyledText2 data-testid="stMetrics" style={styleProp}>
        {element.body}
      </StyledText2>
      <StyledText data-testid="stMetrics" style={styleProp}>
        {element.delta}
      </StyledText>
    </div>
  )
}
