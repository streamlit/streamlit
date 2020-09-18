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

import React, { ReactElement } from "react"
import { Map as ImmutableMap } from "immutable"
import { WidgetStateManager } from "lib/WidgetStateManager"
import UIButton from "./UIButton"

export interface ButtonProps {
  disabled: boolean
  element: ImmutableMap<string, any>
  widgetMgr: WidgetStateManager
  width: number
}

function Button(props: ButtonProps): ReactElement {
  const { disabled, element, widgetMgr, width } = props
  const label = element.get("label")
  const style = { width }

  const handleClick = (): void => {
    const widgetId = element.get("id")
    widgetMgr.setTriggerValue(widgetId, { fromUi: true })
  }

  return (
    <UIButton
      disabled={disabled}
      onClick={handleClick}
      className="Widget row-widget"
      style={style}
      label={label}
    />
  )
}

export default Button
