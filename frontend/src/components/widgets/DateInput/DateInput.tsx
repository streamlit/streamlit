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
import { Datepicker as UIDatePicker } from "baseui/datepicker"
import { Map as ImmutableMap } from "immutable"
import moment from "moment"
import { WidgetStateManager } from "lib/WidgetStateManager"
import { datePickerOverrides } from "lib/widgetTheme"

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
  value?: string
}

class DateInput extends React.PureComponent<Props, State> {
  public state: State = {}

  /**
   * Return the user-entered value, or the widget's default value
   * if the user hasn't interacted with it yet.
   */
  private get valueOrDefault(): Date {
    if (this.state.value === undefined) {
      return stringToDate(this.props.element.get("value") as string)
    } else {
      return stringToDate(this.state.value)
    }
  }

  private handleChange = (e: any): void => {
    const widgetId = this.props.element.get("id")

    this.setState({ value: e.date })
    this.props.widgetMgr.setStringValue(widgetId, dateToString(e.date))
  }

  public render(): React.ReactNode {
    const label = this.props.element.get("label")
    const style = { width: this.props.width }

    return (
      <div className="Widget stDateInput" style={style}>
        <label>{label}</label>
        <UIDatePicker
          formatString="yyyy/MM/dd"
          value={this.valueOrDefault}
          onChange={this.handleChange}
          disabled={this.props.disabled}
          overrides={datePickerOverrides}
        />
      </div>
    )
  }
}

function dateToString(date: Date): string {
  return moment(date).format("YYYY/MM/DD")
}

function stringToDate(value: string): Date {
  return moment(value, "YYYY/MM/DD").toDate()
}

export default DateInput
