/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
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

/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 */

import { IFigure, IPlotlyChart } from "autogen/proto"
import withFullScreenWrapper from "hocs/withFullScreenWrapper"
import { requireNonNull } from "lib/utils"
import React, { ReactElement } from "react"
import Plot from "react-plotly.js"

export interface PlotlyChartProps {
  width: number
  element: IPlotlyChart
  height: number | undefined
}

export const DEFAULT_HEIGHT = 450

export function PlotlyChart({
  width: propWidth,
  element,
  height: propHeight,
}: PlotlyChartProps): ReactElement {
  const el = element

  const renderIFrame = (url: string): ReactElement => {
    const height = propHeight || DEFAULT_HEIGHT
    const width = propWidth
    return <iframe title="Plotly" src={url} style={{ width, height }} />
  }

  const isFullScreen = (): boolean => !!propHeight

  const generateSpec = (figure: IFigure): any => {
    const spec = JSON.parse(requireNonNull(figure.spec))
    const useContainerWidth = requireNonNull(element.useContainerWidth)

    if (isFullScreen()) {
      spec.layout.width = propWidth
      spec.layout.height = propHeight
    } else if (useContainerWidth) {
      spec.layout.width = propWidth
    }

    return spec
  }

  const renderFigure = (figure: IFigure): ReactElement => {
    const config = JSON.parse(requireNonNull(figure.config))
    const { data, layout, frames } = generateSpec(figure)

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

  if (el.url != null) {
    return renderIFrame(el.url)
  }

  if (el.figure != null) {
    return renderFigure(el.figure)
  }

  throw new Error(`Unrecognized PlotlyChart type: ${el}`)
}

export default withFullScreenWrapper(PlotlyChart)
