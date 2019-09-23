/**
 * @license
 * Copyright 2018-2019 Streamlit Inc.
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

import React from "react"
import { Map as ImmutableMap } from "immutable"
import { dispatchOneOf } from "lib/immutableProto"
import Plot from "react-plotly.js"

interface Props {
  width: number
  element: ImmutableMap<string, any>
}

const DEFAULT_HEIGHT = 500

class PlotlyChart extends React.PureComponent<Props> {
  public render(): React.ReactNode {
    const el = this.props.element

    const height: number =
      el.get("height") > 0 ? el.get("height") : DEFAULT_HEIGHT

    const width: number =
      el.get("width") > 0 ? el.get("width") : this.props.width

    return dispatchOneOf(el, "chart", {
      url: (url: string) => this.renderIFrame(url, width, height),
      figure: (figure: ImmutableMap<string, any>) =>
        this.renderFigure(figure, width, height),
    })
  }

  private renderIFrame = (
    url: string,
    width: number,
    height: number
  ): React.ReactNode => {
    // <iframe> elements must have a unique title property
    return <iframe title="Plotly" src={url} style={{ width, height }} />
  }

  private renderFigure = (
    figure: ImmutableMap<string, any>,
    width: number,
    height: number
  ): React.ReactNode => {
    const spec = JSON.parse(figure.get("spec"))
    const config = JSON.parse(figure.get("config"))
    return (
      <Plot
        className="stPlotlyChart"
        data={spec.data}
        layout={spec.layout}
        config={config}
        frames={spec.frames}
        style={{ width, height }}
      />
    )
  }
}

export default PlotlyChart
