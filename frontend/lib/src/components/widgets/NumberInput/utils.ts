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
 * Extracts the number of decimal places from a step value.
 * Handles both standard notation (0.01) and scientific notation (1e-7).
 *
 * For scientific notation, accounts for both the exponent AND any decimal
 * places in the coefficient (e.g., 2.5e-8 = 0.000000025 = 9 decimal places).
 *
 * @note For steps requiring more than 15 decimal places, JavaScript's
 * Number precision limits may cause small inaccuracies in arithmetic.
 * This is a fundamental limitation of IEEE 754 double-precision floats.
 */
export const getDecimalPlaces = (step: number): number => {
  const stepStr = step.toString()

  // Handle scientific notation (e.g., "1e-7", "2.5e-8")
  // JavaScript uses this for very small numbers (typically < 1e-6)
  if (stepStr.includes("e-")) {
    // Regex requires at least one digit before the exponent to avoid matching
    // malformed inputs like "e-7". The decimal portion is optional but properly grouped.
    const match = stepStr.match(/(\d+(?:\.\d+)?)e-(\d+)/)
    if (match) {
      // Account for decimal places in the coefficient (e.g., "2.5" has 1)
      const coefficientDecimals = (match[1]?.split(".")[1] || "").length
      const exponent = parseInt(match[2], 10)
      return coefficientDecimals + exponent
    }
    return 0
  }

  // Handle standard decimal notation (e.g., "0.01")
  return (stepStr.split(".")[1] || "").length
}

/**
 * Utilizes the sprintf library to format a number value
 * according to a given format string.
 *
 * When no format is provided, automatically determines precision from the step
 * value for floats, including proper handling of scientific notation steps.
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

  // Auto-generate format string based on step precision for floats
  if (
    isNullOrUndefined(formatString) &&
    notNullOrUndefined(step) &&
    dataType === NumberInputProto.DataType.FLOAT &&
    step !== 0
  ) {
    // Use getDecimalPlaces for consistent handling of both standard
    // decimal notation (0.01) and scientific notation (1e-7, 2.5e-8)
    const decimalPlaces = getDecimalPlaces(step)
    if (decimalPlaces > 0) {
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

/**
 * Performs precise step arithmetic to avoid floating point errors.
 * Uses scale-based integer arithmetic (e.g., 0.1 + 0.01 = 0.11, not 0.11000000000000001).
 *
 * This function handles both standard decimal steps (0.01) and very small steps
 * that JavaScript represents in scientific notation (1e-7).
 *
 * @note Precision limitation: For steps requiring more than 15 decimal places,
 * the scale factor (10^decimalPlaces) may exceed JavaScript's MAX_SAFE_INTEGER
 * (2^53 - 1 ≈ 9e15), causing precision loss. This is a fundamental limitation
 * of IEEE 754 double-precision floating-point numbers. For most practical
 * use cases (steps >= 1e-14), this function provides exact results.
 */
export const preciseStepArithmetic = (
  currentValue: number,
  step: number,
  operation: "add" | "subtract"
): number => {
  const decimalPlaces = getDecimalPlaces(step)

  // Fast path for integer steps (decimalPlaces === 0)
  // Standard arithmetic is exact for integers, no scaling needed
  if (decimalPlaces === 0) {
    switch (operation) {
      case "add":
        return currentValue + step
      case "subtract":
        return currentValue - step
    }
  }

  const scale = Math.pow(10, decimalPlaces)
  const scaledCurrent = Math.round(currentValue * scale)
  const scaledStep = Math.round(step * scale)

  switch (operation) {
    case "add":
      return (scaledCurrent + scaledStep) / scale
    case "subtract":
      return (scaledCurrent - scaledStep) / scale
  }
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
