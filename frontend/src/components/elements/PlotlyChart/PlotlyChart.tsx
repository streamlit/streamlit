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

import React, { ReactNode, PureComponent } from "react"
import { Map as ImmutableMap } from "immutable"
import { dispatchOneOf } from "lib/immutableProto"
import withFullScreenWrapper from "hocs/withFullScreenWrapper"
import Plot from "react-plotly.js"

interface Props {
  width: number
  element: ImmutableMap<string, any>
}

export interface PropsWithHeight extends Props {
  height: number | undefined
}

export const DEFAULT_HEIGHT = 450

export class PlotlyChart extends PureComponent<PropsWithHeight> {
  public render(): ReactNode {
    const el = this.props.element
    return dispatchOneOf(el, "chart", {
      url: (url: string) => this.renderIFrame(url),
      figure: (figure: ImmutableMap<string, any>) => this.renderFigure(figure),
    })
  }

  private renderIFrame = (url: string): React.ReactNode => {
    const width = this.props.width
    const height = this.props.height ? this.props.height : DEFAULT_HEIGHT
    return <iframe title="Plotly" src={url} style={{ width, height }} />
  }

  private isFullScreen = (): boolean => !!this.props.height

  private generateSpec = (figure: ImmutableMap<string, any>): any => {
    const { element, height, width } = this.props
    const spec = JSON.parse(figure.get("spec"))
    const useContainerWidth = JSON.parse(element.get("useContainerWidth"))

    if (this.isFullScreen()) {
      spec.layout.width = width
      spec.layout.height = height
    } else if (useContainerWidth) {
      spec.layout.width = width
    }

    return spec
  }

  private renderFigure = (
    figure: ImmutableMap<string, any>
  ): React.ReactNode => {
    const config = JSON.parse(figure.get("config"))
    const { data, layout, frames } = this.generateSpec(figure)

    return (
      <Plot
        key={this.isFullScreen() ? "fullscreen" : "original"}
        className="stPlotlyChart"
        data={data}
        layout={layout}
        config={config}
        frames={frames}
      />
    )
  }
}

export default withFullScreenWrapper(PlotlyChart)
