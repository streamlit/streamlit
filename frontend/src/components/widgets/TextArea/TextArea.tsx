/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 */

import React from 'react'
// @ts-ignore
import { Textarea } from 'baseui/textarea'
import { Map as ImmutableMap } from 'immutable'
import { PureStreamlitElement, StState } from 'components/shared/StreamlitElement/'
import './TextArea.scss'

interface Props {
  element: ImmutableMap<string, any>;
  sendBackMsg: (msg: Object) => void;
  width: number;
}

interface State extends StState {
  value: string;
}

class TextArea extends PureStreamlitElement<Props, State> {
  private widgetId: string

  public constructor(props: Props) {
    super(props)

    this.widgetId = this.props.element.get('id')
    const value = this.props.element.get('value')
    this.state = { value }
  }

  private handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value

    this.setState({ value })
    this.props.sendBackMsg({
      type: 'widgetJson',
      widgetJson: JSON.stringify({ [this.widgetId]: value })
    })
  }

  public safeRender(): React.ReactNode {
    const label = this.props.element.get('label')
    const style = { width: this.props.width }

    return (
      <div className="Widget stTextArea" style={style}>
        <p className="label">{label}</p>
        <Textarea
          value={this.state.value}
          onChange={this.handleChange}
        />
      </div>
    )
  }
}

export default TextArea
