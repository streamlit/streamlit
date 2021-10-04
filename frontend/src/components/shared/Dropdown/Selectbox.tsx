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
import { logWarning } from "src/lib/log"
import { VirtualDropdown } from "src/components/shared/Dropdown"
import { hasMatch, score } from "fzy.js"
import _ from "lodash"
import { Placement } from "src/components/shared/Tooltip"
import TooltipIcon from "src/components/shared/TooltipIcon"
import {
  WidgetLabel,
  StyledWidgetLabelHelp,
} from "src/components/widgets/BaseWidget"

export interface Props {
  disabled: boolean
  width?: number
  value: number
  onChange: (value: number) => void
  options: any[]
  label?: string | null
  help?: string
}

interface State {
  // Used to work around the forced rerender when the input is empty
  isEmpty: boolean
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

// Add a custom filterOptions method to filter options only based on labels.
// The baseweb default method filters based on labels or indeces
// More details: https://github.com/streamlit/streamlit/issues/1010
// Also filters using fuzzy search powered by fzy.js. Automatically handles
// upper/lowercase.
export function fuzzyFilterSelectOptions(
  options: SelectOption[],
  pattern: string
): readonly SelectOption[] {
  if (!pattern) {
    return options
  }

  return _(options)
    .filter((opt: SelectOption) => hasMatch(pattern, opt.label))
    .sortBy((opt: SelectOption) => score(pattern, opt.label))
    .reverse()
    .value()
}

class Selectbox extends React.PureComponent<Props, State> {
  public state: State = {
    isEmpty: false,
    value: this.props.value,
  }

  componentDidUpdate(prevProps: Readonly<Props>): void {
    if (
      prevProps.value !== this.props.value &&
      this.state.value !== this.props.value
    ) {
      this.setState({ value: this.props.value })
    }
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

  /**
   * Both onInputChange and onClose handle the situation where
   * the user has hit backspace enough times that there's nothing
   * left in the input, but we don't want the value for the input
   * to then be invalid once they've clicked away
   */
  private onInputChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ): void => {
    const currentInput = event.target.value

    this.setState({
      isEmpty: !currentInput,
    })
  }

  private onClose = (): void => {
    this.setState({
      isEmpty: false,
    })
  }

  private filterOptions = (
    options: readonly Option[],
    filterValue: string
  ): readonly Option[] =>
    fuzzyFilterSelectOptions(options as SelectOption[], filterValue)

  public render = (): React.ReactNode => {
    const style = { width: this.props.width }
    const { label, help } = this.props
    let { disabled, options } = this.props

    let value = [
      {
        label:
          options.length > 0
            ? options[this.state.value]
            : "No options to select.",
        value: this.state.value.toString(),
      },
    ]

    if (this.state.isEmpty) {
      value = []
    }

    if (options.length === 0) {
      options = ["No options to select."]
      disabled = true
    }

    const selectOptions: SelectOption[] = options.map(
      (option: string, index: number) => ({
        label: option,
        value: index.toString(),
      })
    )

    return (
      <div className="row-widget stSelectbox" style={style}>
        <WidgetLabel label={label}>
          {help && (
            <StyledWidgetLabelHelp>
              <TooltipIcon content={help} placement={Placement.TOP_RIGHT} />
            </StyledWidgetLabelHelp>
          )}
        </WidgetLabel>
        <UISelect
          clearable={false}
          disabled={disabled}
          labelKey="label"
          onChange={this.onChange}
          onInputChange={this.onInputChange}
          onClose={this.onClose}
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
