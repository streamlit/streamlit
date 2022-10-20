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

import React, { ReactElement, useEffect, useState } from "react"
import { useTheme } from "@emotion/react"
import { Theme } from "src/theme"
import {
  Figure as FigureProto,
  PlotlyChart as PlotlyChartProto,
} from "src/autogen/proto"
import withFullScreenWrapper from "src/hocs/withFullScreenWrapper"
import Plot from "react-plotly.js"
import { applyStreamlitTheme, layoutWithThemeDefaults } from "./CustomTheme"

export interface PlotlyChartProps {
  width: number
  element: PlotlyChartProto
  height: number | undefined
}

export interface PlotlyIFrameProps {
  width: number
  height: number | undefined
  url: string
}

export const DEFAULT_HEIGHT = 450

function renderIFrame({
  url,
  width,
  height: propHeight,
}: PlotlyIFrameProps): ReactElement {
  const height = propHeight || DEFAULT_HEIGHT
  return <iframe title="Plotly" src={url} style={{ width, height }} />
}

function renderFigure({
  element,
  width,
  height,
}: PlotlyChartProps): ReactElement {
  const figure = element.figure as FigureProto
  const isFullScreen = (): boolean => !!height

  const theme: Theme = useTheme()

  const generateSpec = (figure: FigureProto): any => {
    const spec = JSON.parse(figure.spec)

    if (isFullScreen()) {
      spec.layout.width = width
      spec.layout.height = height
    } else if (element.useContainerWidth) {
      spec.layout.width = width
    }
    // applyTheme(element.theme)
    if (element.theme === "streamlit") {
      applyStreamlitTheme(spec, theme)
    } else {
      // Apply minor theming improvements to work better with Streamlit
      spec.layout = layoutWithThemeDefaults(spec.layout, theme)
    }

    return spec
  }

  const [config, setConfig] = useState(JSON.parse(figure.config))
  const [spec, setSpec] = useState(generateSpec(figure))

  // Update config and spec references iff the theme or props change
  useEffect(() => {
    setConfig(JSON.parse(figure.config))
    setSpec(generateSpec(figure))
  }, [element, theme, height, width])

  const { data, layout, frames } = spec

  return (
    <Plot
      key={isFullScreen() ? "fullscreen" : "original"}
      className="stPlotlyChart"
      data={data}
      layout={layout}
      config={config}
      frames={frames}
    />
  )
}

export function PlotlyChart({
  width,
  element,
  height,
}: PlotlyChartProps): ReactElement {
  switch (element.chart) {
    case "url":
      return renderIFrame({
        url: element.url as string,
        height,
        width,
      })
    case "figure":
      return renderFigure({ element, height, width })
    default:
      throw new Error(`Unrecognized PlotlyChart type: ${element.chart}`)
  }
}

export default withFullScreenWrapper(PlotlyChart)
