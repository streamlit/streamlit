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
import { Input as UIInput } from "baseui/input"
import { Map as ImmutableMap } from "immutable"
import { TextInput as TextInputProto } from "autogen/proto"
import { WidgetStateManager, Source } from "lib/WidgetStateManager"
import InputInstructions from "components/shared/InputInstructions/InputInstructions"

export interface Props {
  disabled: boolean
  element: ImmutableMap<string, any>
  widgetMgr: WidgetStateManager
  width: number
}

interface State {
  /**
   * True if the user-specified state.value has not yet been synced to the WidgetStateManager.
   */
  dirty: boolean

  /**
   * The value specified by the user via the UI. If the user didn't touch this
   * widget's UI, the default value is used.
   */
  value: string
}

class TextInput extends React.PureComponent<Props, State> {
  public state: State = {
    dirty: false,
    value: this.props.element.get("default"),
  }

  public componentDidMount(): void {
    this.setWidgetValue({ fromUi: false })
  }

  private setWidgetValue = (source: Source): void => {
    const widgetId: string = this.props.element.get("id")
    this.props.widgetMgr.setStringValue(widgetId, this.state.value, source)
    this.setState({ dirty: false })
  }

  private onBlur = (): void => {
    if (this.state.dirty) {
      this.setWidgetValue({ fromUi: true })
    }
  }

  private onChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const { value } = e.target
    const { element } = this.props

    const maxChars = element.get("maxChars")

    if (!maxChars || value.length <= maxChars) {
      this.setState({
        dirty: true,
        value,
      })
    }
  }

  private onKeyPress = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Enter" && this.state.dirty) {
      this.setWidgetValue({ fromUi: true })
    }
  }

  private getTypeString(): string | undefined {
    return this.props.element.get("type") === TextInputProto.Type.PASSWORD
      ? "password"
      : undefined
  }

  public render = (): React.ReactNode => {
    const { dirty, value } = this.state
    const { element, width, disabled } = this.props

    const label: string = element.get("label")
    const maxChars = element.get("maxChars")
    const style = { width }

    return (
      <div className="Widget row-widget stTextInput" style={style}>
        <label>{label}</label>
        <UIInput
          value={value}
          onBlur={this.onBlur}
          onChange={this.onChange}
          onKeyPress={this.onKeyPress}
          disabled={disabled}
          type={this.getTypeString()}
        />
        <InputInstructions dirty={dirty} value={value} maxLength={maxChars} />
      </div>
    )
  }
}

export default TextInput
