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

import moment from "moment"

import { DateTimeInput as DateTimeInputProto } from "@streamlit/protobuf"

import { ValueWithSource } from "~lib/hooks/useBasicWidgetState"
import { isNullOrUndefined } from "~lib/util/utils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

export const DATE_TIME_FORMAT = "YYYY/MM/DD, HH:mm"

export const getStateFromWidgetMgr = (
  widgetMgr: WidgetStateManager,
  element: DateTimeInputProto
): string | null => widgetMgr.getStringValue(element) ?? null

export const getDefaultStateFromProto = (
  element: DateTimeInputProto
): string | null => (element.default?.length ? element.default : null)

export const getCurrStateFromProto = (
  element: DateTimeInputProto
): string | null => (element.value?.length ? element.value : null)

export const stringToDate = (value: string | null): Date | null => {
  if (isNullOrUndefined(value) || value === "") {
    return null
  }
  const parsed = moment(value, DATE_TIME_FORMAT, true)
  if (!parsed.isValid()) {
    return null
  }
  const dateValue = parsed.toDate()
  dateValue.setSeconds(0, 0)
  return dateValue
}

export const stringsToDate = (value: string | undefined): Date | null => {
  if (!value) {
    return null
  }
  const parsed = moment(value, DATE_TIME_FORMAT, true)
  if (!parsed.isValid()) {
    return null
  }
  const dateValue = parsed.toDate()
  dateValue.setSeconds(0, 0)
  return dateValue
}

const normalizeSingleDate = (date: Date | null | undefined): Date | null => {
  if (!date || Number.isNaN(date.getTime())) {
    return null
  }
  const normalized = new Date(date.getTime())
  normalized.setSeconds(0, 0)
  return normalized
}

export const normalizeDateValue = (
  date: Date | (Date | null | undefined)[] | null | undefined
): Date | null => {
  if (Array.isArray(date)) {
    const firstValid = date.find((d): d is Date => d instanceof Date)
    return normalizeSingleDate(firstValid)
  }
  return normalizeSingleDate(date)
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
  fragmentId?: string
): void => {
  const minDateTime = stringsToDate(element.min)
  const maxDateTime = stringsToDate(element.max)

  if (vws.value) {
    const dateValue = stringToDate(vws.value)
    if (dateValue) {
      const isOutOfBounds =
        (minDateTime && dateValue < minDateTime) ||
        (maxDateTime && dateValue > maxDateTime)

      if (!isOutOfBounds) {
        widgetMgr.setStringValue(
          element,
          vws.value,
          { fromUi: vws.fromUi },
          fragmentId
        )
      }
      return
    }
  }

  widgetMgr.setStringValue(
    element,
    vws.value,
    { fromUi: vws.fromUi },
    fragmentId
  )
}
