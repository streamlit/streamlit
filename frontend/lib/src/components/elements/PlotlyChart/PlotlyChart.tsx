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
import { EmotionTheme } from "@streamlit/lib/src/theme"
import {
  Figure as FigureProto,
  PlotlyChart as PlotlyChartProto,
} from "@streamlit/lib/src/proto"
import withFullScreenWrapper from "@streamlit/lib/src/hocs/withFullScreenWrapper"
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
  return (
    <iframe
      data-testid="stPlotlyChart"
      title="Plotly"
      src={url}
      style={{ width, height }}
    />
  )
}

/** Render a Plotly chart from a FigureProto */
function PlotlyFigure({
  element,
  width,
  height,
}: PlotlyChartProps): ReactElement {
  const figure = element.figure as FigureProto

  const theme: EmotionTheme = useTheme()

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

  try {
    // console.log(`stPlotlyChart-${element.id}`)
    const myPlot = document.getElementById(`stPlotlyChart-${element.id}`)
    console.log(myPlot)
    console.log(Object.getOwnPropertyNames(myPlot))

    // @ts-expect-error
    myPlot.on("plotly_click", function (data) {
      let pts = ""
      for (let i = 0; i < data.points.length; i++) {
        pts =
          "x = " +
          data.points[i].x +
          "\ny = " +
          data.points[i].y.toPrecision(4) +
          "\n\n"
      }
      alert("Closest point clicked:\n\n" + pts)
    })
  } catch (e) {
    console.log(e)
  }

  return (
    <div data-testid="stPlotlyChart">
      <Plot
        divId={`stPlotlyChart-${element.id}`}
        key={isFullScreen(height) ? "fullscreen" : "original"}
        className="stPlotlyChart"
        data={data}
        layout={layout}
        config={config}
        frames={frames}
        // onClick={e => {

        //   console.log(e)
        //   console.log(e.points[0])
        //   console.log(e.points[0].data)
        //   console.log(e.points[0].customdata)
        //   console.log(Object.hasOwn(e.points[0], "marker.size"))
        //   console.log(
        //     // @ts-expect-error
        //     `You have clicked: x: ${e.points[0].x}, y: ${e.points[0].y}, marker.size: ${e.points[0]["marker.size"]}, hoverText: ${e.points[0].hovertext}`
        //   )
        // }}
      />
    </div>
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
