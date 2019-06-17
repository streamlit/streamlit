/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 */

import React from 'react'
import { Input, Label } from 'reactstrap'
import { Map as ImmutableMap } from 'immutable'
import { PureStreamlitElement, StState } from 'components/shared/StreamlitElement/'
import './Slider.scss'

interface Props {
  element: ImmutableMap<string, any>;
  sendBackMsg: (msg: Object) => void;
  width: number;
}

interface State extends StState {
  value: number;
}

class Slider extends PureStreamlitElement<Props, State> {
  public constructor(props: Props) {
    super(props)

    const value = this.props.element.get('slider').get('value')
    this.state = { value }
  }

  private handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const widgetId = e.target.id
    const value = parseInt(e.target.value, 10)

    this.setState({ value })
    this.props.sendBackMsg({
      type: 'widgetJson',
      widgetJson: JSON.stringify({ [widgetId]: value })
    })
  }

  public safeRender(): React.ReactNode {
    const widgetId = this.props.element.get('id')
    const label = this.props.element.get('label')
    const data = this.props.element.get('slider')
    const min = data.get('min')
    const max = data.get('max')
    const step = data.get('step')
    const style = { width: this.props.width }

    return (
      <div className="Widget stSlider">
        <Label style={style} check>
          <div className="label">{label}: {this.state.value}</div>
          <Input
            type="range"
            id={widgetId}
            className="col-4"
            min={min}
            max={max}
            step={step}
            value={this.state.value}
            onChange={this.handleChange}
          />
        </Label>
      </div>
    )
  }
}

export default Slider
