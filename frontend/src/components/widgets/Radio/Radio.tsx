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

import React, { ReactElement, useState, useEffect } from "react"
import UIRadio from "src/components/shared/Radio"
import { Radio as RadioProto } from "src/autogen/proto"
import { WidgetStateManager } from "src/lib/WidgetStateManager"
import { labelVisibilityProtoValueToEnum } from "src/lib/utils"

export interface Props {
  disabled: boolean
  element: RadioProto
  widgetMgr: WidgetStateManager
  width: number
}

function Radio(props: Props): ReactElement {
  const { disabled, element, width, widgetMgr } = props

  const initialValue = (): number => {
    // If WidgetStateManager knew a value for this widget, initialize to that.
    // Otherwise, use the default value from the widget protobuf.
    const storedValue = widgetMgr.getIntValue(element)
    return storedValue !== undefined ? storedValue : element.default
  }

  const [value, setStateValue] = useState(initialValue())
  const [source, setSource] = useState({ fromUi: false })

  const updateFromProtobuf = (): void => {
    element.setValue = false
    setStateValue(element.value)
    setSource({ fromUi: false })
  }

  const maybeUpdateFromProtobuf = (): void => {
    const { setValue } = element
    if (setValue) {
      updateFromProtobuf()
    }
  }

  const onFormCleared = (): void => {
    setStateValue(element.default)
    setSource({ fromUi: true })
  }

  const handleChange = (selectedIndex: number): void => {
    setStateValue(selectedIndex)
    setSource({ fromUi: true })
  }

  useEffect(() => {
    props.widgetMgr.setIntValue(element, value, source)
  }, [value, source])

  useEffect(() => {
    maybeUpdateFromProtobuf()
  })

  useEffect(() => {
    if (element.setValue) {
      updateFromProtobuf()
    } else {
      setSource({ fromUi: false })
    }
    // Add form-clear event handler.
    const formListener = widgetMgr.addFormClearedListener(
      element.formId,
      onFormCleared
    )
    return function cleanup() {
      formListener.disconnect()
    }
  }, [])

  const { horizontal, options, label, labelVisibility, help } = element

  return (
    <UIRadio
      label={label}
      onChange={handleChange}
      options={options}
      width={width}
      disabled={disabled}
      horizontal={horizontal}
      labelVisibility={labelVisibilityProtoValueToEnum(labelVisibility?.value)}
      value={value}
      help={help}
    />
  )
}

export default Radio
