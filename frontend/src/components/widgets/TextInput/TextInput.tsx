/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 */

import React from 'react'
import { Map as ImmutableMap } from 'immutable'
import { Input as UIInput } from 'baseui/input'
import { WidgetStateManager } from 'lib/WidgetStateManager'

interface Props {
  element: ImmutableMap<string, any>;
  widgetMgr: WidgetStateManager;
  width: number;
}

interface State {
  value: any;
}

class TextInput extends React.PureComponent<Props, State> {
  public constructor(props: Props) {
    super(props)

    const widgetId = this.props.element.get('id')
    const value = this.props.element.get('value')

    // TODO: should we set the value to the state even if it's undefined?
    this.state = { value }
    if (value) {
      this.props.widgetMgr.setStringValue(widgetId, value)
    }
  }

  private onChange = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const value = (e.target as HTMLInputElement).value
    const widgetId = this.props.element.get('id')

    this.setState({ value })
    this.props.widgetMgr.setStringValue(widgetId, value)
    this.props.widgetMgr.sendUpdateWidgetsMessage()
  }

  public render(): React.ReactNode {
    const label = this.props.element.get('label')
    const style = { width: this.props.width }

    return (
      <div className="Widget row-widget stTextInput" style={style}>
        <label>{label}</label>
        <UIInput onChange={this.onChange} value={this.state.value} />
      </div>
    )
  }
}

export default TextInput
