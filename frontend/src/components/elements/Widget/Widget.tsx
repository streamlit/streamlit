/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 */

import React from 'react'
import {Map as ImmutableMap} from 'immutable'
import {dispatchOneOf} from '../../../lib/immutableProto'
import {PureStreamlitElement} from '../../shared/StreamlitElement'

import {Input, Label} from 'reactstrap'

interface Props {
  width: number;
  element: ImmutableMap<string, any>;
  sendBackMsg: Function;
  getWidgetState: Function;
  setWidgetState: Function;
}

interface State {
  value: any;
}

class Widget extends PureStreamlitElement<Props, State> {
  public constructor(props: Props) {
    super(props)

    const {element} = this.props
    let value = false

    dispatchOneOf(element, 'type', {
      checkbox: (data: ImmutableMap<string, any>) => value = data.get('value'),
      slider: (data: ImmutableMap<string, any>) => value = data.get('value'),
    })

    this.state = {
      value: value,
    }

    console.log(`Original value: ${value}, id = ${element.get('id')}`)
    this.setWidgetState(element.get('id'), value)
  }

  private sendBackMsg(obj: any): void {
    this.props.sendBackMsg(obj)
  }

  private getWidgetState(): void {
    return this.props.getWidgetState()
  }

  private setWidgetState(key: string, value: any): void {
    this.props.setWidgetState(key, value)
  }

  private handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let old = this.state.value
    let current = e.target.checked
    let id = e.target.id
    console.log(`id = ${id}, old = ${old}, current = ${current}`)
    this.setState({
      value: current,
    })
    this.setWidgetState(id, current)
    this.sendBackMsg({type: 'widgetJson', widgetJson: JSON.stringify(this.getWidgetState())})
  };

  private handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let old = this.state.value
    let current = parseInt(e.target.value, 10)
    let id = e.target.id
    console.log(`id = ${id}, old = ${old}, current = ${current}`)
    this.setState({
      value: current,
    })
    this.setWidgetState(id, current)
    this.sendBackMsg({type: 'widgetJson', widgetJson: JSON.stringify(this.getWidgetState())})
  };


  public safeRender(): React.ReactNode {
    const {element} = this.props
    const label = element.get('label')
    const id = element.get('id')

    return dispatchOneOf(element, 'type', {
      checkbox: () => {
        return (
          <div>
            <Label check>
              <Input type="checkbox" id={id} checked={this.state.value} onChange={this.handleChange} /> { label }
            </Label>
          </div>
        )
      },
      slider: (data: ImmutableMap<string, any>) => {
        const min = data.get('min')
        const max = data.get('max')
        const step = data.get('step')
        const style = {
          width: '200px',
        }

        return (
          <div>
            <Label check>
              <Input type="range" style={style} id={id} min={min} max={max} step={step} value={this.state.value}
                onChange={this.handleSliderChange} /> { label }
            </Label>
          </div>
        )
      },
    })
  }
}

export default Widget
