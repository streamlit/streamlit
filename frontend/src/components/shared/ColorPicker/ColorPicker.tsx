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
import {
  WidgetLabel,
  StyledWidgetLabelHelpInline,
} from "src/components/widgets/BaseWidget"
import TooltipIcon from "src/components/shared/TooltipIcon"
import { Placement } from "src/components/shared/Tooltip"
import { logWarning } from "src/lib/log"
import {
  StyledColorPicker,
  StyledColorPreview,
  StyledColorValue,
  StyledColorBlock,
} from "./styled-components"

export interface Props {
  disabled?: boolean
  width?: number
  value: string
  showValue?: boolean
  label: string
  onChange: (value: string) => any
  help?: string
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

  public componentDidUpdate(prevProps: Props): void {
    if (
      prevProps.value !== this.props.value &&
      this.props.value !== this.state.value
    ) {
      this.setState({ value: this.props.value })
    }
  }

  // Note: This is a "local" onChange handler used to update the color preview
  // (allowing the user to click and drag). this.props.onChange is only called
  // when the ColorPicker popover is closed.
  private onColorChange = (color: ColorResult): void => {
    this.setState({ value: color.hex })
  }

  private onColorClose = (): void => {
    this.props.onChange(this.state.value)
  }

  // eslint-disable-next-line class-methods-use-this
  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    if (error?.name === "SecurityError") {
      // 2021.06.30 - on Streamlit Sharing, ColorPicker throws a cross-origin
      // error when its popover window is closed. There's an issue open in the
      // react-color repo https://github.com/casesandberg/react-color/issues/806 -
      // but it's months old and hasn't had a developer response.
      logWarning(
        `Swallowing ColorPicker SecurityError '${error.name}: ${error.message}'`
      )

      // We force an update after this error, to re-mount the UIPopover -
      // because the error sometimes cause it to be unmounted. This is an
      // unfortunate hack.
      this.forceUpdate()
    } else {
      throw error
    }
  }

  public render = (): React.ReactNode => {
    const { width, showValue, label, help } = this.props
    const { value } = this.state
    const style = { width }
    const previewStyle = {
      backgroundColor: value,
    }
    return (
      <StyledColorPicker data-testid="stColorPicker" style={style}>
        <WidgetLabel label={label}>
          {help && (
            <StyledWidgetLabelHelpInline>
              <TooltipIcon content={help} placement={Placement.TOP_RIGHT} />
            </StyledWidgetLabelHelpInline>
          )}
        </WidgetLabel>
        <UIPopover
          onClose={this.onColorClose}
          content={() => (
            <ChromePicker
              color={value}
              onChange={this.onColorChange}
              disableAlpha={true}
            />
          )}
        >
          <StyledColorPreview>
            <StyledColorBlock style={previewStyle} />
            {showValue && (
              <StyledColorValue>{value.toUpperCase()}</StyledColorValue>
            )}
          </StyledColorPreview>
        </UIPopover>
      </StyledColorPicker>
    )
  }
}

export default ColorPicker
