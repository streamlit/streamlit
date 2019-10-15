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
  value: string
}

class NumberInput extends React.PureComponent<Props, State> {
  public state: State = {
    dirty: false,
    value: this.props.element.get("default"),
  }

  public componentDidMount(): void {
    this.setWidgetValue({ fromUi: false })
  }

  private strIsInt = (value: string): boolean => Number(value) % 1 === 0

  private getValue = (): number => {
    const { value } = this.state

    return this.strIsInt(value) ? parseInt(value) : parseFloat(value)
  }

  private getStep = (): number => {
    const { element } = this.props
    const { value } = this.state
    const step = element.get("step")

    if (step) {
      return step
    } else {
      if (this.strIsInt(value)) {
        return 1
      } else {
        return 0.01
      }
    }
  }

  private setWidgetValue = (source: Source): void => {
    const { value } = this.state
    const { element, widgetMgr } = this.props
    const defaultValue: number = element.get("default")
    const widgetId: string = element.get("id")
    const format: string = element.get("format")

    const valueToBeSaved = value === "" ? defaultValue.toString() : value
    const formattedValue = format
      ? sprintf(format, valueToBeSaved)
      : valueToBeSaved

    if (this.strIsInt(valueToBeSaved)) {
      widgetMgr.setIntValue(widgetId, parseInt(formattedValue), source)
    } else {
      widgetMgr.setFloatValue(widgetId, parseFloat(formattedValue), source)
    }

    this.setState({
      dirty: false,
      value: formattedValue,
    })
  }

  private onBlur = (): void => {
    if (this.state.dirty) {
      this.setWidgetValue({ fromUi: true })
    }
  }

  private onChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const { value } = e.target

    this.setState({
      dirty: true,
      value,
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
    const { element } = this.props
    const step = this.getStep()
    const value = this.getValue()
    const format = element.get("format")

    switch (modifier) {
      case "increment":
        this.setState({
          dirty: true,
          value: sprintf(format, value + step),
        })
        break
      case "decrement":
        this.setState({
          dirty: true,
          value: sprintf(format, value - step),
        })
        break
    }
  }

  private startEnhancer = () => {
    return (
      <span
        className="startEnhancer"
        onClick={this.modifyValueUsingStep("decrement")}
      >
        -
      </span>
    )
  }

  private endEnhancer = () => {
    return (
      <span
        className="endEnhancer"
        onClick={this.modifyValueUsingStep("increment")}
      >
        +
      </span>
    )
  }

  private getEnhancersStyle = () => ({
    cursor: "pointer",
    padding: 0,
  })

  public render = (): React.ReactNode => {
    const { element, width, disabled } = this.props
    const { value, dirty } = this.state

    const label: string = element.get("label")
    const style = { width }
    const inputValue = value || ""

    return (
      <div className="Widget row-widget stNumberInput" style={style}>
        <label>{label}</label>
        <UIInput
          type="number"
          value={inputValue}
          onBlur={this.onBlur}
          onChange={this.onChange}
          onKeyPress={this.onKeyPress}
          onKeyDown={this.onKeyDown}
          disabled={disabled}
          startEnhancer={this.startEnhancer}
          endEnhancer={this.endEnhancer}
          overrides={{
            StartEnhancer: {
              style: this.getEnhancersStyle(),
            },
            EndEnhancer: {
              style: this.getEnhancersStyle(),
            },
            Input: {
              props: {
                step: element.get("step"),
                min: element.get("min"),
                max: element.get("max"),
              },
            },
          }}
        />
        {dirty && <div className="instructions">Press Enter to apply</div>}
      </div>
    )
  }
}

export default NumberInput
