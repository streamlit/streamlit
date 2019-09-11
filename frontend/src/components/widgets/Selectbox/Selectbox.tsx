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

import { logWarning } from "lib/log"
import React from "react"
import { Select as UISelect } from "baseui/select"
import { Map as ImmutableMap } from "immutable"
import { WidgetStateManager } from "lib/WidgetStateManager"

interface Props {
  disabled: boolean
  element: ImmutableMap<string, any>
  widgetMgr: WidgetStateManager
  width: number
}

interface State {
  /**
   * The value specified by the user via the UI. If the user didn't touch this
   * widget's UI, it's undefined.
   */
  value?: number
}

interface SelectOption {
  label: string
  value: string
}

class Selectbox extends React.PureComponent<Props, State> {
  public state: State = {}

  private get valueOrDefault(): SelectOption[] | undefined {
    const value =
      this.state.value === undefined
        ? (this.props.element.get("value") as number)
        : this.state.value

    return [
      {
        value: value.toString(),
        label: this.props.element.get("options")[value],
      },
    ]
  }

  private onChange = (data: any) => {
    const widgetId = this.props.element.get("id")
    const selectedValue: SelectOption[] = data["value"]

    if (selectedValue.length === 0) {
      logWarning("No value selected!")
      return
    }

    const valueId = selectedValue[0].value
    const index = parseInt(valueId, 10)

    this.setState({ value: index })
    this.props.widgetMgr.setIntValue(widgetId, index)
  }

  public render(): React.ReactNode {
    const { element, width } = this.props

    const style = { width }
    const label = element.get("label")
    let options = element.get("options")
    let disabled = this.props.disabled

    if (options.size === 0) {
      options = ["No options to select."]
      disabled = true
    }

    const selectOptions: SelectOption[] = []
    options.forEach((option: string, idx: number) =>
      selectOptions.push({
        label: option,
        value: idx.toString(),
      })
    )

    return (
      <div className="Widget row-widget stSelectbox" style={style}>
        <label>{label}</label>
        <UISelect
          options={selectOptions}
          labelKey="label"
          valueKey="value"
          onChange={this.onChange}
          value={this.valueOrDefault}
          clearable={false}
          disabled={disabled}
        />
      </div>
    )
  }
}

export default Selectbox
