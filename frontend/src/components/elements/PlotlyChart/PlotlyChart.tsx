
/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 */

import React from 'react'
import {Map as ImmutableMap} from 'immutable'
import {dispatchOneOf} from 'lib/immutableProto'
import {PureStreamlitElement, StProps, StState} from 'components/shared/StreamlitElement/'
import Plot from 'react-plotly.js'

interface Props extends StProps {
  element: ImmutableMap<string, any>;
}

const DEFAULT_HEIGHT = 500

class PlotlyChart extends PureStreamlitElement<Props, StState> {
  public safeRender(): React.ReactNode {
    const el = this.props.element

    const height: number =
        el.get('height') > 0 ? el.get('height') : DEFAULT_HEIGHT

    const width: number =
        el.get('width') > 0 ? el.get('width') : this.props.width

    return dispatchOneOf(el, 'chart', {
      url: (url: string) => this.renderIFrame(url, width, height),
      figure: (figure: ImmutableMap<string, any>) =>
        this.renderFigure(figure, width, height),
    })
  }

  private renderIFrame = (
    url: string,
    width: number,
    height: number,
  ): React.ReactNode => {
    // <iframe> elements must have a unique title property
    return (
      <iframe
        title="Plotly"
        src={url}
        style={{width, height}}
      />
    )
  }

  private renderFigure = (
    figure: ImmutableMap<string, any>,
    width: number,
    height: number,
  ): React.ReactNode => {
    const spec = JSON.parse(figure.get('spec'))
    const config = JSON.parse(figure.get('config'))
    return (
      <Plot
        className="stPlotlyChart"
        data={spec.data}
        layout={spec.layout}
        config={config}
        frames={spec.frames}
        style={{width, height}}
      />
    )
  }
}

export default PlotlyChart
