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
import { useWindowDimensionsContext } from "~lib/components/shared/WindowDimensions/useWindowDimensionsContext"
import { WidgetLabel } from "~lib/components/widgets/BaseWidget/WidgetLabel"
import { WidgetLabelHelpIcon } from "~lib/components/widgets/BaseWidget/WidgetLabelHelpIcon"
import { useIntlLocale } from "~lib/components/widgets/DateInput/useIntlLocale"
import { useBasicWidgetState } from "~lib/hooks/useBasicWidgetState"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { useScrollbarGutterSize } from "~lib/hooks/useScrollbarGutterSize"
import { labelVisibilityProtoValueToEnum } from "~lib/util/utils"
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

function DateTimeInput({
  disabled,
  element,
  widgetMgr,
  fragmentId,
}: Props): ReactElement {
  const theme = useEmotionTheme()
  const isInSidebar = useContext(IsSidebarContext)
  const scrollbarGutterSize = useScrollbarGutterSize()
  const { innerHeight: windowHeight } = useWindowDimensionsContext()
  const datepickerRef = useRef<DatepickerClass<Date> | null>(null)

  const queryParamBinding = element.queryParamKey
    ? {
        paramKey: element.queryParamKey,
        valueType: "string_array_value" as const,
        clearable: element.default.length === 0,
      }
    : undefined

  const getInitialCommittedDate = (): Date | null => {
    // Keep this in sync with useBasicWidgetState initialization.
    const initialValue =
      getStateFromWidgetMgr(widgetMgr, element) ??
      (element.setValue
        ? getCurrStateFromProto(element)
        : getDefaultStateFromProto(element))
    return stringToDate(initialValue)
  }

  // pendingDate is the temporary value while the user is selecting
  const [pendingDate, setPendingDate] = useState<Date | null>(
    getInitialCommittedDate
  )

  // Store the previous committedDate to detect changes from the widget manager
  const [prevCommittedDate, setPrevCommittedDate] = useState<Date | null>(
    getInitialCommittedDate
  )

  const [value, setValueWithSource] = useBasicWidgetState<
    string | null,
    DateTimeInputProto
  >({
    getStateFromWidgetMgr,
    getDefaultStateFromProto,
    getCurrStateFromProto,
    updateWidgetMgrState,
    element,
    widgetMgr,
    fragmentId,
    queryParamBinding,
    formClearBehavior: "resetValueAndRunCallback",
    onFormCleared: useCallback(() => {
      setPendingDate(stringToDate(getDefaultStateFromProto(element)))
    }, [element]),
  })

  const { locale } = useContext(LibConfigContext)
  const loadedLocale = useIntlLocale(locale)

  const step = element.step ? Number(element.step) : 900

  const minDateTime = useMemo(() => stringToDate(element.min), [element.min])
  const maxDateTime = useMemo(() => stringToDate(element.max), [element.max])

  // committedDate is the value from the widget manager
  const committedDate = useMemo(() => stringToDate(value), [value])

  // Sync pendingDate when committedDate changes (e.g., from external widget state updates)
  if (committedDate !== prevCommittedDate) {
    setPendingDate(committedDate)
    setPrevCommittedDate(committedDate)
  }

  const minDate = minDateTime ?? undefined
  const maxDate = maxDateTime ?? undefined

  const minTimeForSelection = useMemo(() => {
    if (!pendingDate || !minDateTime) {
      return undefined
    }

    return isSameDay(pendingDate, minDateTime)
      ? combineDateAndTime(pendingDate, minDateTime)
      : undefined
  }, [pendingDate, minDateTime])

  const maxTimeForSelection = useMemo(() => {
    if (!pendingDate || !maxDateTime) {
      return undefined
    }

    return isSameDay(pendingDate, maxDateTime)
      ? combineDateAndTime(pendingDate, maxDateTime)
      : undefined
  }, [pendingDate, maxDateTime])

  const dateMask = element.format.replaceAll(/[a-zA-Z]/g, "9")

  const dateFormat = element.format.replaceAll("Y", "y").replaceAll("D", "d")

  const formatString = `${dateFormat}, HH:mm`

  const mask = `${dateMask}, 99:99`

  const placeholder = `${element.format}, HH:MM`

  const defaultValue =
    element.default && element.default.length > 0 ? element.default[0] : ""
  const clearable = defaultValue.length === 0 && !disabled

  const error = useMemo(() => {
    if (!pendingDate) {
      return null
    }

    if (
      (minDateTime && pendingDate < minDateTime) ||
      (maxDateTime && pendingDate > maxDateTime)
    ) {
      const minStr = moment(minDateTime).format(formatString)
      const maxStr = moment(maxDateTime).format(formatString)
      return `**Error**: Date and time set outside allowed range. Please select a date and time between ${minStr} and ${maxStr}.`
    }

    return null
  }, [pendingDate, minDateTime, maxDateTime, formatString])

  const handleChange = useCallback(
    ({
      date,
    }: {
      date: Date | (Date | null | undefined)[] | null | undefined
    }): void => {
      const normalizedDate = normalizeDateValue(date)

      // Update pending state only - don't commit to widget manager yet
      setPendingDate(normalizedDate)

      // Keep the modal open so the user can continue selecting
      datepickerRef.current?.open?.()
    },
    []
  )

  const handleClose = useCallback((): void => {
    // Only commit to widget manager when the modal closes
    const newValue = pendingDate
      ? moment(pendingDate).format(DATE_TIME_FORMAT)
      : null
    const hasChanged = newValue !== value

    if (hasChanged) {
      setValueWithSource({ value: newValue, fromUi: true })
    }
  }, [pendingDate, value, setValueWithSource])

  const inputOverrides = createDateTimePickerOverrides({
    theme,
    isInSidebar,
    step,
    minTime: minTimeForSelection,
    maxTime: maxTimeForSelection,
    disabled,
    clearable,
    error,
    scrollbarGutterSize,
    windowHeight,
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
        value={pendingDate}
        onChange={handleChange}
        onClose={handleClose}
        minDate={minDate}
        maxDate={maxDate}
        disabled={disabled}
        timeSelectStart
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
