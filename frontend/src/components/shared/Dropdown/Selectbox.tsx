/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
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
import { logWarning } from "lib/log"
import { VirtualDropdown } from "components/shared/Dropdown"
import { StyledWidgetLabel } from "components/widgets/BaseWidget"

export interface Props {
  disabled: boolean
  width: number
  value: number
  onChange: (value: number) => void
  options: any[]
  label: string
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
    value: this.props.value,
  }

  private onChange = (params: OnChangeParams): void => {
    if (params.value.length === 0) {
      logWarning("No value selected!")
      return
    }

    const [selected] = params.value

    this.setState({ value: parseInt(selected.value, 10) }, () =>
      this.props.onChange(this.state.value)
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
    let { disabled, options } = this.props

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
        <StyledWidgetLabel>{this.props.label}</StyledWidgetLabel>
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
