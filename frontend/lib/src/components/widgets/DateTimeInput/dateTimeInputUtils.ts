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

import moment from "moment"

import { DateTimeInput as DateTimeInputProto } from "@streamlit/protobuf"

import { ValueWithSource } from "~lib/hooks/useBasicWidgetState"
import { isNullOrUndefined } from "~lib/util/utils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

// Wire format for protobuf communication (ISO 8601)
export const DATE_TIME_FORMAT = "YYYY-MM-DDTHH:mm"

export const getStateFromWidgetMgr = (
  widgetMgr: WidgetStateManager,
  element: DateTimeInputProto
): string | null | undefined => {
  const values = widgetMgr.getStringArrayValue(element)
  if (values === undefined) {
    return undefined
  }
  return values.length > 0 ? values[0] : null
}

export const getDefaultStateFromProto = (
  element: DateTimeInputProto
): string | null => (element.default?.length ? element.default[0] : null)

export const getCurrStateFromProto = (
  element: DateTimeInputProto
): string | null => (element.value?.length ? element.value[0] : null)

export const normalizeDateValue = (
  date: Date | (Date | null | undefined)[] | null | undefined
): Date | null => {
  let singleDate: Date | null | undefined

  if (Array.isArray(date)) {
    singleDate = date.find((d): d is Date => d instanceof Date)
  } else {
    singleDate = date
  }

  if (!singleDate || Number.isNaN(singleDate.getTime())) {
    return null
  }

  const normalized = new Date(singleDate.getTime())
  normalized.setSeconds(0, 0)
  return normalized
}

const DATE_TIME_LEGACY_FORMAT = "YYYY/MM/DD, HH:mm"
const DATE_TIME_PARSE_FORMATS = [DATE_TIME_FORMAT, DATE_TIME_LEGACY_FORMAT]

export const stringToDate = (
  value: string | null | undefined
): Date | null => {
  if (isNullOrUndefined(value) || value === "") {
    return null
  }
  const parsed = moment(value, DATE_TIME_PARSE_FORMATS, true)
  if (!parsed.isValid()) {
    return null
  }
  return normalizeDateValue(parsed.toDate())
}

export const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

export const combineDateAndTime = (
  dateValue: Date,
  timeSource: Date
): Date => {
  const merged = new Date(dateValue.getTime())
  merged.setHours(timeSource.getHours(), timeSource.getMinutes(), 0, 0)
  return merged
}

export const updateWidgetMgrState = (
  element: DateTimeInputProto,
  widgetMgr: WidgetStateManager,
  vws: ValueWithSource<string | null>,
  fragmentId: string | undefined
): void => {
  const minDateTime = stringToDate(element.min)
  const maxDateTime = stringToDate(element.max)

  const setArrayValue = (val: string | null): void => {
    widgetMgr.setStringArrayValue(
      element,
      val ? [val] : [],
      { fromUi: vws.fromUi },
      fragmentId
    )
  }

  if (vws.value) {
    const dateValue = stringToDate(vws.value)
    if (dateValue) {
      const isOutOfBounds =
        (minDateTime && dateValue < minDateTime) ||
        (maxDateTime && dateValue > maxDateTime)

      if (!isOutOfBounds) {
        setArrayValue(vws.value)
      }
      return
    }
  }

  setArrayValue(vws.value)
}
