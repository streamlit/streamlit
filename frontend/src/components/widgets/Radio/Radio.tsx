/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 */

import React from 'react'
import { Radio as UIRadio, RadioGroup } from 'baseui/radio'
import { Map as ImmutableMap } from 'immutable'
import { WidgetStateManager } from 'lib/WidgetStateManager'
import { radioOverrides } from 'lib/widgetTheme'

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
  value?: number;
}

class Radio extends React.PureComponent<Props, State> {
  public state: State = {}

  /**
   * Return the user-entered value, or the widget's default value
   * if the user hasn't interacted with it yet.
   */
  private get valueOrDefault(): number {
    if (this.state.value === undefined) {
      return this.props.element.get('value') as number
    } else {
      return this.state.value
    }
  }

  private onChange = (e: any) => {
    const widgetId = this.props.element.get('id')
    const stringValue = (e.target as HTMLInputElement).value
    const value = parseInt(stringValue, 10)

    this.setState({ value })
    this.props.widgetMgr.setIntValue(widgetId, value)
  }

  public render(): React.ReactNode {
    const label = this.props.element.get('label')
    const options = this.props.element.get('options')
    const style = { width: this.props.width }

    return (
      <div className="Widget row-widget stRadio" style={style}>
        <label>{label}</label>
        <RadioGroup
          onChange={this.onChange}
          value={this.valueOrDefault.toString()}
          disabled={this.props.disabled}
        >
          {options.map((option: string, idx: number) => (
            <UIRadio
              key={idx}
              value={idx.toString()}
              overrides={radioOverrides}
            >{option}</UIRadio>
          ))}
        </RadioGroup>
      </div>
    )
  }
}

export default Radio
