/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 */

import React from 'react'
import { Input as UIInput } from 'baseui/input'
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

class TextInput extends React.PureComponent<Props, State> {
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

  private onKeyPress = (e: React.SyntheticEvent<HTMLInputElement>) => {
    if ((e as React.KeyboardEvent<HTMLInputElement>).key === 'Enter' && this.state.dirty) {
      this.props.widgetMgr.sendUpdateWidgetsMessage()
      this.setState({ dirty: false })
    }
  }

  private onBlur = (e: React.SyntheticEvent<HTMLInputElement>) => {
    if (this.state.dirty) {
      this.props.widgetMgr.sendUpdateWidgetsMessage()
      this.setState({ dirty: false })
    }
  }

  private onChange = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const value = (e.target as HTMLInputElement).value
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
      <div className="Widget row-widget stTextInput" style={style}>
        <label>{label}</label>
        <UIInput
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

export default TextInput
