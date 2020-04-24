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

import React, { PureComponent, ReactNode } from "react"
import { Map as ImmutableMap } from "immutable"
import { TimePicker as UITimePicker } from "baseui/timepicker"
import { WidgetStateManager, Source } from "lib/WidgetStateManager"

export interface Props {
  disabled: boolean
  element: ImmutableMap<string, any>
  widgetMgr: WidgetStateManager
  width: number
}

interface State {
  /**
   * The value specified by the user via the UI. If the user didn't touch this
   * widget's UI, the default value is used.
   */
  value: string
}

class TimeInput extends PureComponent<Props, State> {
  public state: State = {
    value: this.props.element.get("default"),
  }

  public componentDidMount(): void {
    this.setWidgetValue({ fromUi: false })
  }

  private setWidgetValue = (source: Source): void => {
    const widgetId: string = this.props.element.get("id")
    this.props.widgetMgr.setStringValue(widgetId, this.state.value, source)
  }

  private handleChange = (newDate: Date): void => {
    const value = this.dateToString(newDate)
    this.setState({ value }, () => this.setWidgetValue({ fromUi: true }))
  }

  private stringToDate = (value: string): Date => {
    const [hours, minutes] = value.split(":").map(Number)
    const date = new Date()

    date.setHours(hours)
    date.setMinutes(minutes)

    return date
  }

  private dateToString = (value: Date): string => {
    const hours = value
      .getHours()
      .toString()
      .padStart(2, "0")
    const minutes = value
      .getMinutes()
      .toString()
      .padStart(2, "0")

    return hours + ":" + minutes
  }

  public render = (): ReactNode => {
    const { disabled, width, element } = this.props
    const style = { width }
    const label = element.get("label")

    const selectOverrides = {
      Select: {
        props: {
          disabled,
        },
      },
    }

    return (
      <div className="Widget stTimeInput" style={style}>
        <label>{label}</label>
        <UITimePicker
          format="24"
          value={this.stringToDate(this.state.value)}
          onChange={this.handleChange}
          overrides={selectOverrides}
          creatable
        />
      </div>
    )
  }
}

export default TimeInput
