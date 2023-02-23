/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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
import { Plus, Minus } from "@emotion-icons/open-iconic"
import { sprintf } from "sprintf-js"
import { FormClearHelper } from "src/components/widgets/Form"
import { logWarning } from "src/lib/log"
import { NumberInput as NumberInputProto } from "src/autogen/proto"
import { WidgetStateManager, Source } from "src/lib/WidgetStateManager"
import TooltipIcon from "src/components/shared/TooltipIcon"
import { Placement } from "src/components/shared/Tooltip"

import Icon from "src/components/shared/Icon"
import { Input as UIInput } from "baseui/input"
import InputInstructions from "src/components/shared/InputInstructions/InputInstructions"
import {
  WidgetLabel,
  StyledWidgetLabelHelp,
} from "src/components/widgets/BaseWidget"

import { labelVisibilityProtoValueToEnum } from "src/lib/utils"

import {
  StyledInputContainer,
  StyledInputControl,
  StyledInputControls,
  StyledInstructionsContainer,
} from "./styled-components"

export interface Props {
  disabled: boolean
  element: NumberInputProto
  widgetMgr: WidgetStateManager
  width: number
}

export interface State {
  /**
   * True if the user-specified state.value has not yet been synced to the WidgetStateManager.
   */
  dirty: boolean

  /**
   * The value specified by the user via the UI. If the user didn't touch this
   * widget's UI, the default value is used.
   */
  value: number

  /**
   * The value with applied format that is going to be shown to the user
   */
  formattedValue: string

  /**
   * True if the input is selected
   */
  isFocused: boolean
}

class NumberInput extends React.PureComponent<Props, State> {
  private readonly formClearHelper = new FormClearHelper()

  private inputRef = React.createRef<HTMLInputElement | HTMLTextAreaElement>()

  constructor(props: Props) {
    super(props)

    this.state = {
      dirty: false,
      value: this.initialValue,
      formattedValue: this.formatValue(this.initialValue),
      isFocused: false,
    }
  }

  get initialValue(): number {
    // If WidgetStateManager knew a value for this widget, initialize to that.
    // Otherwise, use the default value from the widget protobuf
    const storedValue = this.isIntData()
      ? this.props.widgetMgr.getIntValue(this.props.element)
      : this.props.widgetMgr.getDoubleValue(this.props.element)

    return storedValue !== undefined ? storedValue : this.props.element.default
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
    this.setState({ value, formattedValue: this.formatValue(value) }, () => {
      this.commitWidgetValue({ fromUi: false })
    })
  }

  private formatValue = (value: number): string => {
    const format = getNonEmptyString(this.props.element.format)
    if (format == null) {
      return value.toString()
    }

    try {
      return sprintf(format, value)
    } catch (e) {
      // Don't explode if we have a malformed format string.
      logWarning(`Error in sprintf(${format}, ${value}): ${e}`)
      return String(value)
    }
  }

  private isIntData = (): boolean => {
    return this.props.element.dataType === NumberInputProto.DataType.INT
  }

  private getMin = (): number => {
    return this.props.element.hasMin ? this.props.element.min : -Infinity
  }

  private getMax = (): number => {
    return this.props.element.hasMax ? this.props.element.max : +Infinity
  }

  private getStep = (): number => {
    const { step } = this.props.element

    if (step) {
      return step
    }
    if (this.isIntData()) {
      return 1
    }
    return 0.01
  }

  /** Commit state.value to the WidgetStateManager. */
  private commitWidgetValue = (source: Source): void => {
    const { value } = this.state
    const { element, widgetMgr } = this.props
    const data = this.props.element

    const min = this.getMin()
    const max = this.getMax()

    if (min > value || value > max) {
      const node = this.inputRef.current
      if (node) {
        node.reportValidity()
      }
    } else {
      const valueToBeSaved = value || value === 0 ? value : data.default

      if (this.isIntData()) {
        widgetMgr.setIntValue(element, valueToBeSaved, source)
      } else {
        widgetMgr.setDoubleValue(element, valueToBeSaved, source)
      }

      this.setState({
        dirty: false,
        value: valueToBeSaved,
        formattedValue: this.formatValue(valueToBeSaved),
      })
    }
  }

  /**
   * If we're part of a clear_on_submit form, this will be called when our
   * form is submitted. Restore our default value and update the WidgetManager.
   */
  private onFormCleared = (): void => {
    this.setState(
      (_, prevProps) => {
        return { value: prevProps.element.default }
      },
      () => this.commitWidgetValue({ fromUi: true })
    )
  }

  private onBlur = (): void => {
    if (this.state.dirty) {
      this.commitWidgetValue({ fromUi: true })
    }

    this.setState({ isFocused: false })
  }

  private onFocus = (): void => {
    this.setState({ isFocused: true })
  }

  private getNumberFromFormattedString(value: string): number | undefined {
    const format = getNonEmptyString(this.props.element.format)
    if (!format) {
      throw new Error("No format object available on number input element.")
    }

    const specifier = /(%[^%]?.*?(d|e|f|g|i|u))/
    const match = specifier.exec(format)

    if (match === null) {
      throw new Error("No specifier in format.")
    }

    const formatPrefix = format.slice(0, match.index)
    const unescapeFormatPrefix = formatPrefix.replaceAll("%%", "%")
    const valuePrefix = value.slice(0, unescapeFormatPrefix.length)

    if (valuePrefix !== unescapeFormatPrefix) {
      return undefined
    }

    const formatSuffix = format.slice(match[0].length)
    const unescapedFormatSuffix = formatSuffix.replaceAll("%%", "%")
    const valueSuffix =
      unescapedFormatSuffix.length > 0
        ? value.slice(-unescapedFormatSuffix.length)
        : ""

    const suffixIndex = value.length - unescapedFormatSuffix.length
    if (valueSuffix !== unescapedFormatSuffix) {
      return undefined
    }

    if (suffixIndex < valuePrefix.length + 1) {
      return undefined
    }

    const resultStr = value.slice(unescapeFormatPrefix.length, suffixIndex)
    const resultNum = Number(resultStr)

    if (Number.isNaN(resultNum)) {
      return undefined
    }

    return resultNum
  }

  private onChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ): void => {
    const targetValue = e.target.value.trim()

    let parsedValue
    try {
      parsedValue = this.getNumberFromFormattedString(targetValue)
    } catch (ex) {
      // Ignore the caught exception.  We want customers to be able to
      // make mistakes in their data input and have the opportunity to
      // correct those mistakes.
    }
    if (parsedValue !== undefined) {
      this.setState({
        dirty: true,
        value: parsedValue as number,
        formattedValue: targetValue,
      })
    } else {
      // need to save the in-flight formatted value
      const { value } = this.state
      this.setState({
        dirty: false,
        value,
        formattedValue: targetValue,
      })
    }
  }

  private onKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
  ): void => {
    const { key } = e

    switch (key) {
      case "ArrowUp":
        e.preventDefault()

        this.modifyValueUsingStep("increment")()
        break
      case "ArrowDown":
        e.preventDefault()

        this.modifyValueUsingStep("decrement")()
        break
      default: // Do nothing
    }
  }

  private onKeyPress = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
  ): void => {
    if (e.key === "Enter" && this.state.dirty) {
      this.commitWidgetValue({ fromUi: true })
    }
  }

  /** True if the input's current value can be decremented by its step. */
  private get canDecrement(): boolean {
    return this.state.value - this.getStep() >= this.getMin()
  }

  /** True if the input's current value can be incremented by its step. */
  private get canIncrement(): boolean {
    return this.state.value + this.getStep() <= this.getMax()
  }

  private modifyValueUsingStep =
    (modifier: "increment" | "decrement"): any =>
    (): void => {
      const { value } = this.state
      const step = this.getStep()

      switch (modifier) {
        case "increment":
          if (this.canIncrement) {
            this.setState(
              {
                dirty: true,
                value: value + step,
              },
              () => {
                this.commitWidgetValue({ fromUi: true })
              }
            )
          }
          break
        case "decrement":
          if (this.canDecrement) {
            this.setState(
              {
                dirty: true,
                value: value - step,
              },
              () => {
                this.commitWidgetValue({ fromUi: true })
              }
            )
          }
          break
        default: // Do nothing
      }
    }

  public render(): React.ReactNode {
    const { element, width, disabled, widgetMgr } = this.props
    const { formattedValue, dirty, isFocused } = this.state

    const style = { width }

    const disableDecrement = !this.canDecrement || disabled
    const disableIncrement = !this.canIncrement || disabled

    // Manage our form-clear event handler.
    this.formClearHelper.manageFormClearListener(
      widgetMgr,
      element.formId,
      this.onFormCleared
    )

    return (
      <div className="stNumberInput" style={style}>
        <WidgetLabel
          label={element.label}
          disabled={disabled}
          labelVisibility={labelVisibilityProtoValueToEnum(
            element.labelVisibility?.value
          )}
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
        <StyledInputContainer className={isFocused ? "focused" : ""}>
          <UIInput
            type="text"
            inputRef={this.inputRef}
            value={formattedValue}
            onBlur={this.onBlur}
            onFocus={this.onFocus}
            onChange={this.onChange}
            onKeyPress={this.onKeyPress}
            onKeyDown={this.onKeyDown}
            disabled={disabled}
            aria-label={element.label}
            overrides={{
              Input: {
                props: {
                  step: this.getStep(),
                  min: this.getMin(),
                  max: this.getMax(),
                },
                style: {
                  lineHeight: "1.4",
                  // Baseweb requires long-hand props, short-hand leads to weird bugs & warnings.
                  paddingRight: ".5rem",
                  paddingLeft: ".5rem",
                  paddingBottom: ".5rem",
                  paddingTop: ".5rem",
                },
              },
              InputContainer: {
                style: () => ({
                  borderTopRightRadius: 0,
                  borderBottomRightRadius: 0,
                }),
              },
              Root: {
                style: () => ({
                  borderTopRightRadius: 0,
                  borderBottomRightRadius: 0,
                  // Baseweb requires long-hand props, short-hand leads to weird bugs & warnings.
                  borderLeftWidth: 0,
                  borderRightWidth: 0,
                  borderTopWidth: 0,
                  borderBottomWidth: 0,
                }),
              },
            }}
          />
          <StyledInputControls>
            <StyledInputControl
              className="step-down"
              onClick={this.modifyValueUsingStep("decrement")}
              disabled={disableDecrement}
            >
              <Icon
                content={Minus}
                size="xs"
                color={this.canDecrement ? "inherit" : "disabled"}
              />
            </StyledInputControl>
            <StyledInputControl
              className="step-up"
              onClick={this.modifyValueUsingStep("increment")}
              disabled={disableIncrement}
            >
              <Icon
                content={Plus}
                size="xs"
                color={this.canIncrement ? "inherit" : "disabled"}
              />
            </StyledInputControl>
          </StyledInputControls>
        </StyledInputContainer>
        <StyledInstructionsContainer>
          <InputInstructions
            dirty={dirty}
            value={formattedValue}
            className="input-instructions"
          />
        </StyledInstructionsContainer>
      </div>
    )
  }
}

/**
 * Return a string property from an element. If the string is
 * null or empty, return undefined instead.
 */
function getNonEmptyString(
  value: string | null | undefined
): string | undefined {
  return value == null || value === "" ? undefined : value
}

export default NumberInput
