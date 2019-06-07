/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 */

import React from 'react'
import {Button, Input, Label} from 'reactstrap'
import {Map as ImmutableMap} from 'immutable'
import {dispatchOneOf} from 'lib/immutableProto'
import {PureStreamlitElement, StState} from 'components/shared/StreamlitElement/'
import './Widget.scss'

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

class Widget extends PureStreamlitElement<Props, State> {
  public constructor(props: Props) {
    super(props)

    const {element} = this.props
    let value = false

    dispatchOneOf(element, 'type', {
      button: (data: ImmutableMap<string, any>) => null,
      checkbox: (data: ImmutableMap<string, any>) => value = data.get('value'),
      slider: (data: ImmutableMap<string, any>) => value = data.get('value'),
      textArea: (data: ImmutableMap<string, any>) => value = data.get('value'),
    })

    this.state = { value }

    console.log(`Original value: ${value}, id = ${element.get('id')}`)
    this.props.setWidgetState(element.get('id'), value)
  }

  private handleButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const target = e.target as HTMLButtonElement
    this.props.setWidgetState(target.id, true, () => {
      this.props.sendBackMsg({
        type: 'widgetJson',
        widgetJson: JSON.stringify(this.props.getWidgetState())
      })
      this.props.setWidgetState(target.id, false)
    })
  }

  private handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const oldValue = this.state.value
    const currentValue = e.target.checked
    const id = e.target.id
    console.log(`id = ${id}, old = ${oldValue}, current = ${currentValue}`)
    this.setState({ value: currentValue })
    this.props.setWidgetState(id, currentValue, () => {
      this.props.sendBackMsg({
        type: 'widgetJson',
        widgetJson: JSON.stringify(this.props.getWidgetState())
      })
    })
  }

  private handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const oldValue = this.state.value
    const currentValue = parseInt(e.target.value, 10)
    const id = e.target.id
    console.log(`id = ${id}, old = ${oldValue}, current = ${currentValue}`)
    this.setState({ value: currentValue })
    this.props.setWidgetState(id, currentValue, () => {
      this.props.sendBackMsg({
        type: 'widgetJson',
        widgetJson: JSON.stringify(this.props.getWidgetState())
      })
    })
  }

  private handleTextAreaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const oldValue = this.state.value
    const currentValue = e.target.value
    const id = e.target.id
    console.log(`id = ${id}, old = ${oldValue}, current = ${currentValue}`)
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
    const label = element.get('label')
    const id = element.get('id')

    return dispatchOneOf(element, 'type', {
      button: () => {
        const style = {
          width: this.props.width,
        }

        return (
          <div className="Widget row-widget">
            <Button id={id} style={style} onClick={this.handleButtonClick}>
              { label }
            </Button>
          </div>
        )
      },

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
