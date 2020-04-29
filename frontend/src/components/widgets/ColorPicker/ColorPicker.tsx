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
import { Map as ImmutableMap } from "immutable"
import { StatefulPopover as UIPopover } from "baseui/popover"
import { WidgetStateManager, Source } from "lib/WidgetStateManager"
import { ChromePicker, ColorResult } from "react-color"

import "./ColorPicker.scss"

export interface Props {
  disabled: boolean
  element: ImmutableMap<string, any>
  widgetMgr: WidgetStateManager
  width: number
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
    value: this.props.element.get("default"),
  }

  public componentDidMount(): void {
    this.setWidgetValue({ fromUi: false })
  }

  private setWidgetValue = (source: Source): void => {
    const widgetId: string = this.props.element.get("id")
    this.props.widgetMgr.setStringValue(widgetId, this.state.value, source)
  }

  private onChangeComplete = (color: ColorResult): void => {
    this.setState(
      {
        value: color.hex,
      },
      () => this.setWidgetValue({ fromUi: true })
    )
  }

  public render = (): React.ReactNode => {
    const { element, width } = this.props
    const { value } = this.state
    const style = { width }
    const previewStyle = {
      backgroundColor: value,
      boxShadow: `${value} 0px 0px 4px`,
    }
    const label = element.get("label")
    return (
      <div className="Widget stColorPicker" style={style}>
        <label>{label}</label>
        <UIPopover
          content={() => (
            <ChromePicker
              color={value}
              onChangeComplete={this.onChangeComplete}
              disableAlpha={true}
            />
          )}
        >
          <div className="color-preview" style={previewStyle}></div>
        </UIPopover>
      </div>
    )
  }
}

export default ColorPicker
