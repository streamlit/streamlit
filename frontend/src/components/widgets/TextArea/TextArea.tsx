/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 */

import React from 'react'
import { Textarea as UITextArea } from 'baseui/textarea'
import { Map as ImmutableMap } from 'immutable'
import { WidgetStateManager } from 'lib/WidgetStateManager'
import { PureStreamlitElement, StState } from 'components/shared/StreamlitElement/'
import './TextArea.scss'

interface Props {
  element: ImmutableMap<string, any>;
  widgetMgr: WidgetStateManager;
  width: number;
}

interface State extends StState {
  value: string;
}

class TextArea extends PureStreamlitElement<Props, State> {
  public constructor(props: Props) {
    super(props)

    const widgetId = this.props.element.get('id')
    const value = this.props.element.get('value')

    this.state = { value }
    this.props.widgetMgr.setStringValue(widgetId, value)
    this.props.widgetMgr.sendUpdateWidgetsMessage()
  }

  private handleChange = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const widgetId = this.props.element.get('id')
    const value = (e.target as HTMLTextAreaElement).value

    this.setState({ value })
    this.props.widgetMgr.setStringValue(widgetId, value)
    this.props.widgetMgr.sendUpdateWidgetsMessage()
  }

  public safeRender(): React.ReactNode {
    const label = this.props.element.get('label')
    const style = { width: this.props.width }

    return (
      <div className="Widget stTextArea" style={style}>
        <p className="label">{label}</p>
        <UITextArea
          value={this.state.value}
          onChange={this.handleChange}
        />
      </div>
    )
  }
}

export default TextArea
