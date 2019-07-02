/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 */

import React from 'react'
import { embed as BokehEmbed } from 'bokehjs'
import { Map as ImmutableMap } from 'immutable'

interface Props {
  width: number;
  element: ImmutableMap<string, any>;
  id: number;
}

class BokehChart extends React.PureComponent<Props> {
  private chartId = 'bokeh-chart-' + this.props.id;

  private getChartData = () => {
    const figure = this.props.element.get('figure')
    return JSON.parse(figure)
  }

  private updateChart = (data: any) => {
    const chart = document.getElementById(this.chartId)
    if (chart !== null) {
      this.removeAllChildNodes(chart)
      BokehEmbed.embed_item(data, this.chartId)
    }
  }

  private removeAllChildNodes = (element: Node) => {
    while (element.lastChild) {
      element.lastChild.remove()
    }
  }

  public componentDidMount = () => {
    const data = this.getChartData()
    this.updateChart(data)
  }

  public componentDidUpdate = () => {
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
