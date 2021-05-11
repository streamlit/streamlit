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
import { TextInput as TextInputProto } from "src/autogen/proto"
import { WidgetStateManager, Source } from "src/lib/WidgetStateManager"
import InputInstructions from "src/components/shared/InputInstructions/InputInstructions"
import {
  StyledWidgetLabel,
  StyledWidgetLabelHelp,
} from "src/components/widgets/BaseWidget"
import TooltipIcon from "src/components/shared/TooltipIcon"
import { Placement } from "src/components/shared/Tooltip"
import { isInForm } from "src/lib/utils"
import { SignalConnection } from "typed-signals"
import { StyledTextInput } from "./styled-components"

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
  private formClearListener?: SignalConnection

  public state: State = {
    dirty: false,
    value: this.initialValue,
  }

  private get initialValue(): string {
    // If WidgetStateManager knew a value for this widget, initialize to that.
    // Otherwise, use the default value from the widget protobuf.
    const storedValue = this.props.widgetMgr.getStringValue(this.props.element)
    return storedValue !== undefined ? storedValue : this.props.element.default
  }

  public componentDidMount(): void {
    this.commitWidgetValue({ fromUi: false })
    if (isInForm(this.props.element)) {
      this.formClearListener = this.props.widgetMgr.addFormClearedListener(
        this.props.element.formId,
        this.onFormCleared
      )
    }
  }

  public componentWillUnmount(): void {
    this.formClearListener?.disconnect()
  }

  private onFormCleared = (): void => {
    this.setState({ value: this.props.element.default }, () =>
      this.commitWidgetValue({ fromUi: false })
    )
  }

  /** Commit state.value to the WidgetStateManager. */
  private commitWidgetValue = (source: Source): void => {
    this.props.widgetMgr.setStringValue(
      this.props.element,
      this.state.value,
      source
    )
    this.setState({ dirty: false })
  }

  private onBlur = (): void => {
    if (this.state.dirty) {
      this.commitWidgetValue({ fromUi: true })
    }
  }

  private onChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const { value } = e.target
    const { element } = this.props
    const { maxChars } = element

    if (maxChars !== 0 && value.length > maxChars) {
      return
    }

    // If the TextInput is *not* part of a form, we mark it dirty but don't
    // update its value in the WidgetMgr. This means that individual keypresses
    // won't trigger a script re-run.
    if (!isInForm(this.props.element)) {
      this.setState({ dirty: true, value })
      return
    }

    // If TextInput *is* part of a form, we immediately update its widgetValue
    // on text changes. The widgetValue won't be passed to the Python
    // script until the form is submitted, so this won't cause the report
    // to re-run. (This also means that we won't show the "Press Enter
    // to Apply" prompt because the TextInput will never be "dirty").
    this.setState({ dirty: false, value }, () =>
      this.commitWidgetValue({ fromUi: true })
    )
  }

  private onKeyPress = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Enter" && this.state.dirty) {
      this.commitWidgetValue({ fromUi: true })
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

    return (
      <StyledTextInput className="row-widget stTextInput" width={width}>
        <StyledWidgetLabel>{element.label}</StyledWidgetLabel>
        {element.help && (
          <StyledWidgetLabelHelp>
            <TooltipIcon
              content={element.help}
              placement={Placement.TOP_RIGHT}
            />
          </StyledWidgetLabelHelp>
        )}
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
      </StyledTextInput>
    )
  }
}

export default TextInput
