/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 */

import React from 'react'
import {Input, Label} from 'reactstrap'
import {Map as ImmutableMap} from 'immutable'
import {PureStreamlitElement, StState} from 'components/shared/StreamlitElement/'
import './TextArea.scss'

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

class TextArea extends PureStreamlitElement<Props, State> {
  public constructor(props: Props) {
    super(props)

    const {element} = this.props
    const value = element.get('textArea').get('value')

    this.state = { value }
    this.props.setWidgetState(element.get('id'), value)
  }

  private handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const currentValue = e.target.value
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
    const label = element.get('label')
    const id = element.get('id')

    const style = {
      width: this.props.width,
    }

    return (
      <div className="Widget stTextArea">
        <Label style={style} check>
          <div className="label">{ label }</div>
          <Input
            type="textarea"
            className="col-6"
            id={id}
            value={this.state.value}
            onChange={this.handleChange}
          />
        </Label>
      </div>
    )
  }
}

export default TextArea
