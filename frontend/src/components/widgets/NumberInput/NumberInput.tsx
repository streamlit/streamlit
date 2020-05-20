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
import { sprintf } from "sprintf-js"
import { logWarning } from "lib/log"
import { Map as ImmutableMap } from "immutable"
import { NumberInput as NumberInputProto } from "autogen/proto"
import { WidgetStateManager, Source } from "lib/WidgetStateManager"

import Icon from "components/shared/Icon"
import { Input as UIInput } from "baseui/input"
import InputInstructions from "components/shared/InputInstructions/InputInstructions"

import "./NumberInput.scss"

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

    const defaultValue = this.props.element.get("default")

    this.state = {
      dirty: false,
      value: defaultValue,
      formattedValue: this.formatValue(defaultValue),
    }
  }

  public componentDidMount(): void {
    this.setWidgetValue({ fromUi: false })
  }

  private formatValue = (value: number): string => {
    const format: string = this.props.element.get("format")
    if (format == null) {
      return String(value)
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
    return this.props.element.get("dataType") === NumberInputProto.DataType.INT
  }

  private getMin = (): number => {
    return this.props.element.get("hasMin")
      ? this.props.element.get("min")
      : -Infinity
  }

  private getMax = (): number => {
    return this.props.element.get("hasMax")
      ? this.props.element.get("max")
      : +Infinity
  }

  private getStep = (): number => {
    const step = this.props.element.get("step")

    if (step) {
      return step
    } else {
      if (this.isIntData()) {
        return 1
      } else {
        return 0.01
      }
    }
  }

  private setWidgetValue = (source: Source): void => {
    const { value } = this.state
    const { element, widgetMgr } = this.props
    const data = this.props.element

    const widgetId: string = element.get("id")
    const min: number = this.getMin()
    const max: number = this.getMax()

    if (min > value || value > max) {
      const node = this.inputRef.current
      node && node.reportValidity()
    } else {
      const valueToBeSaved = value || value === 0 ? value : data.get("default")

      if (this.isIntData()) {
        widgetMgr.setIntValue(widgetId, valueToBeSaved, source)
      } else {
        widgetMgr.setFloatValue(widgetId, valueToBeSaved, source)
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
      numValue = parseInt(value)
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
    }
  }

  public render = (): React.ReactNode => {
    const { element, width, disabled } = this.props
    const { formattedValue, dirty } = this.state

    const label: string = element.get("label")
    const style = { width }

    return (
      <div className="Widget row-widget stNumberInput" style={style}>
        <label>{label}</label>
        <div className="input-container">
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
            }}
          />
          <div className="controls">
            <button
              className="control step-down"
              onClick={this.modifyValueUsingStep("decrement")}
            >
              <Icon type="minus" />
            </button>
            <button
              className="control step-up"
              onClick={this.modifyValueUsingStep("increment")}
            >
              <Icon type="plus" />
            </button>
          </div>
        </div>
        <InputInstructions
          dirty={dirty}
          value={formattedValue}
          className="input-instructions"
        />
      </div>
    )
  }
}

export default NumberInput
