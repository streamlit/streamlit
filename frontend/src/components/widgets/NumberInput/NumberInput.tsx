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
import { sprintf } from "sprintf-js"
import { Input as UIInput } from "baseui/input"
import { Map as ImmutableMap } from "immutable"
import { WidgetStateManager, Source } from "lib/WidgetStateManager"

import Icon from "components/shared/Icon"

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
}

class NumberInput extends React.PureComponent<Props, State> {
  private inputRef = React.createRef<HTMLInputElement>()

  private formatValue = false

  constructor(props: Props) {
    super(props)

    this.onChange = this.onChange.bind(this)
    this.onKeyDown = this.onKeyDown.bind(this)
    this.onKeyPress = this.onKeyPress.bind(this)

    this.state = {
      dirty: false,
      // Todo: format the value here in case the user passed in something crazy
      value: this.getData().get("default"),
    }
  }

  public componentDidMount(): void {
    this.setWidgetValue({ fromUi: false })
  }

  private getData = (): ImmutableMap<string, any> => {
    const { element } = this.props
    return element.get("intData") || element.get("floatData")
  }

  private isIntData = (): boolean => {
    return this.props.element.get("intData") ? true : false
  }

  private getStep = (): number => {
    const step = this.getData().get("step")

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
    const widgetId: string = element.get("id")
    const min: number = this.getData().get("min")
    const max: number = this.getData().get("max")

    if (min > value || value > max) {
      const node = this.inputRef.current
      node && node.reportValidity()
    } else {
      if (this.isIntData()) {
        widgetMgr.setIntValue(widgetId, value, source)
      } else {
        widgetMgr.setFloatValue(widgetId, value, source)
      }

      this.setState({ dirty: false }, () => {
        this.formatValue = true
      })
    }
  }

  private onBlur = (): void => {
    if (this.state.dirty) {
      this.setWidgetValue({ fromUi: true })
    }
  }

  private onChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    debugger

    const { value } = e.target

    // If the user enters an invalid number, don't update the state, ex 1..
    if (!value) {
      return
    }

    let numValue = null

    if (this.isIntData()) {
      numValue = parseInt(value)
    } else {
      numValue = parseFloat(value)
    }

    this.setState({
      dirty: true,
      value: numValue,
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
    const min = this.getData().get("min")
    const max = this.getData().get("max")

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
    const { value, dirty } = this.state

    const format: string = element.get("format")
    const label: string = element.get("label")
    const style = { width }

    const data = this.getData()

    const displayValue = this.formatValue
      ? sprintf(format, value)
      : String(value)
    this.formatValue = false

    return (
      <div className="Widget row-widget stNumberInput" style={style}>
        <label>{label}</label>
        <div className="input-container">
          <UIInput
            type="number"
            inputRef={this.inputRef}
            value={displayValue}
            onBlur={this.onBlur}
            onChange={this.onChange}
            onKeyPress={this.onKeyPress}
            onKeyDown={this.onKeyDown}
            disabled={disabled}
            overrides={{
              Input: {
                props: {
                  step: data.get("step"),
                  min: data.get("min"),
                  max: data.get("max"),
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
        {dirty && <div className="instructions">Press Enter to apply</div>}
      </div>
    )
  }
}

export default NumberInput
