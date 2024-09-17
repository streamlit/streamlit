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

import { Selectbox as SelectboxProto } from "@streamlit/lib/src/proto"
import { WidgetStateManager } from "@streamlit/lib/src/WidgetStateManager"
import {
  useBasicWidgetState,
  ValueWithSource,
} from "@streamlit/lib/src/useBasicWidgetState"
import UISelectbox from "@streamlit/lib/src/components/shared/Dropdown"
import {
  isNullOrUndefined,
  labelVisibilityProtoValueToEnum,
} from "@streamlit/lib/src/util/utils"

export interface Props {
  disabled: boolean
  element: SelectboxProto
  widgetMgr: WidgetStateManager
  width: number
  fragmentId?: string
}

export function Selectbox({
  disabled,
  element,
  widgetMgr,
  width,
  fragmentId,
}: Props): ReactElement {
  const [value, setValueWithSource] = useBasicWidgetState<
    number | null,
    SelectboxProto
  >({
    getStateFromWidgetMgr,
    getDefaultStateFromProto,
    getCurrStateFromProto,
    updateWidgetMgrState,
    element,
    widgetMgr,
    fragmentId,
  })

  const { options, help, label, labelVisibility, placeholder } = element
  const clearable = isNullOrUndefined(element.default) && !disabled

  const onChange = useCallback(
    (value: number | null): void => {
      setValueWithSource({ value, fromUi: true })
    },
    [setValueWithSource]
  )

  return (
    <UISelectbox
      label={label}
      labelVisibility={labelVisibilityProtoValueToEnum(labelVisibility?.value)}
      options={options}
      disabled={disabled}
      width={width}
      onChange={onChange}
      value={value}
      help={help}
      placeholder={placeholder}
      clearable={clearable}
    />
  )
}

function getStateFromWidgetMgr(
  widgetMgr: WidgetStateManager,
  element: SelectboxProto
): number | null {
  return widgetMgr.getIntValue(element) ?? null
}

function getDefaultStateFromProto(element: SelectboxProto): number | null {
  return element.default ?? null
}

function getCurrStateFromProto(element: SelectboxProto): number | null {
  return element.value ?? null
}

function updateWidgetMgrState(
  element: SelectboxProto,
  widgetMgr: WidgetStateManager,
  vws: ValueWithSource<number | null>,
  fragmentId?: string
): void {
  widgetMgr.setIntValue(element, vws.value, { fromUi: vws.fromUi }, fragmentId)
}

export default memo(Selectbox)
