/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 */

import React from 'react'
// @ts-ignore
import {Slider as UISlider} from 'baseui/slider';
import { Map as ImmutableMap } from 'immutable'
import { PureStreamlitElement, StState } from 'components/shared/StreamlitElement/'
import './Slider.scss'

interface Props {
  element: ImmutableMap<string, any>;
  sendBackMsg: (msg: Object) => void;
  width: number;
}

interface State extends StState {
  value: number[];
}

class Slider extends PureStreamlitElement<Props, State> {
  private widgetId: string

  public constructor(props: Props) {
    super(props)

    this.widgetId = this.props.element.get('id')

    const value = this.props.element.get('value')
    this.state = { value: [value] }
  }

  private handleChange = (e: any) => {
    this.setState({ value: e.value })
    this.props.sendBackMsg({
      type: 'widgetJson',
      widgetJson: JSON.stringify({ [this.widgetId]: e.value[0] })
    })
  }

  public safeRender(): React.ReactNode {
    const widgetId = this.props.element.get('id')
    const label = this.props.element.get('label')
    const min = this.props.element.get('min')
    const max = this.props.element.get('max')
    const step = this.props.element.get('step')
    const style = { width: this.props.width }

    return (
      <div className="Widget stSlider" style={style}>
        <p className="label">{label}: {this.state.value}</p>
        <UISlider
          id={widgetId}
          min={min}
          max={max}
          step={step}
          value={this.state.value}
          onChange={this.handleChange}
        />
      </div>
    )
  }
}

export default Slider
