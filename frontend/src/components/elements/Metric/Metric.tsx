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
import { StyledText, StyledText2 } from "./styled-components"
import ErrorElement from "src/components/shared/ErrorElement"

export interface MetricProps {
  width: number
  element: MetricProto
}

export default function Metric({ width, element }: MetricProps): ReactElement {
  const styleProp = { width }

  var direction = ""
  var color = ""

  switch (element.deltaColors) {
    //red
    case 0:
      color = "green"
      direction = "▲"
      break
    case 1:
      color = "red"
      direction = "▼"
      break
    case 2:
      direction = "▼"
      color = "grey"
      break
    case 3:
      direction = "▲"
      color = "grey"
      break
    case 4:
      direction = ""
      color = "grey"
      element.delta = ""
      break
    case 5:
      return (
        <ErrorElement
          name={"Not Accepted Delta Color Value Error"}
          message={
            "Please use inverse, off, None, or normal with any capitalization"
          }
        />
      )
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

  console.log("direction = " + direction)
  console.log("color = " + color)
  const deltaProp = { width, color }
  return (
    <div text-align="center">
      <StyledText data-testid="stMetricLabel" style={styleProp}>
        {element.title}
      </StyledText>
      <StyledText2 data-testid="stMetricValue" style={styleProp}>
        {element.body}
      </StyledText2>
      <span
        data-testid="stMetricDelta"
        font-family="IBM Plex Sans"
        style={deltaProp}
        font-size="20px"
      >
        {element.delta + direction}
      </span>
    </div>
  )
}
