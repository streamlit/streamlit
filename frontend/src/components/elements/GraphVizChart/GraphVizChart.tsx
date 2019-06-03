/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 */

import React from 'react'
import {PureStreamlitElement, StProps, StState} from 'components/shared/StreamlitElement/'
import {Map as ImmutableMap} from 'immutable'

import { select } from 'd3'
import { graphviz } from 'd3-graphviz'

import {logError} from 'lib/log'

interface Props extends StProps {
  element: ImmutableMap<string, any>;
  id: number;
}

// Use d3Graphviz in a dummy expression so the library actually gets loaded.
// This way it registers itself in d3 as a plugin at this point.
const _dummy_graphviz = graphviz
_dummy_graphviz  // eslint-disable-line no-unused-expressions


class GraphVizChart extends PureStreamlitElement<Props, StState> {
  private chartId: string = 'graphviz-chart-' + this.props.id
  private originalHeight: number = 0

  private getChartData = (): string => {
    return this.props.element.get('spec')
  }

  private updateChart = () => {
    try {
      // Layout and render the graph
      let graph = select('#' + this.chartId)
        .graphviz()
        .zoom(false).fit(true).scale(1)
        .renderDot(this.getChartData())
        .on('end', () => {
          let node = select(`#${this.chartId} > svg`).node() as SVGGraphicsElement
          if (node) {
            this.originalHeight = node.getBBox().height
          }
        })

      // Override or reset the graph height
      if (this.props.element.get('height')) {
        graph.height(this.props.element.get('height'))
      } else if (this.originalHeight) {
        graph.height(this.originalHeight)
      }

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
    const width: number = this.props.element.get('width') || this.props.width

    return (
      <div className="graphviz" id={this.chartId} style={{ width }} />
    )
  }
}

export default GraphVizChart
