/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 */

import React from 'react'
import {Input, Label} from 'reactstrap'
import {Map as ImmutableMap} from 'immutable'
import {PureStreamlitElement, StState} from 'components/shared/StreamlitElement/'
import './Slider.scss'

interface Props {
  element: ImmutableMap<string, any>;
  getWidgetState: Function;
  sendBackMsg: Function;
  setWidgetState: Function;
  width: number;
}

interface State extends StState {
  value: any;
}

class Slider extends PureStreamlitElement<Props, State> {
  public constructor(props: Props) {
    super(props)

    const {element} = this.props
    const value = element.get('slider').get('value')

    this.state = { value }
    this.props.setWidgetState(element.get('id'), value)
  }

  private handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const currentValue = parseInt(e.target.value, 10)
    const id = e.target.id

    this.setState({ value: currentValue })
    this.props.setWidgetState(id, currentValue, () => {
      this.props.sendBackMsg({
        type: 'widgetJson',
        widgetJson: JSON.stringify(this.props.getWidgetState())
      })
    })
  }

  public safeRender(): React.ReactNode {
    const {element} = this.props
    const id = element.get('id')
    const data = element.get('slider')
    const label = element.get('label')

    const min = data.get('min')
    const max = data.get('max')
    const step = data.get('step')

    const style = {
      width: this.props.width,
    }

    return (
      <div className="Widget stSlider">
        <Label style={style} check>
          <div className="label">{ label }: {this.state.value}</div>
          <Input
            type="range"
            className="col-4"
            id={id}
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
