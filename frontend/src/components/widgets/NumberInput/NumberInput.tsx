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
import { Plus, Minus } from "@emotion-icons/open-iconic"
import { sprintf } from "sprintf-js"
import { logWarning } from "lib/log"
import { NumberInput as NumberInputProto } from "autogen/proto"
import { WidgetStateManager, Source } from "lib/WidgetStateManager"

import Icon from "components/shared/Icon"
import { Input as UIInput } from "baseui/input"
import InputInstructions from "components/shared/InputInstructions/InputInstructions"
import { StyledWidgetLabel } from "components/widgets/BaseWidget"
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

interface State {
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
}

class NumberInput extends React.PureComponent<Props, State> {
  private inputRef = React.createRef<HTMLInputElement>()

  constructor(props: Props) {
    super(props)

    this.state = {
      dirty: false,
      value: this.initialValue,
      formattedValue: this.formatValue(this.initialValue),
    }
  }

  get initialValue(): number {
    // If WidgetStateManager knew a value for this widget, initialize to that.
    // Otherwise, use the default value from the widget protobuf
    const widgetId = this.props.element.id
    const storedValue = this.props.widgetMgr.getIntValue(widgetId)
    return storedValue !== undefined ? storedValue : this.props.element.default
  }

  public componentDidMount(): void {
    this.setWidgetValue({ fromUi: false })
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

  private setWidgetValue = (source: Source): void => {
    const { value } = this.state
    const { element, widgetMgr } = this.props
    const data = this.props.element

    const widgetId = element.id
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
        widgetMgr.setIntValue(widgetId, valueToBeSaved, source)
      } else {
        widgetMgr.setDoubleValue(widgetId, valueToBeSaved, source)
      }

      this.setState({
        dirty: false,
        value: valueToBeSaved,
        formattedValue: this.formatValue(valueToBeSaved),
      })
    }
  }

  private onBlur = (): void => {
    if (this.state.dirty) {
      this.setWidgetValue({ fromUi: true })
    }
  }

  private onChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const { value } = e.target

    let numValue = null

    if (this.isIntData()) {
      numValue = parseInt(value, 10)
    } else {
      numValue = parseFloat(value)
    }

    this.setState({
      dirty: true,
      value: numValue,
      formattedValue: value,
    })
  }

  private onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
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

  private onKeyPress = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Enter" && this.state.dirty) {
      this.setWidgetValue({ fromUi: true })
    }
  }

  private modifyValueUsingStep = (
    modifier: "increment" | "decrement"
  ): any => (): void => {
    const { value } = this.state
    const step = this.getStep()
    const min = this.getMin()
    const max = this.getMax()

    switch (modifier) {
      case "increment":
        if (value + step <= max) {
          this.setState(
            {
              dirty: true,
              value: value + step,
            },
            () => {
              this.setWidgetValue({ fromUi: true })
            }
          )
        }
        break
      case "decrement":
        if (value - step >= min) {
          this.setState(
            {
              dirty: true,
              value: value - step,
            },
            () => {
              this.setWidgetValue({ fromUi: true })
            }
          )
        }
        break
      default: // Do nothing
    }
  }

  public render = (): React.ReactNode => {
    const { element, width, disabled } = this.props
    const { formattedValue, dirty } = this.state

    const style = { width }

    return (
      <div className="stNumberInput" style={style}>
        <StyledWidgetLabel>{element.label}</StyledWidgetLabel>
        <StyledInputContainer>
          <UIInput
            type="number"
            inputRef={this.inputRef}
            value={formattedValue}
            onBlur={this.onBlur}
            onChange={this.onChange}
            onKeyPress={this.onKeyPress}
            onKeyDown={this.onKeyDown}
            disabled={disabled}
            overrides={{
              Input: {
                props: {
                  step: this.getStep(),
                  min: this.getMin(),
                  max: this.getMax(),
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
                }),
              },
            }}
          />
          <StyledInputControls>
            <StyledInputControl
              className="step-down"
              onClick={this.modifyValueUsingStep("decrement")}
            >
              <Icon content={Minus} size="xs" />
            </StyledInputControl>
            <StyledInputControl
              className="step-up"
              onClick={this.modifyValueUsingStep("increment")}
            >
              <Icon content={Plus} size="xs" />
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
