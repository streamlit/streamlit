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

interface Props {
  width: number
  element: ImmutableMap<string, any>
  index: number
}

class BokehChart extends React.PureComponent<Props> {
  private chartId = "bokeh-chart-" + this.props.index

  private getChartData = (): any => {
    const figure = this.props.element.get("figure")
    return JSON.parse(figure)
  }

  private updateChart = (data: any): void => {
    const chart = document.getElementById(this.chartId)
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
      style={{ width: this.props.width }}
    />
  )
}

export default BokehChart
