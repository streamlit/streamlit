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

import React, {
  ReactElement,
  useCallback,
  useLayoutEffect,
  useState,
} from "react"
import { useTheme } from "@emotion/react"
import { Theme } from "src/theme"
import {
  Figure as FigureProto,
  PlotlyChart as PlotlyChartProto,
} from "src/autogen/proto"
import withFullScreenWrapper from "src/hocs/withFullScreenWrapper"
import Plot from "react-plotly.js"
import {
  applyStreamlitTheme,
  layoutWithThemeDefaults,
  replaceTemporaryColors,
} from "./CustomTheme"

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

function isFullScreen(height: number | undefined): boolean {
  return !!height
}

/** Render an iframed Plotly chart from a URL */
function renderIFrame({
  url,
  width,
  height: propHeight,
}: PlotlyIFrameProps): ReactElement {
  const height = propHeight || DEFAULT_HEIGHT
  return <iframe title="Plotly" src={url} style={{ width, height }} />
}

/** Render a Plotly chart from a FigureProto */
function PlotlyFigure({
  element,
  width,
  height,
}: PlotlyChartProps): ReactElement {
  const figure = element.figure as FigureProto

  const theme: Theme = useTheme()

  const generateSpec = useCallback((): any => {
    const spec = JSON.parse(
      replaceTemporaryColors(figure.spec, theme, element.theme)
    )
    const initialHeight = spec.layout.height
    const initialWidth = spec.layout.width

    if (isFullScreen(height)) {
      spec.layout.width = width
      spec.layout.height = height
    } else if (element.useContainerWidth) {
      spec.layout.width = width
    } else {
      spec.layout.width = initialWidth
      spec.layout.height = initialHeight
    }
    if (element.theme === "streamlit") {
      applyStreamlitTheme(spec, theme)
    } else {
      // Apply minor theming improvements to work better with Streamlit
      spec.layout = layoutWithThemeDefaults(spec.layout, theme)
    }

    return spec
  }, [
    element.theme,
    element.useContainerWidth,
    figure.spec,
    height,
    theme,
    width,
  ])

  const [config, setConfig] = useState(JSON.parse(figure.config))
  const [spec, setSpec] = useState(generateSpec())

  // Update config and spec references iff the theme or props change
  // Use useLayoutEffect to synchronize rerender by updating state
  // More information: https://kentcdodds.com/blog/useeffect-vs-uselayouteffect
  useLayoutEffect(() => {
    setConfig(JSON.parse(figure.config))
    setSpec(generateSpec())
  }, [element, theme, height, width, figure.config, generateSpec])

  const { data, layout, frames } = spec

  return (
    <Plot
      key={isFullScreen(height) ? "fullscreen" : "original"}
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
      return <PlotlyFigure width={width} element={element} height={height} />
    default:
      throw new Error(`Unrecognized PlotlyChart type: ${element.chart}`)
  }
}

export default withFullScreenWrapper(PlotlyChart)
