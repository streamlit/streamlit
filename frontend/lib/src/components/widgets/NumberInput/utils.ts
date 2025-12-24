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
import { getLogger } from "loglevel"
import { sprintf } from "sprintf-js"

import { NumberInput as NumberInputProto } from "@streamlit/protobuf"

import { ValueWithSource } from "~lib/hooks/useBasicWidgetState"
import { isNullOrUndefined, notNullOrUndefined } from "~lib/util/utils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

const LOG = getLogger("NumberInput")

/**
 * Return a string property from an element. If the string is
 * null or empty, return undefined instead.
 */
function getNonEmptyString(
  value: string | null | undefined
): string | undefined {
  return isNullOrUndefined(value) || value === "" ? undefined : value
}

/**
 * Utilizes the sprintf library to format a number value
 * according to a given format string.
 */
export const formatValue = ({
  value,
  format,
  step,
  dataType,
}: {
  value: number | null
  format?: string | null
  step?: number
  dataType: NumberInputProto.DataType
}): string | null => {
  if (isNullOrUndefined(value)) {
    return null
  }

  let formatString = getNonEmptyString(format)

  if (isNullOrUndefined(formatString) && notNullOrUndefined(step)) {
    const strStep = step.toString()
    if (
      dataType === NumberInputProto.DataType.FLOAT &&
      step !== 0 &&
      strStep.includes(".")
    ) {
      const decimalPlaces = strStep.split(".")[1].length
      formatString = `%0.${decimalPlaces}f`
    }
  }

  if (isNullOrUndefined(formatString)) {
    return value.toString()
  }

  try {
    return sprintf(formatString, value)
  } catch (e) {
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    LOG.warn(`Error in sprintf(${formatString}, ${value}): ${e}`)
    return String(value)
  }
}

export const canDecrement = (
  value: number | null,
  step: number,
  min: number
): boolean => {
  if (isNullOrUndefined(value)) {
    return false
  }
  return value - step >= min
}

export const canIncrement = (
  value: number | null,
  step: number,
  max: number
): boolean => {
  if (isNullOrUndefined(value)) {
    return false
  }
  return value + step <= max
}

export const getStep = ({
  step,
  dataType,
}: Pick<NumberInputProto, "step" | "dataType">): number => {
  if (step) {
    return step
  }
  if (dataType === NumberInputProto.DataType.INT) {
    return 1
  }
  return 0.01
}

// State management callbacks for useBasicWidgetState
export function getStateFromWidgetMgr(
  widgetMgr: WidgetStateManager,
  element: NumberInputProto
): number | null | undefined {
  const isIntData = element.dataType === NumberInputProto.DataType.INT
  return isIntData
    ? widgetMgr.getIntValue(element)
    : widgetMgr.getDoubleValue(element)
}

export function getDefaultStateFromProto(
  element: NumberInputProto
): number | null {
  return element.default ?? null
}

export function getCurrStateFromProto(
  element: NumberInputProto
): number | null {
  return element.value ?? element.default ?? null
}

export function updateWidgetMgrState(
  element: NumberInputProto,
  widgetMgr: WidgetStateManager,
  vws: ValueWithSource<number | null>,
  fragmentId?: string
): void {
  switch (element.dataType) {
    case NumberInputProto.DataType.INT:
      widgetMgr.setIntValue(
        element,
        vws.value,
        { fromUi: vws.fromUi },
        fragmentId
      )
      break
    case NumberInputProto.DataType.FLOAT:
      widgetMgr.setDoubleValue(
        element,
        vws.value,
        { fromUi: vws.fromUi },
        fragmentId
      )
      break
    default:
      throw new Error("Invalid data type")
  }
}
