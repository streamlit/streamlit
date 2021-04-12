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
import { withTheme } from "emotion-theming"
import { Radio as UIRadio, RadioGroup } from "baseui/radio"
import {
  StyledWidgetLabel,
  StyledWidgetLabelHelpInline,
} from "src/components/widgets/BaseWidget"
import TooltipIcon from "src/components/shared/TooltipIcon"
import { Placement } from "src/components/shared/Tooltip"
import { Theme } from "src/theme"

export interface Props {
  disabled: boolean
  theme: Theme
  width?: number
  value: number
  onChange: (selectedIndex: number) => any
  options: any[]
  label?: string
  help?: string
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
    value: this.props.value,
  }

  private onChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const selectedIndex = parseInt(e.target.value, 10)
    this.setState({ value: selectedIndex }, () =>
      this.props.onChange(selectedIndex)
    )
  }

  public render = (): React.ReactNode => {
    const { disabled, theme, width, help, label } = this.props
    const { colors, fontSizes, radii } = theme
    const style = { width }
    let isDisabled = disabled
    const options = [...this.props.options]

    if (options.length === 0) {
      options.push("No options to select.")
      isDisabled = true
    }

    return (
      <div className="row-widget stRadio" style={style}>
        {(label || help) && (
          <StyledWidgetLabel>
            {label}
            {help && (
              <StyledWidgetLabelHelpInline>
                <TooltipIcon content={help} placement={Placement.TOP_RIGHT} />
              </StyledWidgetLabelHelpInline>
            )}
          </StyledWidgetLabel>
        )}
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
                    backgroundColor: $isFocused
                      ? colors.transparentDarkenedBgMix60
                      : "",
                    borderTopLeftRadius: radii.md,
                    borderTopRightRadius: radii.md,
                    borderBottomLeftRadius: radii.md,
                    borderBottomRightRadius: radii.md,
                  }),
                },
                RadioMarkOuter: {
                  style: ({ $checked }: { $checked: boolean }) => ({
                    backgroundColor:
                      $checked && !isDisabled
                        ? colors.primary
                        : colors.fadedText40,
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
