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

import React, { ReactElement } from "react"
import { Map as ImmutableMap } from "immutable"
import { dispatchOneOf } from "lib/immutableProto"
import withFullScreenWrapper from "hocs/withFullScreenWrapper"
import Plot from "react-plotly.js"

export interface PlotlyChartProps {
  width: number
  element: ImmutableMap<string, any>
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

  const generateSpec = (figure: ImmutableMap<string, any>): any => {
    const spec = JSON.parse(figure.get("spec"))
    const useContainerWidth = JSON.parse(element.get("useContainerWidth"))

    if (isFullScreen()) {
      spec.layout.width = propWidth
      spec.layout.height = propHeight
    } else if (useContainerWidth) {
      spec.layout.width = propWidth
    }

    return spec
  }

  const renderFigure = (figure: ImmutableMap<string, any>): ReactElement => {
    const config = JSON.parse(figure.get("config"))
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
  return dispatchOneOf(el, "chart", {
    url: (url: string) => renderIFrame(url),
    figure: (figure: ImmutableMap<string, any>) => renderFigure(figure),
  })
}

export default withFullScreenWrapper(PlotlyChart)
