/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 */

import React from 'react'
import { Map as ImmutableMap } from 'immutable'
import { embed as BokehEmbed } from 'bokehjs'
import { PureStreamlitElement } from 'components/shared/StreamlitElement/'

interface Props {
  element: ImmutableMap<string, any>;
  id: number;
  width: number;
}

class BokehChart extends PureStreamlitElement<Props> {
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

  public safeRender = (): React.ReactNode => (
    <div id={this.chartId} style={{ width: this.props.width }}></div>
  )
}

export default BokehChart
