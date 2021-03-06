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
import { Input as UIInput } from "baseui/input"
import { TextInput as TextInputProto } from "autogen/proto"
import { WidgetStateManager, Source } from "lib/WidgetStateManager"
import InputInstructions from "components/shared/InputInstructions/InputInstructions"
import { StyledWidgetLabel } from "components/widgets/BaseWidget"

export interface Props {
  disabled: boolean
  element: TextInputProto
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
    value: this.initialValue,
  }

  get initialValue(): string {
    // If WidgetStateManager knew a value for this widget, initialize to that.
    // Otherwise, use the default value from the widget protobuf.
    const widgetId = this.props.element.id
    const storedValue = this.props.widgetMgr.getStringValue(widgetId)
    return storedValue !== undefined ? storedValue : this.props.element.default
  }

  public componentDidMount(): void {
    this.setWidgetValue({ fromUi: false })
  }

  private setWidgetValue = (source: Source): void => {
    const widgetId = this.props.element.id
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
    const { maxChars } = element

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
    return this.props.element.type === TextInputProto.Type.PASSWORD
      ? "password"
      : "text"
  }

  public render = (): React.ReactNode => {
    const { dirty, value } = this.state
    const { element, width, disabled } = this.props
    const style = { width }

    return (
      <div className="row-widget stTextInput" style={style}>
        <StyledWidgetLabel>{element.label}</StyledWidgetLabel>
        <UIInput
          value={value}
          onBlur={this.onBlur}
          onChange={this.onChange}
          onKeyPress={this.onKeyPress}
          disabled={disabled}
          type={this.getTypeString()}
          overrides={{
            Input: {
              style: {
                // Issue: https://github.com/streamlit/streamlit/issues/2495
                // The input won't shrink in Firefox,
                // unless the line below is provided.
                // See https://stackoverflow.com/a/33811151
                minWidth: 0,
              },
            },
          }}
        />
        <InputInstructions
          dirty={dirty}
          value={value}
          maxLength={element.maxChars}
        />
      </div>
    )
  }
}

export default TextInput
