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

import { Selectbox as SelectboxProto } from "@streamlit/lib/src/proto"
import { WidgetStateManager } from "@streamlit/lib/src/WidgetStateManager"
import UISelectbox from "@streamlit/lib/src/components/shared/Dropdown"
import {
  isNullOrUndefined,
  labelVisibilityProtoValueToEnum,
} from "@streamlit/lib/src/util/utils"
import {
  useBasicWidgetState,
  ValueWithSource,
} from "@streamlit/lib/src/useBasicWidgetState"

export interface Props {
  disabled: boolean
  element: SelectboxProto
  widgetMgr: WidgetStateManager
  width: number
  fragmentId?: string
}

/**
 * The value specified by the user via the UI. If the user didn't touch this
 * widget's UI, the default value is used.
 */
type SelectboxValue = number | null

const getStateFromWidgetMgr = (
  widgetMgr: WidgetStateManager,
  element: SelectboxProto
): SelectboxValue | undefined => {
  return widgetMgr.getIntValue(element)
}

const getDefaultStateFromProto = (element: SelectboxProto): SelectboxValue => {
  return element.default ?? null
}

const getCurrStateFromProto = (element: SelectboxProto): SelectboxValue => {
  return element.value ?? null
}

const updateWidgetMgrState = (
  element: SelectboxProto,
  widgetMgr: WidgetStateManager,
  valueWithSource: ValueWithSource<SelectboxValue>,
  fragmentId?: string
): void => {
  widgetMgr.setIntValue(
    element,
    valueWithSource.value,
    { fromUi: valueWithSource.fromUi },
    fragmentId
  )
}

const Selectbox: FC<Props> = ({
  disabled,
  element,
  widgetMgr,
  width,
  fragmentId,
}) => {
  const { options, help, label, labelVisibility, placeholder } = element

  const [value, setValueWithSource] = useBasicWidgetState<
    SelectboxValue,
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

  const onChange = useCallback(
    (value: SelectboxValue) => {
      setValueWithSource({ value, fromUi: true })
    },
    [setValueWithSource]
  )

  const clearable = isNullOrUndefined(element.default) && !disabled

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

export default memo(Selectbox)
