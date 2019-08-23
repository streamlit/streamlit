/**
 * @license
 * Copyright 2018-2019 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
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
    const { element, width } = this.props

    const style = { width }
    const label = element.get('label')
    let options = element.get('options')
    let disabled = this.props.disabled

    if (options.size === 0) {
      options = ['No options to select.']
      disabled = true
    }

    return (
      <div className="Widget row-widget stRadio" style={style}>
        <label>{label}</label>
        <RadioGroup
          onChange={this.onChange}
          value={this.valueOrDefault.toString()}
          disabled={disabled}
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
