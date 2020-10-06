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

import { MultiSelect as MultiSelectProto } from "autogen/proto"
import { OnChangeParams, Select as UISelect, TYPE } from "baseui/select"
import VirtualDropdown from "components/shared/VirtualDropdown"
import { Source, WidgetStateManager } from "lib/WidgetStateManager"
import { multiSelectOverrides } from "lib/widgetTheme"
import without from "lodash/without"
import { Long, util } from "protobufjs"
import React from "react"

export interface Props {
  disabled: boolean
  element: MultiSelectProto
  widgetMgr: WidgetStateManager
  width: number
}

interface State {
  /**
   * The value specified by the user via the UI.
   */
  value: number[]
}

interface MultiselectOption {
  label: string
  value: string
}

/**
 * Convert a Long to a number, if necessary.
 */
function getNumber(value: number | Long): number {
  if (typeof value === "number") {
    return value
  }
  return new util.LongBits(value.low, value.high).toNumber()
}

class Multiselect extends React.PureComponent<Props, State> {
  public state: State = {
    value: this.initialValue,
  }

  get initialValue(): number[] {
    // If WidgetStateManager knew a value for this widget, initialize to that.
    // Otherwise, use the default value from the widget protobuf.
    const widgetId = this.props.element.id
    const storedValue = this.props.widgetMgr.getIntArrayValue(widgetId)
    return storedValue !== undefined
      ? storedValue.map(getNumber)
      : this.props.element.default
  }

  public componentDidMount(): void {
    this.setWidgetValue({ fromUi: false })
  }

  private setWidgetValue = (source: Source): void => {
    const widgetId = this.props.element.id
    this.props.widgetMgr.setIntArrayValue(widgetId, this.state.value, source)
  }

  private get valueFromState(): MultiselectOption[] {
    return this.state.value.map(i => {
      const label = this.props.element.options[i]
      return { value: i.toString(), label }
    })
  }

  private generateNewState(data: any): State {
    const getIndex = (): number => {
      const valueId = data.option.value
      return parseInt(valueId, 10)
    }

    switch (data.type) {
      case "remove": {
        return { value: without(this.state.value, getIndex()) }
      }
      case "clear": {
        return { value: [] }
      }
      case "select": {
        return { value: this.state.value.concat([getIndex()]) }
      }
      default: {
        throw new Error(`State transition is unkonwn: {data.type}`)
      }
    }
  }

  private onChange = (params: OnChangeParams): void => {
    const newState = this.generateNewState(params)
    this.setState(newState, () => this.setWidgetValue({ fromUi: true }))
  }

  public render(): React.ReactNode {
    const { element, width } = this.props
    const style = { width }
    const { options } = element
    const disabled = options.length === 0 ? true : this.props.disabled
    const placeholder =
      options.length === 0 ? "No options to select." : "Choose an option"
    const selectOptions: MultiselectOption[] = options.map(
      (option: string, idx: number) => {
        return {
          label: option,
          value: idx.toString(),
        }
      }
    )

    return (
      <div className="Widget row-widget stMultiSelect" style={style}>
        <label>{element.label}</label>
        <UISelect
          options={selectOptions}
          labelKey="label"
          valueKey="value"
          placeholder={placeholder}
          type={TYPE.select}
          multi
          onChange={this.onChange}
          value={this.valueFromState}
          disabled={disabled}
          size={"compact"}
          overrides={{
            ...multiSelectOverrides,
            Dropdown: { component: VirtualDropdown },
          }}
        />
      </div>
    )
  }
}

export default Multiselect
