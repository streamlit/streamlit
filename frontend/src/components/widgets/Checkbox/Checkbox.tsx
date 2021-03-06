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
import { Checkbox as UICheckbox } from "baseui/checkbox"
import { Checkbox as CheckboxProto } from "autogen/proto"
import { transparentize } from "color2k"
import { WidgetStateManager, Source } from "lib/WidgetStateManager"
import { Theme } from "theme"

export interface Props {
  disabled: boolean
  element: CheckboxProto
  theme: Theme
  widgetMgr: WidgetStateManager
  width: number
}

interface State {
  /**
   * The value specified by the user via the UI. If the user didn't touch this
   * widget's UI, the default value is used.
   */
  value: boolean
}

class Checkbox extends React.PureComponent<Props, State> {
  public state: State = {
    value: this.initialValue,
  }

  get initialValue(): boolean {
    // If WidgetStateManager knew a value for this widget, initialize to that.
    // Otherwise, use the default value from the widget protobuf.
    const widgetId = this.props.element.id
    const storedValue = this.props.widgetMgr.getBoolValue(widgetId)
    return storedValue !== undefined ? storedValue : this.props.element.default
  }

  public componentDidMount(): void {
    this.setWidgetValue({ fromUi: false })
  }

  private setWidgetValue = (source: Source): void => {
    const widgetId = this.props.element.id
    this.props.widgetMgr.setBoolValue(widgetId, this.state.value, source)
  }

  private onChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.checked
    this.setState({ value }, () => this.setWidgetValue({ fromUi: true }))
  }

  public render = (): React.ReactNode => {
    const { theme, width } = this.props
    const { colors, fontSizes, radii } = theme
    const style = { width }

    // TODO Check the Widget usage
    return (
      <div className="row-widget stCheckbox" style={style}>
        <UICheckbox
          checked={this.state.value}
          disabled={this.props.disabled}
          onChange={this.onChange}
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
            Checkmark: {
              style: ({
                $isFocusVisible,
                $checked,
              }: {
                $isFocusVisible: boolean
                $checked: boolean
              }) => ({
                borderLeftWidth: "2px",
                borderRightWidth: "2px",
                borderTopWidth: "2px",
                borderBottomWidth: "2px",
                outline: 0,
                boxShadow:
                  $isFocusVisible && $checked
                    ? `0 0 0 0.2rem ${transparentize(colors.primary, 0.5)}`
                    : "",
              }),
            },
            Label: {
              style: {
                color: colors.bodyText,
              },
            },
          }}
        >
          {this.props.element.label}
        </UICheckbox>
      </div>
    )
  }
}

export default withTheme(Checkbox)
