/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 */

import React from 'react'
import {PureStreamlitElement, StProps, StState} from 'components/shared/StreamlitElement/'
import {Map as ImmutableMap} from 'immutable'

import {select} from 'd3'
import {layout} from 'dagre'
import {render} from 'dagre-d3'
import {read} from 'graphlib-dot'

import {logError} from 'lib/log'

import './GraphVizChart.scss'

interface Props extends StProps {
  element: ImmutableMap<string, any>;
  id: number;
}

const DEFAULT_HEIGHT = 300

class GraphVizChart extends PureStreamlitElement<Props, StState> {
  private chartId = 'graphviz-chart-' + this.props.id;

  private getChartData = (): string => {
    return this.props.element.get('spec')
  }

  private updateChart = () => {
    try {
      const graph = read(this.getChartData())

      // @ts-ignore
      layout(graph)

      const element = select('#' + this.chartId + '-g')

      // @ts-ignore
      new render()(element, graph)
    } catch (error) {
      logError(error)
    }
  }

  public safeComponentDidMount = () => {
    this.updateChart()
  }

  public safeComponentDidUpdate = () => {
    this.updateChart()
  }

  public safeRender = (): React.ReactNode => {
    const el = this.props.element

    const height: number =
      el.get('height') > 0 ? el.get('height') : DEFAULT_HEIGHT
    const width: number =
      el.get('width') > 0 ? el.get('width') : this.props.width

    return (
      <div id={this.chartId} className="graphviz">
        <svg style={{ width, height }}>
          <g id={this.chartId + '-g'} />
        </svg>
      </div>
    )
  }
}

export default GraphVizChart
