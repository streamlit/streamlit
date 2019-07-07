/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 */

import React from 'react'
import { Textarea as UITextArea } from 'baseui/textarea'
import { Map as ImmutableMap } from 'immutable'
import { WidgetStateManager } from 'lib/WidgetStateManager'

interface Props {
  element: ImmutableMap<string, any>;
  widgetMgr: WidgetStateManager;
  width: number;
}

interface State {
  value: string;
}

class TextArea extends React.PureComponent<Props, State> {
  public constructor(props: Props) {
    super(props)

    const widgetId = this.props.element.get('id')
    const value = this.props.element.get('value')

    this.state = { value }
    this.props.widgetMgr.setStringValue(widgetId, value)
  }

  private handleChange = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const widgetId = this.props.element.get('id')
    const value = (e.target as HTMLTextAreaElement).value

    this.setState({ value })
    this.props.widgetMgr.setStringValue(widgetId, value)
    this.props.widgetMgr.sendUpdateWidgetsMessage()
  }

  public render(): React.ReactNode {
    const label = this.props.element.get('label')
    const style = { width: this.props.width }

    return (
      <div className="Widget stTextArea" style={style}>
        <label>{label}</label>
        <UITextArea
          value={this.state.value}
          onChange={this.handleChange}
        />
      </div>
    )
  }
}

export default TextArea
