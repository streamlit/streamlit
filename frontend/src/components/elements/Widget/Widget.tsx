/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 */

import {Map as ImmutableMap} from 'immutable'
import {WidgetStateManager} from 'lib/WidgetStateManager'
import React from 'react'

import {Input, Label} from 'reactstrap'
import {dispatchOneOf} from '../../../lib/immutableProto'
import {PureStreamlitElement, StState} from '../../shared/StreamlitElement'
import './Widget.scss'

interface Props {
  width: number;
  element: ImmutableMap<string, any>;
  widgetMgr: WidgetStateManager;
}

interface State extends StState {
  value: any;
}

class Widget extends PureStreamlitElement<Props, State> {
  public constructor(props: Props) {
    super(props)

    const {element} = this.props
    const id = element.get('id')
    let value: any = undefined

    dispatchOneOf(element, 'type', {
      checkbox: (data: ImmutableMap<string, any>) => {
        value = data.get('value')
        this.props.widgetMgr.setBoolValue(id, value)
      },
      slider: (data: ImmutableMap<string, any>) => {
        value = data.get('value')
        this.props.widgetMgr.setIntValue(id, value)
      },
      textArea: (data: ImmutableMap<string, any>) => {
        value = data.get('value')
        this.props.widgetMgr.setStringValue(id, value)
      },
    })

    this.state = {value: value}
    console.log(`Original value: ${value}, id = ${element.get('id')}`)
  }

  private handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let old = this.state.value
    let current = e.target.checked
    let id = e.target.id
    console.log(`id = ${id}, old = ${old}, current = ${current}`)
    this.setState({
      value: current,
    })
    this.props.widgetMgr.setBoolValue(id, current)
    this.props.widgetMgr.sendUpdateWidgetsMessage()
  };

  private handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let old = this.state.value
    let current = parseInt(e.target.value, 10)
    let id = e.target.id
    console.log(`id = ${id}, old = ${old}, current = ${current}`)
    this.setState({
      value: current,
    })
    this.props.widgetMgr.setIntValue(id, current)
    this.props.widgetMgr.sendUpdateWidgetsMessage()
  };

  private handleTextAreaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let old = this.state.value
    let current = e.target.value
    let id = e.target.id
    console.log(`id = ${id}, old = ${old}, current = ${current}`)
    this.setState({
      value: current,
    })
    this.props.widgetMgr.setStringValue(id, current)
    this.props.widgetMgr.sendUpdateWidgetsMessage()
  };


  public safeRender(): React.ReactNode {
    const {element} = this.props
    const label = element.get('label')
    const id = element.get('id')

    return dispatchOneOf(element, 'type', {
      checkbox: () => {
        const style = {
          width: this.props.width,
        }

        return (
          <div className="Widget row-widget">
            <Label style={style} check>
              <Input type="checkbox" id={id} checked={this.state.value} onChange={this.handleCheckboxChange} />
              <span className="label">{ label }</span>
            </Label>
          </div>
        )
      },

      slider: (data: ImmutableMap<string, any>) => {
        const min = data.get('min')
        const max = data.get('max')
        const step = data.get('step')
        const style = {
          width: this.props.width,
        }

        return (
          <div className="Widget">
            <Label style={style} check>
              <div className="label">{ label }: {this.state.value}</div>
              <Input type="range" className="col-4" id={id} min={min} max={max} step={step} value={this.state.value}
                onChange={this.handleSliderChange} />
            </Label>
          </div>
        )
      },

      textArea: () => {
        const style = {
          width: this.props.width,
        }

        return (
          <div className="Widget">
            <Label style={style} check>
              <div className="label">{ label }</div>
              <Input type="textarea" className="col-6" id={id} value={this.state.value}
                onChange={this.handleTextAreaChange} />
            </Label>
          </div>
        )
      },
    })
  }
}

export default Widget
