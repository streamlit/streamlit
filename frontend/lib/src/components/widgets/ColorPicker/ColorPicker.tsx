/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import React, { FC, memo, useCallback } from "react"

import { ColorPicker as ColorPickerProto } from "@streamlit/lib/src/proto"
import { WidgetStateManager } from "@streamlit/lib/src/WidgetStateManager"
import BaseColorPicker from "@streamlit/lib/src/components/shared/BaseColorPicker"
import { labelVisibilityProtoValueToEnum } from "@streamlit/lib/src/util/utils"
import {
  useBasicWidgetState,
  ValueWSource,
} from "@streamlit/lib/src/useBasicWidgetState"

export interface Props {
  disabled: boolean
  element: ColorPickerProto
  widgetMgr: WidgetStateManager
  width: number
  fragmentId?: string
}

/**
 * The value specified by the user via the UI. If the user didn't touch this
 * widget's UI, the default value is used.
 */
type ColorPickerValue = string

const getStateFromWidgetMgr = (
  widgetMgr: WidgetStateManager,
  element: ColorPickerProto
): ColorPickerValue | undefined => {
  return widgetMgr.getStringValue(element)
}

const getDefaultStateFromProto = (
  element: ColorPickerProto
): ColorPickerValue => {
  return element.default ?? null
}

const getCurrStateFromProto = (
  element: ColorPickerProto
): ColorPickerValue => {
  return element.value ?? null
}

const updateWidgetMgrState = (
  element: ColorPickerProto,
  widgetMgr: WidgetStateManager,
  valueWithSource: ValueWSource<ColorPickerValue>,
  fragmentId?: string
): void => {
  widgetMgr.setStringValue(
    element,
    valueWithSource.value,
    { fromUi: valueWithSource.fromUi },
    fragmentId
  )
}

const ColorPicker: FC<Props> = ({
  element,
  disabled,
  widgetMgr,
  width,
  fragmentId,
}) => {
  const [value, setValueWSource] = useBasicWidgetState<
    ColorPickerValue,
    ColorPickerProto
  >({
    getStateFromWidgetMgr,
    getDefaultStateFromProto,
    getCurrStateFromProto,
    updateWidgetMgrState,
    element,
    widgetMgr,
    fragmentId,
  })

  const handleColorClose = useCallback(
    (color: string): void => {
      setValueWSource({ value: color, fromUi: true })
    },
    [setValueWSource]
  )

  return (
    <BaseColorPicker
      label={element.label}
      labelVisibility={labelVisibilityProtoValueToEnum(
        element.labelVisibility?.value
      )}
      help={element.help}
      onChange={handleColorClose}
      disabled={disabled}
      width={width}
      value={value}
    />
  )
}

export default memo(ColorPicker)
