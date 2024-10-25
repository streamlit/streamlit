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

import UIRadio from "@streamlit/lib/src/components/shared/Radio"
import { Radio as RadioProto } from "@streamlit/lib/src/proto"
import { WidgetStateManager } from "@streamlit/lib/src/WidgetStateManager"
import {
  useBasicWidgetState,
  ValueWithSource,
} from "@streamlit/lib/src/useBasicWidgetState"
import { labelVisibilityProtoValueToEnum } from "@streamlit/lib/src/util/utils"

export interface Props {
  disabled: boolean
  element: RadioProto
  widgetMgr: WidgetStateManager
  width: number
  fragmentId?: string
}

type RadioValue = number | null | undefined

function Radio({
  disabled,
  element,
  widgetMgr,
  width,
  fragmentId,
}: Readonly<Props>): ReactElement {
  const [value, setValueWithSource] = useBasicWidgetState<
    RadioValue,
    RadioProto
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
    (selectedIndex: number): void => {
      setValueWithSource({ value: selectedIndex, fromUi: true })
    },
    [setValueWithSource]
  )

  const { horizontal, options, captions, label, labelVisibility, help } =
    element

  return (
    <UIRadio
      label={label}
      onChange={onChange}
      options={options}
      captions={captions}
      width={width}
      disabled={disabled}
      horizontal={horizontal}
      labelVisibility={labelVisibilityProtoValueToEnum(labelVisibility?.value)}
      value={value ?? null}
      help={help}
    />
  )
}

function getStateFromWidgetMgr(
  widgetMgr: WidgetStateManager,
  element: RadioProto
): RadioValue {
  return widgetMgr.getIntValue(element)
}

function getDefaultStateFromProto(element: RadioProto): RadioValue {
  return element.default ?? null
}

function getCurrStateFromProto(element: RadioProto): RadioValue {
  return element.value ?? null
}

function updateWidgetMgrState(
  element: RadioProto,
  widgetMgr: WidgetStateManager,
  vws: ValueWithSource<RadioValue>,
  fragmentId?: string
): void {
  widgetMgr.setIntValue(
    element,
    vws.value ?? null,
    { fromUi: vws.fromUi },
    fragmentId
  )
}

export default memo(Radio)
