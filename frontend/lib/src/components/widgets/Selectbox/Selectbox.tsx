/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from "react"

import { withTheme } from "@emotion/react"
import { Selectbox as SelectboxProto } from "@streamlit/lib/src/proto"
import { FormClearHelper } from "@streamlit/lib/src/components/widgets/Form"
import {
  WidgetStateManager,
  Source,
} from "@streamlit/lib/src/WidgetStateManager"
import UISelectbox from "@streamlit/lib/src/components/shared/Dropdown"
import {
  labelVisibilityProtoValueToEnum,
  isNullOrUndefined,
} from "@streamlit/lib/src/util/utils"
import { EmotionTheme } from "@streamlit/lib/src/theme"

export interface Props {
  disabled: boolean
  element: SelectboxProto
  widgetMgr: WidgetStateManager
  width: number
  theme: EmotionTheme
}

interface State {
  /**
   * The value specified by the user via the UI. If the user didn't touch this
   * widget's UI, the default value is used.
   */
  value: number | null
}

export class Selectbox extends React.PureComponent<Props, State> {
  private readonly formClearHelper = new FormClearHelper()

  public state: State = {
    value: this.initialValue,
  }

  get initialValue(): number | null {
    // If WidgetStateManager knew a value for this widget, initialize to that.
    // Otherwise, use the default value from the widget protobuf.
    const storedValue = this.props.widgetMgr.getIntValue(this.props.element)
    return storedValue ?? this.props.element.default ?? null
  }

  public componentDidMount(): void {
    if (this.props.element.setValue) {
      this.updateFromProtobuf()
    } else {
      this.commitWidgetValue({ fromUi: false })
    }
  }

  public componentDidUpdate(): void {
    this.maybeUpdateFromProtobuf()
  }

  public componentWillUnmount(): void {
    this.formClearHelper.disconnect()
  }

  private maybeUpdateFromProtobuf(): void {
    const { setValue } = this.props.element
    if (setValue) {
      this.updateFromProtobuf()
    }
  }

  private updateFromProtobuf(): void {
    const { value } = this.props.element
    this.props.element.setValue = false
    this.setState({ value: value ?? null }, () => {
      this.commitWidgetValue({ fromUi: false })
    })
  }

  /** Commit state.value to the WidgetStateManager. */
  private commitWidgetValue = (source: Source): void => {
    this.props.widgetMgr.setIntValue(
      this.props.element,
      this.state.value,
      source
    )
  }

  /**
   * If we're part of a clear_on_submit form, this will be called when our
   * form is submitted. Restore our default value and update the WidgetManager.
   */
  private onFormCleared = (): void => {
    this.setState(
      (_, prevProps) => {
        return { value: prevProps.element.default ?? null }
      },
      () => this.commitWidgetValue({ fromUi: true })
    )
  }

  private onChange = (value: number | null): void => {
    this.setState({ value }, () => this.commitWidgetValue({ fromUi: true }))
  }

  public render(): React.ReactNode {
    const { options, help, label, labelVisibility, formId, placeholder } =
      this.props.element
    const { disabled, widgetMgr } = this.props
    const clearable =
      isNullOrUndefined(this.props.element.default) && !disabled

    // Manage our form-clear event handler.
    this.formClearHelper.manageFormClearListener(
      widgetMgr,
      formId,
      this.onFormCleared
    )

    return (
      <UISelectbox
        label={label}
        labelVisibility={labelVisibilityProtoValueToEnum(
          labelVisibility?.value
        )}
        options={options}
        disabled={disabled}
        width={this.props.width}
        onChange={this.onChange}
        value={this.state.value}
        help={help}
        placeholder={placeholder}
        clearable={clearable}
      />
    )
  }
}

export default withTheme(Selectbox)
