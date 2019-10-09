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

import React from "react"
import { embed as BokehEmbed } from "bokehjs"
import { Map as ImmutableMap } from "immutable"
import FullScreenWrapper from "components/shared/FullScreenWrapper"

interface Props {
  width: number
  element: ImmutableMap<string, any>
  index: number
}

interface PropsWithHeight extends Props {
  height: number | undefined
}

interface Dimensions {
  width: number
  height: number
}

class BokehChart extends React.PureComponent<PropsWithHeight> {
  private chartId = "bokeh-chart-" + this.props.index

  private getChartData = (): any => {
    const figure = this.props.element.get("figure")
    return JSON.parse(figure)
  }

  public getChartDimensions = (plot: any): Dimensions => {
    const width = plot.attributes.plot_width
      ? plot.attributes.plot_width
      : this.props.width
    const height = plot.attributes.plot_height
      ? plot.attributes.plot_height
      : this.props.height
      ? this.props.height
      : undefined
    return { width, height }
  }

  private updateChart = (data: any): void => {
    const chart = document.getElementById(this.chartId)

    /**
     * When you create a bokeh chart in your python script, you can specify
     * the width: p = figure(title="simple line example", x_axis_label="x", y_axis_label="y", plot_width=200);
     * In that case, the json object will contains an attribute called
     * plot_width (or plot_heigth) inside the plot reference.
     * If that values are missing, we can set that values to make the chart responsive.
     */
    const plot =
      data && data.doc && data.doc.roots && data.doc.roots.references
        ? data.doc.roots.references.find((e: any) => e.type === "Plot")
        : undefined
    if (plot) {
      const { width, height } = this.getChartDimensions(plot)
      plot.attributes.plot_width = width
      if (height !== undefined) {
        plot.attributes.plot_height = height
      }
    }

    if (chart !== null) {
      this.removeAllChildNodes(chart)
      BokehEmbed.embed_item(data, this.chartId)
    }
  }

  private removeAllChildNodes = (element: Node): void => {
    while (element.lastChild) {
      element.lastChild.remove()
    }
  }

  public componentDidMount = (): void => {
    const data = this.getChartData()
    this.updateChart(data)
  }

  public componentDidUpdate = (): void => {
    const data = this.getChartData()
    this.updateChart(data)
  }

  public render = (): React.ReactNode => (
    <div
      id={this.chartId}
      className="stBokehChart"
      style={{
        width: this.props.width,
        height: this.props.height ? this.props.height : undefined,
      }}
    />
  )
}

class WithFullScreenWrapper extends React.Component<Props> {
  render(): JSX.Element {
    const { element, index, width } = this.props
    return (
      <FullScreenWrapper width={width}>
        {({ width, height }) => (
          <BokehChart
            element={element}
            index={index}
            width={width}
            height={height}
          />
        )}
      </FullScreenWrapper>
    )
  }
}

export default WithFullScreenWrapper
