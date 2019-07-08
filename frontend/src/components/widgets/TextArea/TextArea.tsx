/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 */

import React from 'react'
import { Textarea as UITextArea } from 'baseui/textarea'
import { Map as ImmutableMap } from 'immutable'
import { WidgetStateManager } from 'lib/WidgetStateManager'

interface Props {
  disabled: boolean;
  element: ImmutableMap<string, any>;
  widgetMgr: WidgetStateManager;
  width: number;
}

interface State {
  dirty: boolean;
  value: string;
}

class TextArea extends React.PureComponent<Props, State> {
  public constructor(props: Props) {
    super(props)

    const widgetId = this.props.element.get('id')
    const value = this.props.element.get('value')

    this.state = {
      value,
      dirty: false,
    }

    this.props.widgetMgr.setStringValue(widgetId, value)
  }

  private onKeyPress = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const event = e as React.KeyboardEvent<HTMLTextAreaElement>

    if (event.key === 'Enter' && event.ctrlKey && this.state.dirty) {
      this.props.widgetMgr.sendUpdateWidgetsMessage()
      this.setState({ dirty: false })
    }
  }

  private onBlur = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    if (this.state.dirty) {
      this.props.widgetMgr.sendUpdateWidgetsMessage()
      this.setState({ dirty: false })
    }
  }

  private onChange = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const value = (e.target as HTMLTextAreaElement).value
    const widgetId = this.props.element.get('id')

    this.setState({
      value,
      dirty: true,
    })

    this.props.widgetMgr.setStringValue(widgetId, value)
  }

  public render(): React.ReactNode {
    const label = this.props.element.get('label')
    const style = { width: this.props.width }

    return (
      <div className="Widget stTextArea" style={style}>
        <label>{label}</label>
        <UITextArea
          value={this.state.value}
          disabled={this.props.disabled}
          onChange={this.onChange}
          onKeyPress={this.onKeyPress}
          onBlur={this.onBlur}
        />
      </div>
    )
  }
}

export default TextArea
