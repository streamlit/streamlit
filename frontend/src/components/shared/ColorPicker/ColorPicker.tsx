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
import { StatefulPopover as UIPopover } from "baseui/popover"
import { ChromePicker, ColorResult } from "react-color"
import { StyledWidgetLabel } from "components/widgets/BaseWidget"
import {
  StyledColorPicker,
  StyledColorPreview,
  StyledColorValue,
  StyledColorBlock,
} from "./styled-components"

export interface Props {
  disabled: boolean
  width: number
  value: string
  showValue?: boolean
  label: string
  onChange: (value: string) => any
}

interface State {
  /**
   * The value specified by the user via the UI. If the user didn't touch this
   * widget's UI, the default value is used.
   */
  value: string
}

class ColorPicker extends React.PureComponent<Props, State> {
  public state: State = {
    value: this.props.value,
  }

  private onChangeComplete = (color: ColorResult): void => {
    this.setState({ value: color.hex })
  }

  private onColorClose = (): void => {
    this.props.onChange(this.state.value)
  }

  public render = (): React.ReactNode => {
    const { width, showValue } = this.props
    const { value } = this.state
    const style = { width }
    const previewStyle = {
      backgroundColor: value,
      boxShadow: `${value} 0px 0px 4px`,
    }
    return (
      <StyledColorPicker data-testid="stColorPicker" style={style}>
        <StyledWidgetLabel>{this.props.label}</StyledWidgetLabel>
        <UIPopover
          onClose={this.onColorClose}
          content={() => (
            <ChromePicker
              color={value}
              onChangeComplete={this.onChangeComplete}
              disableAlpha={true}
            />
          )}
        >
          <StyledColorPreview>
            <StyledColorBlock style={previewStyle} />
            {showValue && <StyledColorValue>{value}</StyledColorValue>}
          </StyledColorPreview>
        </UIPopover>
      </StyledColorPicker>
    )
  }
}

export default ColorPicker
