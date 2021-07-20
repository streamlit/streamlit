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
import { Metric as MetricProto } from "src/autogen/proto"
import ErrorElement from "src/components/shared/ErrorElement"
import { StyledText, StyledText2, DeltaText } from "./styled-components"

export interface MetricProps {
  element: MetricProto
}

export default function Metric({ element }: MetricProps): ReactElement {
  let direction = ""
  let color = ""

  switch (element.deltaColors) {
    case 0:
      color = "#ff4b4b"
      direction = "▼ "
      break
    case 1:
      color = "#09ab3b"
      direction = "▼ "
      break
    case 2:
      direction = "▼ "
      color = "grey"
      break
    case 3:
      direction = "▲ "
      color = "#09ab3b"
      break
    case 4:
      direction = "▲ "
      color = "#ff4b4b"
      break
    case 5:
      direction = "▲ "
      color = "grey"
      break
    case 6:
      direction = ""
      color = "grey"
      break
    default:
      return (
        <ErrorElement
          name={"Uh oh something broke"}
          message={
            "Please use inverse, off, None, or normal with any capitalization"
          }
        />
      )
      break
  }
  const deltaProp = { color }
  return (
    <div>
      <StyledText data-testid="stMetricLabel"> {element.label} </StyledText>
      <StyledText2 data-testid="stMetricValue"> {element.body} </StyledText2>
      <DeltaText data-testid="stMetricDelta" style={deltaProp}>
        {direction + element.delta}
      </DeltaText>
    </div>
  )
}
