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
  useEffect,
  useMemo,
  useState,
} from "react"

import { CalendarDate, getLocalTimeZone, today } from "@internationalized/date"

import { DateInput as DateInputProto } from "@streamlit/protobuf"

import IsSidebarContext from "~lib/components/core/IsSidebarContext"
import { LibConfigContext } from "~lib/components/core/LibConfigContext"
import { WidgetLabel } from "~lib/components/widgets/BaseWidget/WidgetLabel"
import { WidgetLabelHelpIcon } from "~lib/components/widgets/BaseWidget/WidgetLabelHelpIcon"
import {
  useBasicWidgetState,
  ValueWithSource,
} from "~lib/hooks/useBasicWidgetState"
import { isInForm, labelVisibilityProtoValueToEnum } from "~lib/util/utils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import {
  calendarDateToIso,
  createDateErrorMessage,
  DateValidationErrorType,
  formatCalendarDate,
  getInitialFocusedDate,
  getMaxDate as getMaxCalendarDate,
  getMinDate,
  isOlderThanTwoYears,
  isoToCalendarDate,
  normalizeRangeOrder,
  validateDate,
} from "./dateInputUtils"
import RangeDateInput from "./RangeDateInput"
import SingleDateInput from "./SingleDateInput"

export interface Props {
  disabled: boolean
  element: DateInputProto
  widgetMgr: WidgetStateManager
  fragmentId?: string
}

function DateInput({
  disabled,
  element,
  widgetMgr,
  fragmentId,
}: Props): ReactElement {
  const isInSidebar = useContext(IsSidebarContext)
  const [error, setError] = useState<string | null>(null)
  // Incremented on form clear to signal child components to reset local
  // display state (which may have diverged from widget state due to buffering).
  const [formResetKey, setFormResetKey] = useState(0)

  const resetError = useCallback(() => {
    setError(null)
  }, [])

  const handleFormCleared = useCallback(() => {
    resetError()
    setFormResetKey(k => k + 1)
  }, [resetError])

  /**
   * An array with start and end date specified by the user via the UI. If the user
   * didn't touch this widget's UI, the default value is used. End date is optional.
   *
   * Canonical state is the ISO 8601 wire format directly (`string[]`).
   */
  const queryParamBinding = element.queryParamKey
    ? {
        paramKey: element.queryParamKey,
        valueType: "string_array_value" as const,
        clearable: element.default.length === 0,
        urlFormat: element.isRange ? ("repeated" as const) : undefined,
      }
    : undefined

  const [value, setValueWithSource] = useBasicWidgetState<
    string[],
    DateInputProto
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
    onFormCleared: handleFormCleared,
  })

  const { locale } = useContext(LibConfigContext)

  const minDateCalendar = useMemo(() => getMinDate(element), [element])
  const maxDateCalendar = useMemo(() => getMaxCalendarDate(element), [element])

  // Lifted here so both SingleDateInput and RangeDateInput share the same
  // visible-month. Seeded with a concrete date so it stays controlled for
  // the component's entire lifetime (see getInitialFocusedDate).
  const [focusedValue, setFocusedValue] = useState<CalendarDate>(() =>
    getInitialFocusedDate(value, minDateCalendar)
  )

  const enableQuickSelect = useMemo(() => {
    if (!element.isRange) {
      return false
    }

    return isOlderThanTwoYears(minDateCalendar)
  }, [element.isRange, minDateCalendar])

  const clearable = element.default.length === 0 && !disabled

  const minDateString = useMemo(
    () => formatCalendarDate(minDateCalendar, element.format),
    [minDateCalendar, element.format]
  )

  const maxDateString = useMemo(
    () =>
      maxDateCalendar
        ? formatCalendarDate(maxDateCalendar, element.format)
        : "",
    [maxDateCalendar, element.format]
  )

  const buildErrorMessage = useCallback(
    (errorType: DateValidationErrorType): string | null =>
      createDateErrorMessage(
        errorType,
        element.isRange,
        minDateString,
        maxDateString
      ),
    [element.isRange, minDateString, maxDateString]
  )

  // Single mode's change handler (fed by SingleDateInput's CalendarDate).
  const handleSingleChange = useCallback(
    (date: CalendarDate | null): void => {
      resetError()

      if (!date) {
        setValueWithSource({ value: [], fromUi: true })
        return
      }

      const errorType = validateDate(date, minDateCalendar, maxDateCalendar)
      if (errorType) {
        setError(buildErrorMessage(errorType))
        return
      }
      setValueWithSource({ value: [calendarDateToIso(date)], fromUi: true })
    },
    [
      buildErrorMessage,
      maxDateCalendar,
      minDateCalendar,
      resetError,
      setError,
      setValueWithSource,
    ]
  )

  // Real-time validation during segment editing — shows error tooltip
  // without committing the value to widget state.
  const handleValidate = useCallback(
    (date: CalendarDate | null): void => {
      resetError()
      if (!date) return
      const errorType = validateDate(date, minDateCalendar, maxDateCalendar)
      if (errorType) {
        setError(buildErrorMessage(errorType))
      }
    },
    [buildErrorMessage, maxDateCalendar, minDateCalendar, resetError, setError]
  )

  // Range mode's change handler — validates each date independently.
  const handleRangeChange = useCallback(
    (dates: CalendarDate[]): void => {
      resetError()

      if (dates.length === 0) {
        setValueWithSource({ value: [], fromUi: true })
        return
      }

      let errorType: DateValidationErrorType = null
      const newIsoDates: string[] = []
      dates.forEach(d => {
        const err = validateDate(d, minDateCalendar, maxDateCalendar)
        if (err) errorType = err
        newIsoDates.push(calendarDateToIso(d))
      })

      if (errorType) {
        setError(buildErrorMessage(errorType))
        return
      }
      setValueWithSource({
        value: normalizeRangeOrder(newIsoDates),
        fromUi: true,
      })
    },
    [
      buildErrorMessage,
      maxDateCalendar,
      minDateCalendar,
      resetError,
      setError,
      setValueWithSource,
    ]
  )

  // Revert to last committed value on close when segments still show
  // placeholders (partially typed, or fully cleared on a non-clearable widget).
  // The display revert is handled by SingleDateInput/RangeDateInput locally;
  // here we only clear the validation error. No setValueWithSource needed
  // because the committed value never changed (edits were buffered locally).
  const handleClose = useCallback(
    (shouldClearError?: boolean): void => {
      if (!shouldClearError) {
        return
      }
      resetError()
    },
    [resetError]
  )

  // Synchronous WidgetStateManager write for form-submit races: clicking a
  // form's Submit button causes blur before effects fire. The child's blur
  // handler calls onChange (async state update) + formCommit (sync WM write).
  const inForm = isInForm({ formId: element.formId })
  const handleFormCommit = useCallback(
    (date: CalendarDate | null): void => {
      if (!inForm) return
      const isoValue = date ? [calendarDateToIso(date)] : []
      updateWidgetMgrState(
        element,
        widgetMgr,
        { value: isoValue, fromUi: true },
        fragmentId
      )
    },
    [inForm, element, widgetMgr, fragmentId]
  )

  const handleRangeFormCommit = useCallback(
    (dates: CalendarDate[]): void => {
      if (!inForm) return
      updateWidgetMgrState(
        element,
        widgetMgr,
        {
          value: normalizeRangeOrder(dates.map(calendarDateToIso)),
          fromUi: true,
        },
        fragmentId
      )
    },
    [inForm, element, widgetMgr, fragmentId]
  )

  const singleValue = useMemo(
    () => isoToCalendarDate(value[0] ?? "") ?? null,
    [value]
  )
  const rangeStartValue = useMemo(
    () => isoToCalendarDate(value[0] ?? "") ?? null,
    [value]
  )
  const rangeEndValue = useMemo(
    () => isoToCalendarDate(value[1] ?? "") ?? null,
    [value]
  )

  // Sync the calendar's visible month when the committed value changes
  // externally (session_state update, form clear, calendar click commit).
  // During segment typing, SingleDateInput drives focusedValue directly
  // via its onFocusChange prop without waiting for a commit.
  useEffect(() => {
    if (element.isRange) return
    if (singleValue) {
      setFocusedValue(singleValue)
    } else {
      // After clear: reset to today (clamped to minDate) so the calendar
      // shows a sensible month instead of the stale previous value.
      const now = today(getLocalTimeZone())
      setFocusedValue(now.compare(minDateCalendar) < 0 ? minDateCalendar : now)
    }
  }, [element.isRange, singleValue, minDateCalendar])

  useEffect(() => {
    if (!element.isRange) return
    if (rangeStartValue) {
      setFocusedValue(rangeStartValue)
    } else {
      const now = today(getLocalTimeZone())
      setFocusedValue(now.compare(minDateCalendar) < 0 ? minDateCalendar : now)
    }
  }, [element.isRange, rangeStartValue, minDateCalendar])

  return (
    <div className="stDateInput" data-testid="stDateInput">
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
      {element.isRange ? (
        <RangeDateInput
          startValue={rangeStartValue}
          endValue={rangeEndValue}
          onChange={handleRangeChange}
          minDate={minDateCalendar}
          maxDate={maxDateCalendar}
          format={element.format}
          disabled={disabled}
          clearable={clearable}
          label={element.label}
          error={error}
          locale={locale}
          isInSidebar={isInSidebar}
          enableQuickSelect={enableQuickSelect}
          focusedValue={focusedValue}
          onFocusChange={setFocusedValue}
          onValidate={handleValidate}
          onClose={handleClose}
          formCommit={inForm ? handleRangeFormCommit : undefined}
          formResetKey={formResetKey}
        />
      ) : (
        <SingleDateInput
          value={singleValue}
          onChange={handleSingleChange}
          minDate={minDateCalendar}
          maxDate={maxDateCalendar}
          format={element.format}
          disabled={disabled}
          clearable={clearable}
          label={element.label}
          error={error}
          locale={locale}
          isInSidebar={isInSidebar}
          focusedValue={focusedValue}
          onFocusChange={setFocusedValue}
          onValidate={handleValidate}
          onClose={handleClose}
          formCommit={inForm ? handleFormCommit : undefined}
          formResetKey={formResetKey}
        />
      )}
    </div>
  )
}

function getStateFromWidgetMgr(
  widgetMgr: WidgetStateManager,
  element: DateInputProto
): string[] | undefined {
  return widgetMgr.getStringArrayValue(element)
}

function getDefaultStateFromProto(element: DateInputProto): string[] {
  return element.default ?? []
}

function getCurrStateFromProto(element: DateInputProto): string[] {
  return element.value ?? []
}

function updateWidgetMgrState(
  element: DateInputProto,
  widgetMgr: WidgetStateManager,
  vws: ValueWithSource<string[]>,
  fragmentId: string | undefined
): void {
  const minDate = getMinDate(element)
  const maxDate = getMaxCalendarDate(element)

  // Guard: invalid values must never reach the backend. This catches
  // out-of-range dates and unparsable ISO strings (e.g. malformed
  // query-param seeds). Empty arrays are valid (cleared input).
  const isValid = (vws.value || []).every(iso => {
    const calendarDate = isoToCalendarDate(iso)
    if (!calendarDate) return false
    return !validateDate(calendarDate, minDate, maxDate)
  })

  if (isValid) {
    widgetMgr.setStringArrayValue(
      element,
      vws.value,
      { fromUi: vws.fromUi },
      fragmentId
    )
  }
}

export default memo(DateInput)
