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
import { Map as ImmutableMap } from "immutable"
import { select } from "d3"
import { graphviz } from "d3-graphviz"
import { logError } from "lib/log"
import "./GraphVizChart.scss"

interface Props {
  width: number
  element: ImmutableMap<string, any>
  index: number
}

// Use d3Graphviz in a dummy expression so the library actually gets loaded.
// This way it registers itself in d3 as a plugin at this point.
const _dummy_graphviz = graphviz
_dummy_graphviz // eslint-disable-line no-unused-expressions

class GraphVizChart extends React.PureComponent<Props> {
  private chartId: string = "graphviz-chart-" + this.props.index
  private originalHeight = 0

  private getChartData = (): string => {
    return this.props.element.get("spec")
  }

  private updateChart = () => {
    try {
      // Layout and render the graph
      const graph = select("#" + this.chartId)
        .graphviz()
        .zoom(false)
        .fit(true)
        .scale(1)
        .renderDot(this.getChartData())
        .on("end", () => {
          const node = select(
            `#${this.chartId} > svg`
          ).node() as SVGGraphicsElement
          if (node) {
            this.originalHeight = node.getBBox().height
          }
        })

      // Override or reset the graph height
      if (this.props.element.get("height")) {
        graph.height(this.props.element.get("height"))
      } else if (this.originalHeight) {
        graph.height(this.originalHeight)
      }
    } catch (error) {
      logError(error)
    }
  }

  public componentDidMount = () => {
    this.updateChart()
  }

  public componentDidUpdate = () => {
    this.updateChart()
  }

  public render = (): React.ReactNode => {
    const width: number = this.props.element.get("width") || this.props.width

    return (
      <div
        className="graphviz stGraphVizChart"
        id={this.chartId}
        style={{ width }}
      />
    )
  }
}

export default GraphVizChart
