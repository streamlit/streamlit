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
import { withTheme } from "emotion-theming"
import { Radio as UIRadio, RadioGroup } from "baseui/radio"
import { Radio as RadioProto } from "autogen/proto"
import { WidgetStateManager, Source } from "lib/WidgetStateManager"
import { StyledWidgetLabel } from "components/widgets/BaseWidget"
import { Theme } from "theme"

export interface Props {
  disabled: boolean
  element: RadioProto
  theme: Theme
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
    const storedValue = this.props.widgetMgr.getIntValue(this.props.element)
    return storedValue !== undefined ? storedValue : this.props.element.default
  }

  public componentDidMount(): void {
    this.setWidgetValue({ fromUi: false })
  }

  private setWidgetValue = (source: Source): void => {
    this.props.widgetMgr.setIntValue(
      this.props.element,
      this.state.value,
      source
    )
  }

  private onChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = parseInt(e.target.value, 10)
    this.setState({ value }, () => this.setWidgetValue({ fromUi: true }))
  }

  public render = (): React.ReactNode => {
    const { disabled, element, theme, width } = this.props
    const { colors, fontSizes, radii } = theme
    const style = { width }
    let { options } = element
    let isDisabled = disabled

    if (options.length === 0) {
      options = ["No options to select."]
      isDisabled = true
    }

    return (
      <div className="row-widget stRadio" style={style}>
        <StyledWidgetLabel>{this.props.element.label}</StyledWidgetLabel>
        <RadioGroup
          onChange={this.onChange}
          value={this.state.value.toString()}
          disabled={isDisabled}
        >
          {options.map((option: string, index: number) => (
            <UIRadio
              key={index}
              value={index.toString()}
              overrides={{
                Root: {
                  style: ({ $isFocused }: { $isFocused: boolean }) => ({
                    marginBottom: 0,
                    marginTop: 0,
                    paddingRight: fontSizes.twoThirdSmDefault,
                    backgroundColor: $isFocused ? colors.lightestGray : "",
                    borderTopLeftRadius: radii.md,
                    borderTopRightRadius: radii.md,
                    borderBottomLeftRadius: radii.md,
                    borderBottomRightRadius: radii.md,
                  }),
                },
                RadioMarkInner: {
                  style: ({ $checked }: { $checked: boolean }) => ({
                    height: $checked ? "6px" : "16px",
                    width: $checked ? "6px" : "16px",
                  }),
                },
                Label: {
                  style: {
                    color: colors.bodyText,
                  },
                },
              }}
            >
              {option}
            </UIRadio>
          ))}
        </RadioGroup>
      </div>
    )
  }
}

export default withTheme(Radio)
