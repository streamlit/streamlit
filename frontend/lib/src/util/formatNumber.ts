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

import numbro from "numbro"

import { sprintf } from "~lib/vendor/sprintf.js/sprintfjs.js"

import { isNullOrUndefined, notNullOrUndefined } from "./utils"

/**
 * Determines the default mantissa to use for the given number.
 *
 * @param value - The number to determine the mantissa for.
 *
 * @returns The mantissa to use.
 */
function determineDefaultMantissa(value: number): number {
  if (value === 0 || Math.abs(value) >= 0.0001) {
    return 4
  }

  const expStr = value.toExponential()
  const parts = expStr.split("e")
  return Math.abs(parseInt(parts[1], 10))
}

/**
 * Helper function to format the Intl.NumberFormat call using locales
 *
 * @param value - the number to format
 * @param options - the options to pass to the Intl.NumberFormat call
 *
 * @returns The formatted number as a string.
 */
function formatIntlNumberWithLocales(
  value: number,
  options: Intl.NumberFormatOptions = {}
): string {
  const locales = navigator.languages
  try {
    return new Intl.NumberFormat(locales, options).format(value)
  } catch (error) {
    // If the locale is not supported, the above throws a RangeError
    // In this case we use default locale as fallback
    if (error instanceof RangeError) {
      return new Intl.NumberFormat(undefined, options).format(value)
    }
    throw error
  }
}

/**
 * Formats the given number to a string based on a provided format or the default format.
 *
 * @param value - The number to format.
 * @param format - The format to use. If not provided, the default format is used.
 *   Supported formats:
 *   - "plain": Show the full number without any formatting (e.g. "1234.567").
 *   - "localized": Show the number in the default locale format (e.g. "1,234.567").
 *   - "percent": Show the number as a percentage (e.g. "123456.70%").
 *   - "dollar": Show the number as a dollar amount (e.g. "$1,234.57").
 *   - "euro": Show the number as a euro amount (e.g. "€1,234.57").
 *   - "yen": Show the number as a yen amount (e.g. "¥1,235").
 *   - "accounting": Show the number in an accounting format (e.g. "1,234.00").
 *   - "bytes": Show the number in a byte format (e.g. "1.2KB").
 *   - "compact": Show the number in a compact format (e.g. "1.2K").
 *   - "scientific": Show the number in scientific notation (e.g. "1.235E3").
 *   - "engineering": Show the number in engineering notation (e.g. "1.235E3").
 *   - printf-style format string: Format the number with a printf specifier.
 *     Supports `,` flag for thousand separators: use `,` for commas (e.g., "%,d"
 *     yields "1,234" or "%,.2f" yields "1,234.57") and `_` for underscores
 *     (e.g., "%_d" yields "1_234"), mirroring Python's format spec.
 * @param maxPrecision - The maximum number of decimals to show. If not provided,
 *                     a reasonable default is used based on the configured format.
 *
 * @returns The formatted number as a string.
 */
export function formatNumber(
  value: number,
  format?: string,
  maxPrecision?: number
): string {
  if (Number.isNaN(value) || !Number.isFinite(value)) {
    return ""
  }

  if (isNullOrUndefined(format) || format === "") {
    // If no format is provided, use the default format
    if (notNullOrUndefined(maxPrecision)) {
      // Use the configured precision to influence how the number is formatted
      if (maxPrecision === 0) {
        // Numbro is unable to format the number with 0 decimals.
        value = Math.round(value)
      }

      return numbro(value).format({
        thousandSeparated: false,
        mantissa: maxPrecision,
        trimMantissa: false,
      })
    }

    // Use a default format if no precision is given
    return numbro(value).format({
      thousandSeparated: false,
      mantissa: determineDefaultMantissa(value),
      trimMantissa: true,
    })
  }

  if (format === "plain") {
    return numbro(value).format({
      thousandSeparated: false,
      // Use a large mantissa to avoid cutting off decimals
      mantissa: 20,
      trimMantissa: true,
    })
  } else if (format === "localized") {
    return formatIntlNumberWithLocales(value, {
      minimumFractionDigits: maxPrecision ?? undefined,
      maximumFractionDigits: maxPrecision ?? undefined,
    })
  } else if (format === "percent") {
    return formatIntlNumberWithLocales(value, {
      style: "percent",
      minimumFractionDigits: notNullOrUndefined(maxPrecision)
        ? Math.max(maxPrecision - 2, 0)
        : 0,
      maximumFractionDigits: notNullOrUndefined(maxPrecision)
        ? // Percentage already gets multiplied by 100 by the formatter,
          // so we need to reduce the precision by 2 to get the
          // correct format based on the raw value.
          Math.max(maxPrecision - 2, 0)
        : 2,
    })
  } else if (format === "dollar") {
    return formatIntlNumberWithLocales(value, {
      style: "currency",
      currency: "USD",
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: maxPrecision ?? 2,
      maximumFractionDigits: maxPrecision ?? 2,
    })
  } else if (format === "euro") {
    return formatIntlNumberWithLocales(value, {
      style: "currency",
      currency: "EUR",
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: maxPrecision ?? 2,
      maximumFractionDigits: maxPrecision ?? 2,
    })
  } else if (format === "yen") {
    return formatIntlNumberWithLocales(value, {
      style: "currency",
      currency: "JPY",
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: maxPrecision ?? 0,
      maximumFractionDigits: maxPrecision ?? 0,
    })
  } else if (["compact", "scientific", "engineering"].includes(format)) {
    return formatIntlNumberWithLocales(value, {
      notation: format as "compact" | "scientific" | "engineering",
    })
  } else if (format === "accounting") {
    return numbro(value).format({
      thousandSeparated: true,
      negative: "parenthesis",
      mantissa: maxPrecision ?? 2,
      trimMantissa: false,
    })
  } else if (format === "bytes") {
    return (
      formatIntlNumberWithLocales(value, {
        notation: "compact",
        style: "unit",
        unit: "byte",
        unitDisplay: "narrow",
        // We don't apply maxPrecision here since
        // bytes already gets transformed to different units.
        maximumFractionDigits: 1,
      })
        // The intl number format renders gigabytes as BB
        // which would be unexpected for users.
        .replace("BB", "GB")
    )
  }

  return sprintf(format, value)
}

/**
 * Checks if a string value can be parsed as a number.
 *
 * This is useful for determining whether to apply number formatting
 * to a value that might be a string representation of a number or
 * a string with non-numeric characters.
 *
 * @param value - The string to check.
 *
 * @returns true if the string can be parsed as a finite number, false otherwise.
 */
export function isNumericString(value: string): boolean {
  if (value.trim() === "") {
    return false
  }
  const parsed = Number(value)
  return !Number.isNaN(parsed) && Number.isFinite(parsed)
}
