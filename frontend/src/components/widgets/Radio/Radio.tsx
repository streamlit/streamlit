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
import UIRadio from "components/shared/Radio"
import { Radio as RadioProto } from "autogen/proto"
import { WidgetStateManager, Source } from "lib/WidgetStateManager"

export interface Props {
  disabled: boolean
  element: RadioProto
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

class Radio extends React.PureComponent<Props, State> {
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

  private onChange = (selectedIndex: number): void => {
    this.setState({ value: selectedIndex }, () =>
      this.setWidgetValue({ fromUi: true })
    )
  }

  public render = (): React.ReactNode => {
    const { disabled, element, width } = this.props
    const { options, label } = element

    return (
      <UIRadio
        label={label}
        onChange={this.onChange}
        options={options}
        width={width}
        disabled={disabled}
        value={this.state.value}
      />
    )
  }
}

export default Radio
