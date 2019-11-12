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
import FullScreenWrapper from "components/shared/FullScreenWrapper"
import Plot from "react-plotly.js"

interface Props {
  width: number
  element: ImmutableMap<string, any>
}

interface PropsWithHeight extends Props {
  height: number | undefined
}

interface Dimensions {
  width: number
  height: number
}

const DEFAULT_HEIGHT = 450

class PlotlyChart extends React.PureComponent<PropsWithHeight> {
  private forceRecreatePlotKey = 0

  public getChartDimensions = (): Dimensions => {
    const el = this.props.element

    const width: number =
      el.get("width") > 0 ? el.get("width") : this.props.width

    const height: number =
      el.get("height") > 0
        ? el.get("height")
        : this.props.height
        ? this.props.height
        : DEFAULT_HEIGHT

    return { width, height }
  }

  public render(): React.ReactNode {
    const el = this.props.element
    const { width, height } = this.getChartDimensions()

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
    spec.layout.width = width
    spec.layout.height = height

    // 2019-11-05: Re-render with a new element key to force React to
    // unmount the previous <Plot> component and create a new element from
    // scratch. Plotly charts are not always re-rendering
    // properly, per https://github.com/streamlit/streamlit/issues/512
    // This seems to be a react-plotly bug; I made a standalone repro case
    // and submitted it to them here: https://github.com/plotly/react-plotly.js/issues/167.
    // TODO: Remove this hack when the react-plotly bug is fixed!
    return (
      <Plot
        key={this.forceRecreatePlotKey++}
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

class WithFullScreenWrapper extends React.Component<Props> {
  render(): JSX.Element {
    const { element, width } = this.props
    return (
      <FullScreenWrapper width={width}>
        {({ width, height }) => (
          <PlotlyChart element={element} width={width} height={height} />
        )}
      </FullScreenWrapper>
    )
  }
}

export default WithFullScreenWrapper
