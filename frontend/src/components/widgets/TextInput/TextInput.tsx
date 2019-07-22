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
  value?: string;

  /**
   * True if the user-specified state.value has not yet been synced to the WidgetStateManager.
   */
  dirty: boolean;
}

class TextInput extends React.PureComponent<Props, State> {
  public state: State = {
    dirty: false,
  }

  /**
   * Return the user-entered value, or the widget's default value
   * if the user hasn't interacted with it yet.
   */
  private get valueOrDefault(): string {
    if (this.state.value === undefined) {
      return this.props.element.get('value') as string
    } else {
      return this.state.value
    }
  }

  private onKeyPress = (e: any) => {
    const event = e as React.KeyboardEvent<HTMLInputElement>
    if (event.key === 'Enter' && this.state.dirty) {
      this.setWidgetValue()
    }
  }

  private onBlur = () => {
    if (this.state.dirty) {
      this.setWidgetValue()
    }
  }

  private onChange = (e: any) => {
    const value = (e.target as HTMLInputElement).value
    this.setState({
      value,
      dirty: true,
    })
  }

  private setWidgetValue(): void {
    if (this.state.value === undefined) {
      throw new Error('Assertion error: value is undefined')
    }
    const widgetId = this.props.element.get('id')

    this.props.widgetMgr.setStringValue(widgetId, this.state.value)
    this.setState({ dirty: false })
  }

  public render(): React.ReactNode {
    const label = this.props.element.get('label')
    const style = { width: this.props.width }

    return (
      <div className="Widget row-widget stTextInput" style={style}>
        <label>{label}</label>
        <UIInput
          value={this.valueOrDefault}
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
