/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import { Selectbox as SelectboxProto } from "@streamlit/protobuf"

import UISelectbox from "~lib/components/shared/Dropdown"
import {
  useBasicWidgetState,
  ValueWithSource,
} from "~lib/hooks/useBasicWidgetState"
import {
  isNullOrUndefined,
  labelVisibilityProtoValueToEnum,
} from "~lib/util/utils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

export interface Props {
  disabled: boolean
  element: SelectboxProto
  widgetMgr: WidgetStateManager
  fragmentId?: string
}

/**
 * The value specified by the user via the UI. If the user didn't touch this
 * widget's UI, the default value is used.
 */
type SelectboxValue = string | null

const getStateFromWidgetMgr = (
  widgetMgr: WidgetStateManager,
  element: SelectboxProto
): SelectboxValue | undefined => {
  return widgetMgr.getStringValue(element)
}

const getDefaultStateFromProto = (element: SelectboxProto): SelectboxValue => {
  if (element.options.length === 0 || isNullOrUndefined(element.default)) {
    return null
  }
  return element.options[element.default]
}

const getCurrStateFromProto = (element: SelectboxProto): SelectboxValue => {
  return element.rawValue ?? null
}

const updateWidgetMgrState = (
  element: SelectboxProto,
  widgetMgr: WidgetStateManager,
  valueWithSource: ValueWithSource<SelectboxValue>,
  fragmentId?: string
): void => {
  widgetMgr.setStringValue(
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
  fragmentId,
}) => {
  const {
    options,
    help,
    label,
    labelVisibility,
    placeholder,
    acceptNewOptions,
  } = element
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
    (valueArg: SelectboxValue) => {
      setValueWithSource({ value: valueArg, fromUi: true })
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
      onChange={onChange}
      value={value}
      help={help}
      placeholder={placeholder}
      clearable={clearable}
      acceptNewOptions={acceptNewOptions ?? false}
    />
  )
}

export default memo(Selectbox)
