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

import React, { ReactElement } from "react"
import { CameraImageInput as CameraImageInputProto } from "src/autogen/proto"
import { WidgetStateManager } from "src/lib/WidgetStateManager"

export interface Props {
  element: CameraImageInputProto
  widgetMgr: WidgetStateManager
}
interface State {
  /**
   * The value specified by the user via the UI. If the user didn't touch this
   * widget's UI, the default value is used.
   */
  value: string
}

class CameraImageInput extends React.PureComponent<Props, State> {
  public state: State = {
    value: this.initialValue,
  }

  get initialValue(): string {
    // If WidgetStateManager knew a value for this widget, initialize to that.
    // Otherwise, use the default value from the widget protobuf.
    const storedValue = this.props.widgetMgr.getStringValue(this.props.element)
    return storedValue !== undefined ? storedValue : this.props.element.default
  }

  public render = (): React.ReactNode => {
    const { element } = this.props
    const { value } = this.state

    return (
      <div>
        <h1>OOOO</h1>
        <h1>{element.label}</h1>
        <h3>{element.value}</h3>
      </div>
    )
  }
}

export default CameraImageInput
