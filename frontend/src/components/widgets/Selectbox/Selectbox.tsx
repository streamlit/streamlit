/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
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

import React from "react"
import { Select as UISelect, OnChangeParams, Option } from "baseui/select"
import { Selectbox as SelectboxProto } from "autogen/proto"
import { WidgetStateManager, Source } from "lib/WidgetStateManager"
import { logWarning } from "lib/log"
import VirtualDropdown from "components/shared/VirtualDropdown"
import { StyledWidgetLabel } from "components/widgets/BaseWidget"

export interface Props {
  disabled: boolean
  element: SelectboxProto
  widgetMgr: WidgetStateManager
  width: number
}

interface State {
  /**
   * The value specified by the user via the UI. If the user didn't touch this
   * widget's UI, the default value is used.
   */
  value: number
}

interface SelectOption {
  label: string
  value: string
}

class Selectbox extends React.PureComponent<Props, State> {
  public state: State = {
    value: this.initialValue,
  }

  get initialValue(): number {
    // If WidgetStateManager knew a value for this widget, initialize to that.
    // Otherwise, use the default value from the widget protobuf.
    const widgetId = this.props.element.id
    const storedValue = this.props.widgetMgr.getIntValue(widgetId)
    return storedValue !== undefined ? storedValue : this.props.element.default
  }

  public componentDidMount(): void {
    this.setWidgetValue({ fromUi: false })
  }

  private setWidgetValue = (source: Source): void => {
    const widgetId = this.props.element.id
    this.props.widgetMgr.setIntValue(widgetId, this.state.value, source)
  }

  private onChange = (params: OnChangeParams): void => {
    if (params.value.length === 0) {
      logWarning("No value selected!")
      return
    }

    const [selected] = params.value

    this.setState({ value: parseInt(selected.value, 10) }, () =>
      this.setWidgetValue({ fromUi: true })
    )
  }

  // Add a custom filterOptions method to filter options only based on labels.
  // The baseweb default method filters based on labels or indeces
  // More details: https://github.com/streamlit/streamlit/issues/1010
  private filterOptions = (
    options: readonly Option[],
    filterValue: string
  ): readonly Option[] => {
    return options.filter((value: Option) =>
      (value as SelectOption).label
        .toLowerCase()
        .includes(filterValue.toString().toLowerCase())
    )
  }

  public render = (): React.ReactNode => {
    const style = { width: this.props.width }
    let { options } = this.props.element
    let { disabled } = this.props

    const value = [
      {
        label:
          options.length > 0
            ? options[this.state.value]
            : "No options to select.",
        value: this.state.value.toString(),
      },
    ]

    if (options.length === 0) {
      options = ["No options to select."]
      disabled = true
    }

    const selectOptions: SelectOption[] = []
    options.forEach((option: string, index: number) =>
      selectOptions.push({
        label: option,
        value: index.toString(),
      })
    )

    return (
      <div className="row-widget stSelectbox" style={style}>
        <StyledWidgetLabel>{this.props.element.label}</StyledWidgetLabel>
        <UISelect
          clearable={false}
          disabled={disabled}
          labelKey="label"
          onChange={this.onChange}
          options={selectOptions}
          filterOptions={this.filterOptions}
          value={value}
          valueKey="value"
          overrides={{
            Dropdown: { component: VirtualDropdown },
          }}
        />
      </div>
    )
  }
}

export default Selectbox
