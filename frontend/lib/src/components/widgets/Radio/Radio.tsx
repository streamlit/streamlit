/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import { memo, ReactElement, useCallback, useMemo } from "react"

import { Radio as RadioProto } from "@streamlit/protobuf"

import UIRadio from "~lib/components/shared/Radio"
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
  element: RadioProto
  widgetMgr: WidgetStateManager
  fragmentId?: string
}

/**
 * The value specified by the user via the UI. If the user didn't touch this
 * widget's UI, the default value is used. We use string values (formatted
 * option strings) for robust handling of dynamic option changes.
 */
type RadioValue = string | null

function Radio({
  disabled,
  element,
  widgetMgr,
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

  const { horizontal, options, captions, label, labelVisibility, help } =
    element

  const onChange = useCallback(
    (selectedIndex: number): void => {
      // Convert index to string option value
      const selectedValue = options[selectedIndex] ?? null
      setValueWithSource({ value: selectedValue, fromUi: true })
    },
    [setValueWithSource, options]
  )

  // Convert string value back to index for UIRadio
  // Use lastIndexOf to match backend's "last wins" behavior for duplicate labels
  const selectedIndex = useMemo((): number | null => {
    if (value === null) {
      return null
    }
    const index = options.lastIndexOf(value)
    return index >= 0 ? index : null
  }, [value, options])

  return (
    <UIRadio
      label={label}
      onChange={onChange}
      options={options}
      captions={captions}
      disabled={disabled}
      horizontal={horizontal}
      labelVisibility={labelVisibilityProtoValueToEnum(labelVisibility?.value)}
      value={selectedIndex}
      help={help}
    />
  )
}

function getStateFromWidgetMgr(
  widgetMgr: WidgetStateManager,
  element: RadioProto
): RadioValue | undefined {
  return widgetMgr.getStringValue(element)
}

function getDefaultStateFromProto(element: RadioProto): RadioValue {
  if (element.options.length === 0 || isNullOrUndefined(element.default)) {
    return null
  }
  return element.options[element.default]
}

function getCurrStateFromProto(element: RadioProto): RadioValue {
  return element.rawValue ?? null
}

function updateWidgetMgrState(
  element: RadioProto,
  widgetMgr: WidgetStateManager,
  vws: ValueWithSource<RadioValue>,
  fragmentId?: string
): void {
  widgetMgr.setStringValue(
    element,
    vws.value,
    { fromUi: vws.fromUi },
    fragmentId
  )
}

export default memo(Radio)
