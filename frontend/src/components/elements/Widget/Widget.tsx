/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 */

import React from 'react'
import {Input, Label} from 'reactstrap'
import {Map as ImmutableMap} from 'immutable'
import {dispatchOneOf} from 'lib/immutableProto'
import {PureStreamlitElement, StState} from 'components/shared/StreamlitElement/'

import ButtonWidget from 'components/widgets/Button/'
import CheckboxWidget from 'components/widgets/Checkbox/'
import SliderWidget from 'components/widgets/Slider/'
// import TextAreaWidget from 'components/widgets/TextArea/'


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
    this.props.setWidgetState(element.get('id'), value)
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

      button: () => <ButtonWidget {...this.props}/>,
      checkbox: () => <CheckboxWidget {...this.props}/>,
      slider: () => <SliderWidget {...this.props}/>,
      // textarea: () => <TextAreaWidget {...this.props}/>,

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
