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
  /**
   * The value specified by the user via the UI. If the user didn't touch this
   * widget's UI, it's undefined.
   */
  value: string;

  /**
   * True if the user-specified state.value has not yet been synced to the WidgetStateManager.
   */
  dirty: boolean;
}

class TextInput extends React.PureComponent<Props, State> {
  public state: State = {
    dirty: false,
    value: this.props.element.get('value'),
  }

  componentDidUpdate = (prevProps: Props): void => {
    // Reset the widget's state when the default value changes
    const oldDefaultValue: string = prevProps.element.get('default')
    const newDefaultValue: string = this.props.element.get('default')
    if (oldDefaultValue !== newDefaultValue) {
      this.setState({ value: newDefaultValue }, this.setWidgetValue)
    }
  }

  private onKeyPress = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' && this.state.dirty) {
      this.setWidgetValue()
    }
  }

  private onBlur = (): void => {
    if (this.state.dirty) {
      this.setWidgetValue()
    }
  }

  private onChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    this.setState({
      dirty: true,
      value: e.target.value,
    })
  }

  private setWidgetValue(): void {
    const widgetId: string = this.props.element.get('id')
    this.props.widgetMgr.setStringValue(widgetId, this.state.value)
    this.setState({ dirty: false })
  }

  public render(): React.ReactNode {
    const label: string = this.props.element.get('label')
    const style = { width: this.props.width }

    return (
      <div className="Widget row-widget stTextInput" style={style}>
        <label>{label}</label>
        <UIInput
          value={this.state.value}
          disabled={this.props.disabled}
          onBlur={this.onBlur}
          onChange={this.onChange}
          onKeyPress={this.onKeyPress}
        />
        {
          this.state.dirty
            ? <div className="instructions">Press Enter to apply</div>
            : null
        }
      </div>
    )
  }
}

export default TextInput
