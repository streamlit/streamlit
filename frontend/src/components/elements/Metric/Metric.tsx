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
import { Theme } from "src/theme"
import { useTheme } from "emotion-theming"
import {
  MetricText,
  MetricLabelText,
  MetricValueText,
  MetricDeltaText,
} from "./styled-components"

export interface MetricProps {
  element: MetricProto
}

export default function Metric({ element }: MetricProps): ReactElement {
  const { colors }: Theme = useTheme()
  const { MetricColor, MetricDirection } = MetricProto

  let direction = ""
  let color = ""
  const stRed = colors.red
  const stGreen = colors.green

  switch (element.color) {
    case MetricColor.RED:
      color = stRed
      break
    case MetricColor.GREEN:
      color = stGreen
      break
    case MetricColor.GRAY:
      color = colors.gray
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

  switch (element.direction) {
    case MetricDirection.DOWN:
      direction = "▼"
      break
    case MetricDirection.UP:
      direction = "▲"
      break
    case MetricDirection.NONE:
      direction = ""
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
    <div data-testid="metric-container">
      <MetricLabelText data-testid="stMetricLabel">
        <MetricText> {element.label} </MetricText>
      </MetricLabelText>
      <MetricValueText data-testid="stMetricValue">
        <MetricText> {element.body} </MetricText>
      </MetricValueText>
      <MetricDeltaText data-testid="stMetricDelta" style={deltaProp}>
        <MetricText> {direction + element.delta} </MetricText>
      </MetricDeltaText>
    </div>
  )
}
