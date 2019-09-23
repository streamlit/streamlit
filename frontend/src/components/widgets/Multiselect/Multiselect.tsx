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

import React from "react"
import { TYPE, Select as UISelect } from "baseui/select"
import { Map as ImmutableMap } from "immutable"
import { WidgetStateManager } from "lib/WidgetStateManager"
import * as _ from "lodash"

interface Props {
  disabled: boolean
  element: ImmutableMap<string, any>
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

class Multiselect extends React.PureComponent<Props, State> {
  public state: State = { value: [] }

  private get valueOrDefault(): MultiselectOption[] {
    if (this.state.value.length === 0) {
      return this.props.element.get("default").toArray()
    }
    return this.state.value.map(i => {
      const label = this.props.element.get("options").get(i)
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
        return { value: _.without(this.state.value, getIndex()) }
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

  private onChange = (data: any) => {
    const widgetId = this.props.element.get("id")
    const newState = this.generateNewState(data)
    this.props.widgetMgr.setIntArrayValue(widgetId, newState.value)
    this.setState(newState)
  }

  public render(): React.ReactNode {
    const { element, width } = this.props
    const style = { width }
    const label = element.get("label")
    const options = element.get("options")
    const disabled = options.size === 0 ? true : this.props.disabled
    const placeholder =
      options.size === 0 ? "No options to select." : "Choose an option"
    const selectOptions: MultiselectOption[] = options
      .map((option: string, idx: number) => {
        return {
          label: option,
          value: idx.toString(),
        }
      })
      .toArray()

    return (
      <div className="Widget row-widget stMultiSelect" style={style}>
        <label>{label}</label>
        <UISelect
          options={selectOptions}
          labelKey="label"
          valueKey="value"
          placeholder={placeholder}
          type={TYPE.search}
          multi
          onChange={this.onChange}
          value={this.valueOrDefault}
          disabled={disabled}
        />
      </div>
    )
  }
}

export default Multiselect
