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
import { Select as UISelect } from 'baseui/select'
import { Map as ImmutableMap } from 'immutable'
import { WidgetStateManager } from 'lib/WidgetStateManager'
import { logWarning } from 'lib/log'

interface Props {
  disabled: boolean;
  element: ImmutableMap<string, any>;
  widgetMgr: WidgetStateManager;
  width: number;
}

interface State {
  /**
   * The value specified by the user via the UI. If the user didn't touch this
   * widget's UI, the default value is used.
   */
  value: number;
}

interface SelectOption {
  label: string;
  value: string;
}

class Selectbox extends React.PureComponent<Props, State> {
  public state: State = {
    value: this.props.element.get('default')
  }

  public componentDidUpdate = (prevProps: Props): void => {
    // Reset the widget state when the default value changes
    const oldDefaultValue: number = prevProps.element.get('default')
    const newDefaultValue: number = this.props.element.get('default')
    if (oldDefaultValue !== newDefaultValue) {
      this.setState({ value: newDefaultValue }, this.setWidgetValue)
    }
  }

  private setWidgetValue = (): void => {
    const widgetId: string = this.props.element.get('id')
    this.props.widgetMgr.setIntValue(widgetId, this.state.value)
  }

  // 👉 To be continued...
  // private formatValue = (): any[] => {
  //   return [{
  //     label: this.props.element.get('options')[this.state.value],
  //     value: this.state.value.toString(),
  //   }]
  // }

  // private onChange = ({ value }: { value: SelectOption[] }) => {
  //   if (value.length === 0) {
  //     logWarning('No value selected!')
  //     return
  //   }

  //   const selectedValue = value.length > 0 ? parseInt(value[0], 10) : 0
  //   this.setState({ value: selectedValue }, this.setWidgetValue)
  // }

  public render = (): React.ReactNode => {
    const style = { width: this.props.width }
    const label = this.props.element.get('label')
    let options = this.props.element.get('options')
    let disabled = this.props.disabled

    if (options.size === 0) {
      options = ['No options to select.']
      disabled = true
    }

    const selectOptions: SelectOption[] =
      options.map((option: string, index: number) => ({
        label: option,
        value: index.toString(),
      }))

    return (
      <div className="Widget row-widget stSelectbox" style={style}>
        <label>{label}</label>
        <UISelect
          options={selectOptions}
          labelKey="label"
          valueKey="value"
          onChange={this.onChange}
          value={this.formatValue}
          clearable={false}
          disabled={disabled}
        />
      </div>
    )
  }
}

export default Selectbox
