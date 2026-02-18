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

import {
  memo,
  ReactElement,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react"

import { DENSITY, Datepicker as UIDatePicker } from "baseui/datepicker"
import type DatepickerClass from "baseui/datepicker/datepicker"
import moment from "moment"

import { DateTimeInput as DateTimeInputProto } from "@streamlit/protobuf"

import IsSidebarContext from "~lib/components/core/IsSidebarContext"
import { LibConfigContext } from "~lib/components/core/LibConfigContext"
import {
  WidgetLabel,
  WidgetLabelHelpIcon,
} from "~lib/components/widgets/BaseWidget"
import { useIntlLocale } from "~lib/components/widgets/DateInput/useIntlLocale"
import { useBasicWidgetState } from "~lib/hooks/useBasicWidgetState"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import {
  isNullOrUndefined,
  labelVisibilityProtoValueToEnum,
} from "~lib/util/utils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import { createDateTimePickerOverrides } from "./createDateTimePickerOverrides"
import {
  combineDateAndTime,
  DATE_TIME_FORMAT,
  getCurrStateFromProto,
  getDefaultStateFromProto,
  getStateFromWidgetMgr,
  isSameDay,
  normalizeDateValue,
  stringToDate,
  updateWidgetMgrState,
} from "./dateTimeInputUtils"

export interface Props {
  disabled: boolean
  element: DateTimeInputProto
  widgetMgr: WidgetStateManager
  fragmentId?: string
}

function stringsToDateTimes(strings: string[]): Date[] {
  return strings
    .map(s => stringToDate(s))
    .filter((d): d is Date => d !== null && d !== undefined) // Non-null assertion
}
function dateTimesToStrings(dates: Date[]): string[] {
  return dates.map(d => moment(d).format(DATE_TIME_FORMAT))
}

function DateTimeInput({
  disabled,
  element,
  widgetMgr,
  fragmentId,
}: Props): ReactElement {
  const theme = useEmotionTheme()
  const isInSidebar = useContext(IsSidebarContext)
  const datepickerRef = useRef<DatepickerClass<Date> | null>(null)

  const [value, setValueWithSource] = useBasicWidgetState<
    string | string[] | null,
    DateTimeInputProto
  >({
    getStateFromWidgetMgr,
    getDefaultStateFromProto,
    getCurrStateFromProto,
    updateWidgetMgrState,
    element,
    widgetMgr,
    fragmentId,
  })

  const { locale } = useContext(LibConfigContext)
  const loadedLocale = useIntlLocale(locale)

  const step = element.step ? Number(element.step) : 900

  const minDateTime = useMemo(() => stringToDate(element.min), [element.min])
  const maxDateTime = useMemo(() => stringToDate(element.max), [element.max])

  const valueAsDates = useMemo(() => {
    if (!value) return null
    if (Array.isArray(value)) {
      return stringsToDateTimes(value) // string[] -> Date[]
    }
    const single = stringToDate(value) // string -> Date|null
    return single ? [single] : null
  }, [value])

  // committedDate is the value from the widget manager
  const committedDates = useMemo(() => valueAsDates, [valueAsDates])

  const [pendingDates, setPendingDates] = useState<Date[] | null>(
    committedDates
  )

  const [prevCommittedDates, setPrevCommittedDates] = useState<Date[] | null>(
    committedDates
  )
  if (committedDates !== prevCommittedDates) {
    setPendingDates(committedDates)
    setPrevCommittedDates(committedDates)
  }

  const minDate = minDateTime ?? undefined
  const maxDate = maxDateTime ?? undefined

  const minTimeForSelection = useMemo(() => {
    if (!pendingDates?.[0] || !minDateTime) return undefined
    return isSameDay(pendingDates[0], minDateTime)
      ? combineDateAndTime(pendingDates[0], minDateTime)
      : undefined
  }, [pendingDates, minDateTime])

  const maxTimeForSelection = useMemo(() => {
    if (!pendingDates?.[0] || !maxDateTime) return undefined
    return isSameDay(pendingDates[0], maxDateTime)
      ? combineDateAndTime(pendingDates[0], maxDateTime)
      : undefined
  }, [pendingDates, maxDateTime])

  const dateMask = element.format.replaceAll(/[a-zA-Z]/g, "9")

  const dateFormat = element.format.replaceAll("Y", "y").replaceAll("D", "d")

  const formatString = `${dateFormat}, HH:mm`

  const mask = `${dateMask}, 99:99`

  const placeholder = `${element.format}, HH:MM`

  const defaultValue =
    element.default && element.default.length > 0 ? element.default[0] : ""
  const clearable = defaultValue.length === 0 && !disabled

  const error = useMemo(() => {
    if (!pendingDates || pendingDates.length === 0) return null
    for (const date of pendingDates) {
      if (
        (minDateTime && date < minDateTime) ||
        (maxDateTime && date > maxDateTime)
      ) {
        const minStr = moment(minDateTime).format(formatString)
        const maxStr = moment(maxDateTime).format(formatString)
        return `**Error**: Date and time set outside allowed range. Please select dates between ${minStr} and ${maxStr}.`
      }
    }
    return null
  }, [pendingDates, minDateTime, maxDateTime, formatString])

  const rangeValue: [Date | null, Date | null] | Date[] = element.isRange
    ? [pendingDates?.[0] ?? null, pendingDates?.[1] ?? null]
    : (pendingDates ?? [])

  const handleChange = useCallback(
    ({
      date,
    }: {
      date: Date | (Date | null | undefined)[] | null | undefined
    }): void => {
      if (isNullOrUndefined(date)) {
        setPendingDates(null)
        setValueWithSource({ value: null, fromUi: true })
        return
      }
      const normalizedDates: Date[] = Array.isArray(date)
        ? date
            .filter((d): d is Date => !isNullOrUndefined(d))
            .map(d => normalizeDateValue(d))
            .filter((d): d is Date => !isNullOrUndefined(d))
        : !isNullOrUndefined(date)
          ? [normalizeDateValue(date) as Date]
          : []

      setPendingDates(normalizedDates.length > 0 ? normalizedDates : null)

      if (element.isRange && normalizedDates.length < 2) {
        datepickerRef.current?.open?.()
        return
      }

      const newValue =
        normalizedDates.length > 0 ? dateTimesToStrings(normalizedDates) : null
      setValueWithSource({ value: newValue, fromUi: true })
    },
    [element.isRange, setValueWithSource]
  )

  const handleClose = useCallback((): void => {
    if (pendingDates && pendingDates.length > 0) return
    if (!element.default || element.default.length === 0) return
    const defaultDates = stringsToDateTimes(element.default)
    setValueWithSource({ value: element.default, fromUi: true })
    setPendingDates(defaultDates)
  }, [pendingDates, element.default, setValueWithSource])

  const inputOverrides = createDateTimePickerOverrides({
    theme,
    isInSidebar,
    step,
    minTime: minTimeForSelection,
    maxTime: maxTimeForSelection,
    disabled,
    clearable,
    error,
  })

  return (
    <div className="stDateTimeInput" data-testid="stDateTimeInput">
      <WidgetLabel
        label={element.label}
        disabled={disabled}
        labelVisibility={labelVisibilityProtoValueToEnum(
          element.labelVisibility?.value
        )}
      >
        {element.help && (
          <WidgetLabelHelpIcon content={element.help} label={element.label} />
        )}
      </WidgetLabel>
      <UIDatePicker
        ref={datepickerRef}
        locale={loadedLocale}
        density={DENSITY.high}
        range={element.isRange}
        value={rangeValue}
        onChange={handleChange}
        onClose={handleClose}
        minDate={minDate}
        maxDate={maxDate}
        disabled={disabled}
        timeSelectStart
        timeSelectEnd={element.isRange}
        formatString={formatString}
        mask={mask}
        placeholder={placeholder}
        clearable={clearable}
        overrides={inputOverrides}
        aria-label={element.label}
      />
    </div>
  )
}

export default memo(DateTimeInput)
