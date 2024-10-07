/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from "react"

import uniqueId from "lodash/uniqueId"
import { Input as UIInput } from "baseui/input"
import { withTheme } from "@emotion/react"

import { TextInput as TextInputProto } from "@streamlit/lib/src/proto"
import { FormClearHelper } from "@streamlit/lib/src/components/widgets/Form"
import {
  Source,
  WidgetStateManager,
} from "@streamlit/lib/src/WidgetStateManager"
import InputInstructions from "@streamlit/lib/src/components/shared/InputInstructions/InputInstructions"
import {
  StyledWidgetLabelHelp,
  WidgetLabel,
} from "@streamlit/lib/src/components/widgets/BaseWidget"
import TooltipIcon from "@streamlit/lib/src/components/shared/TooltipIcon"
import { Placement } from "@streamlit/lib/src/components/shared/Tooltip"
import {
  isInForm,
  labelVisibilityProtoValueToEnum,
} from "@streamlit/lib/src/util/utils"
import { EmotionTheme } from "@streamlit/lib/src/theme"

import { StyledTextInput } from "./styled-components"

export interface Props {
  disabled: boolean
  element: TextInputProto
  widgetMgr: WidgetStateManager
  width: number
  theme: EmotionTheme
  fragmentId?: string
}

interface State {
  /**
   * True if the user-specified state.value has not yet been synced to the WidgetStateManager.
   */
  dirty: boolean

  /**
   * Whether the input is currently focused.
   */
  focused: boolean

  /**
   * The value specified by the user via the UI. If the user didn't touch this
   * widget's UI, the default value is used.
   */
  value: string | null
}

class TextInput extends React.PureComponent<Props, State> {
  private readonly formClearHelper = new FormClearHelper()

  private readonly id: string

  public state: State = {
    dirty: false,
    focused: false,
    value: this.initialValue,
  }

  constructor(props: Props) {
    super(props)
    this.id = uniqueId("text_input_")
  }

  private get initialValue(): string | null {
    // If WidgetStateManager knew a value for this widget, initialize to that.
    // Otherwise, use the default value from the widget protobuf.
    const storedValue = this.props.widgetMgr.getStringValue(this.props.element)
    return storedValue ?? this.props.element.default ?? null
  }

  public componentDidMount(): void {
    if (this.props.element.setValue) {
      this.updateFromProtobuf()
    } else {
      this.commitWidgetValue({ fromUi: false })
    }
  }

  public componentDidUpdate(): void {
    this.maybeUpdateFromProtobuf()
  }

  public componentWillUnmount(): void {
    this.formClearHelper.disconnect()
  }

  private maybeUpdateFromProtobuf(): void {
    const { setValue } = this.props.element
    if (setValue) {
      this.updateFromProtobuf()
    }
  }

  private updateFromProtobuf(): void {
    const { value } = this.props.element
    this.props.element.setValue = false
    this.setState({ value: value ?? null }, () => {
      this.commitWidgetValue({ fromUi: false })
    })
  }

  /**
   * Commits the current state value to the WidgetStateManager.
   *
   * @param source - Whether or not from the UI
   * @param updateState - Optional flag to determine if the state should be updated
   *                      to reflect that the value is no longer 'dirty' or modified.
   *                      By default, this is true, meaning the state WILL be updated.
   */
  private commitWidgetValue = (source: Source, updateState = true): void => {
    const { widgetMgr, element, fragmentId } = this.props
    widgetMgr.setStringValue(element, this.state.value, source, fragmentId)
    if (updateState) {
      this.setState({ dirty: false })
    }
  }

  /**
   * If we're part of a clear_on_submit form, this will be called when our
   * form is submitted. Restore our default value and update the WidgetManager.
   */
  private onFormCleared = (): void => {
    this.setState(
      (_, prevProps) => {
        return { value: prevProps.element.default ?? null }
      },
      () => this.commitWidgetValue({ fromUi: true })
    )
  }

  private onBlur = (): void => {
    if (this.state.dirty) {
      this.commitWidgetValue({ fromUi: true })
    }

    this.setState({ focused: false })
  }

  private onFocus = (): void => this.setState({ focused: true })

  private onChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ): void => {
    const { value } = e.target
    const { element } = this.props
    const { maxChars } = element

    if (maxChars !== 0 && value.length > maxChars) {
      return
    }

    // we immediately update its widgetValue on text changes in forms
    // see here for why: https://github.com/streamlit/streamlit/issues/7101
    // The widgetValue won't be passed to the Python script until the form
    // is submitted, so this won't cause the script to re-run.
    if (isInForm(this.props.element)) {
      // make sure dirty is true so that enter to submit form text shows
      this.setState({ dirty: true, value }, () => {
        this.commitWidgetValue({ fromUi: true }, false)
      })
    }
    // If the TextInput is *not* part of a form, we mark it dirty but don't
    // update its value in the WidgetMgr. This means that individual keypresses
    // won't trigger a script re-run.
    else {
      // make sure dirty is true so that enter to apply text shows
      this.setState({ dirty: true, value })
    }
  }

  private onKeyPress = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
  ): void => {
    const { element, widgetMgr, fragmentId } = this.props
    const { formId } = element
    const allowFormEnterToSubmit = widgetMgr.allowFormEnterToSubmit(formId)

    if (e.key === "Enter") {
      if (this.state.dirty) {
        this.commitWidgetValue({ fromUi: true })
      }
      if (allowFormEnterToSubmit) {
        widgetMgr.submitForm(formId, fragmentId)
      }
    }
  }

  private getTypeString(): string | undefined {
    return this.props.element.type === TextInputProto.Type.PASSWORD
      ? "password"
      : "text"
  }

  public render(): React.ReactNode {
    const { dirty, focused, value } = this.state
    const { element, width, disabled, widgetMgr, theme } = this.props
    const { placeholder, formId } = element

    // Show "Please enter" instructions if in a form & allowed, or not in form and state is dirty.
    const allowEnterToSubmit = isInForm({ formId })
      ? widgetMgr.allowFormEnterToSubmit(formId)
      : dirty

    // Hide input instructions for small widget sizes.
    const shouldShowInstructions =
      focused && width > theme.breakpoints.hideWidgetDetails

    // Manage our form-clear event handler.
    this.formClearHelper.manageFormClearListener(
      widgetMgr,
      formId,
      this.onFormCleared
    )

    return (
      <StyledTextInput
        className="stTextInput"
        data-testid="stTextInput"
        width={width}
      >
        <WidgetLabel
          label={element.label}
          disabled={disabled}
          labelVisibility={labelVisibilityProtoValueToEnum(
            element.labelVisibility?.value
          )}
          htmlFor={this.id}
        >
          {element.help && (
            <StyledWidgetLabelHelp>
              <TooltipIcon
                content={element.help}
                placement={Placement.TOP_RIGHT}
              />
            </StyledWidgetLabelHelp>
          )}
        </WidgetLabel>
        <UIInput
          value={value ?? ""}
          placeholder={placeholder}
          onBlur={this.onBlur}
          onFocus={this.onFocus}
          onChange={this.onChange}
          onKeyPress={this.onKeyPress}
          aria-label={element.label}
          disabled={disabled}
          id={this.id}
          type={this.getTypeString()}
          autoComplete={element.autocomplete}
          overrides={{
            Input: {
              style: {
                // Issue: https://github.com/streamlit/streamlit/issues/2495
                // The input won't shrink in Firefox,
                // unless the line below is provided.
                // See https://stackoverflow.com/a/33811151
                minWidth: 0,
                "::placeholder": {
                  opacity: "0.7",
                },
                lineHeight: theme.lineHeights.inputWidget,
                // Baseweb requires long-hand props, short-hand leads to weird bugs & warnings.
                paddingRight: theme.spacing.sm,
                paddingLeft: theme.spacing.sm,
                paddingBottom: theme.spacing.sm,
                paddingTop: theme.spacing.sm,
              },
            },
            Root: {
              props: {
                "data-testid": "stTextInputRootElement",
              },
              style: {
                height: theme.sizes.minElementHeight,
                // Baseweb requires long-hand props, short-hand leads to weird bugs & warnings.
                borderLeftWidth: theme.sizes.borderWidth,
                borderRightWidth: theme.sizes.borderWidth,
                borderTopWidth: theme.sizes.borderWidth,
                borderBottomWidth: theme.sizes.borderWidth,
              },
            },
          }}
        />
        {shouldShowInstructions && (
          <InputInstructions
            dirty={dirty}
            value={value ?? ""}
            maxLength={element.maxChars}
            inForm={isInForm({ formId })}
            allowEnterToSubmit={allowEnterToSubmit}
          />
        )}
      </StyledTextInput>
    )
  }
}

export default withTheme(TextInput)
