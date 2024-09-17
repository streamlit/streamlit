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

import React, { memo, ReactElement, useCallback } from "react"

import { ColorPicker as ColorPickerProto } from "@streamlit/lib/src/proto"
import { WidgetStateManager } from "@streamlit/lib/src/WidgetStateManager"
import {
  useBasicWidgetState,
  ValueWithSource,
} from "@streamlit/lib/src/useBasicWidgetState"
import BaseColorPicker from "@streamlit/lib/src/components/shared/BaseColorPicker"
import { labelVisibilityProtoValueToEnum } from "@streamlit/lib/src/util/utils"

export interface Props {
  disabled: boolean
  element: ColorPickerProto
  widgetMgr: WidgetStateManager
  width: number
  fragmentId?: string
}

function ColorPicker({
  disabled,
  element,
  widgetMgr,
  width,
  fragmentId,
}: Props): ReactElement {
  const [value, setValueWithSource] = useBasicWidgetState<
    string,
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

  const onColorClose = useCallback(
    (color: string): void => {
      setValueWithSource({ value: color, fromUi: true })
    },
    [setValueWithSource]
  )

  return (
    <BaseColorPicker
      label={element.label}
      labelVisibility={labelVisibilityProtoValueToEnum(
        element.labelVisibility?.value
      )}
      help={element.help}
      onChange={onColorClose}
      disabled={disabled}
      width={width}
      value={value}
    />
  )
}

function getStateFromWidgetMgr(
  widgetMgr: WidgetStateManager,
  element: ColorPickerProto
): string | undefined {
  return widgetMgr.getStringValue(element)
}

function getDefaultStateFromProto(element: ColorPickerProto): string {
  return element.default
}

function getCurrStateFromProto(element: ColorPickerProto): string {
  return element.value
}

function updateWidgetMgrState(
  element: ColorPickerProto,
  widgetMgr: WidgetStateManager,
  vws: ValueWithSource<string>,
  fragmentId?: string
): void {
  widgetMgr.setStringValue(
    element,
    vws.value,
    { fromUi: vws.fromUi },
    fragmentId
  )
}

export default memo(ColorPicker)
