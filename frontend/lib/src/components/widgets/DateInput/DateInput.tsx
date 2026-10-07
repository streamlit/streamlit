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
  type ReactElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import type { CalendarDate } from "@internationalized/date"

import type { DateInput as DateInputProto } from "@streamlit/protobuf"

import IsSidebarContext from "~lib/components/core/IsSidebarContext"
import { LibConfigContext } from "~lib/components/core/LibConfigContext"
import { requiredFieldError } from "~lib/components/widgets/BaseWidget/requiredField"
import { WidgetLabel } from "~lib/components/widgets/BaseWidget/WidgetLabel"
import { WidgetLabelHelpIcon } from "~lib/components/widgets/BaseWidget/WidgetLabelHelpIcon"
import {
  useBasicWidgetState,
  type ValueWithSource,
} from "~lib/hooks/useBasicWidgetState"
import { isInForm, labelVisibilityProtoValueToEnum } from "~lib/util/utils"
import type { WidgetStateManager } from "~lib/WidgetStateManager"

import {
  calendarDateToIso,
  createDateErrorMessage,
  datesEqual,
  type DateValidationErrorType,
  formatCalendarDate,
  getFocusedDateFallback,
  getInitialFocusedDate,
  getMaxDate as getMaxCalendarDate,
  getMinDate,
  isOlderThanTwoYears,
  isoToCalendarDate,
  isRequiredEmptyDateValue,
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

/** True when two ISO date arrays have the same length and the same values in order. */
function isoArraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((iso, i) => iso === b[i])
}

function DateInput({
  disabled,
  element,
  widgetMgr,
  fragmentId,
}: Props): ReactElement {
  const isInSidebar = useContext(IsSidebarContext)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [hasRequiredError, setHasRequiredError] = useState(false)
  // Incremented on form clear to signal child components to reset local
  // display state (which may have diverged from widget state due to buffering).
  const [formResetKey, setFormResetKey] = useState(0)
  const formSubmitValidatorRef = useRef<() => boolean>(() => true)
  const lastWrittenIsoRef = useRef<string[] | undefined>(undefined)
  const pendingIsoRef = useRef<string[]>([])

  const resetError = useCallback(() => {
    setError(null)
  }, [])

  const handleFormCleared = useCallback(() => {
    const defaultIso = element.default ?? []
    lastWrittenIsoRef.current = defaultIso
    pendingIsoRef.current = defaultIso
    setDirty(false)
    setHasRequiredError(false)
    resetError()
    setFormResetKey(k => k + 1)
  }, [element.default, resetError])

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
        // Query-param emptiness follows the default, not requiredness.
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

  if (lastWrittenIsoRef.current === undefined) {
    lastWrittenIsoRef.current = value
    pendingIsoRef.current = value
  }

  const { locale } = useContext(LibConfigContext)

  const minDateCalendar = useMemo(() => getMinDate(element), [element])
  const maxDateCalendar = useMemo(() => getMaxCalendarDate(element), [element])

  // Lifted here so both SingleDateInput and RangeDateInput share the same
  // visible-month. Seeded with a concrete date so it stays controlled for
  // the component's entire lifetime (see getInitialFocusedDate).
  const [focusedValue, setFocusedValue] = useState<CalendarDate>(() =>
    getInitialFocusedDate(value, minDateCalendar, maxDateCalendar)
  )

  const enableQuickSelect = useMemo(() => {
    if (!element.isRange) {
      return false
    }

    return isOlderThanTwoYears(minDateCalendar)
  }, [element.isRange, minDateCalendar])

  // Hide the clear X when required. Keyboard emptying still notifies the
  // parent when the default is empty (`allowEmptyCommit`); non-empty defaults
  // revert locally.
  const defaultEmpty = element.default.length === 0
  const allowEmptyCommit = defaultEmpty && !disabled
  const clearable = allowEmptyCommit && !element.required

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

  const inForm = isInForm({ formId: element.formId })

  /**
   * Writes a value after required-then-range checks. Returns false without
   * writing when either check fails. `skipRequired` stages an empty in-form
   * value so submit-time validators can still paint the required error.
   */
  const commitIsoValue = useCallback(
    ({
      isoValues,
      fromUser,
      skipRequired = false,
    }: {
      isoValues: string[]
      fromUser: boolean
      skipRequired?: boolean
    }): boolean => {
      const isEmpty = isRequiredEmptyDateValue(isoValues, element.isRange)
      if (element.required && isEmpty && !skipRequired) {
        setHasRequiredError(true)
        setDirty(true)
        setError(null)
        return false
      }

      // Incomplete required ranges stage as [] so form pending matches empty.
      const toWrite =
        element.isRange && isEmpty && element.required ? [] : isoValues

      let errorType: DateValidationErrorType = null
      for (const iso of toWrite) {
        const calendarDate = isoToCalendarDate(iso)
        // Unreachable for values produced by calendarDateToIso. Refuse the
        // write rather than send an unparsable string or fail submit with a
        // user-facing error that cannot be acted on.
        if (!calendarDate) {
          return false
        }
        const err = validateDate(
          calendarDate,
          minDateCalendar,
          maxDateCalendar
        )
        if (err) {
          errorType = err
        }
      }
      if (errorType) {
        setError(buildErrorMessage(errorType))
        return false
      }

      const written = element.isRange ? normalizeRangeOrder(toWrite) : toWrite
      // Staging [] for an incomplete required range must not snap the visible
      // start date. Keep dirty so children skip parent→display sync.
      const keepIncompleteDisplay =
        skipRequired &&
        element.required &&
        element.isRange &&
        isoValues.length > 0 &&
        isoValues.length !== 2

      setHasRequiredError(false)
      setError(null)
      lastWrittenIsoRef.current = written
      pendingIsoRef.current = keepIncompleteDisplay ? isoValues : written
      setValueWithSource({ value: written, fromUser })
      // Inside a form, write synchronously so submit in the same event sees
      // the staged value. Form widget writes do not schedule a rerun.
      if (inForm) {
        updateWidgetMgrState(
          element,
          widgetMgr,
          { value: written, fromUser },
          fragmentId
        )
      }
      setDirty(keepIncompleteDisplay)
      return true
    },
    [
      buildErrorMessage,
      element,
      fragmentId,
      inForm,
      maxDateCalendar,
      minDateCalendar,
      setValueWithSource,
      widgetMgr,
    ]
  )

  // Single mode's change handler (fed by SingleDateInput's CalendarDate).
  const handleSingleChange = useCallback(
    (date: CalendarDate | null): void => {
      commitIsoValue({
        isoValues: date ? [calendarDateToIso(date)] : [],
        fromUser: true,
        skipRequired: inForm,
      })
    },
    [commitIsoValue, inForm]
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
    [buildErrorMessage, maxDateCalendar, minDateCalendar, resetError]
  )

  // Range mode's change handler — validates each date independently.
  const handleRangeChange = useCallback(
    (dates: CalendarDate[]): void => {
      commitIsoValue({
        isoValues: dates.map(calendarDateToIso),
        fromUser: true,
        skipRequired: inForm,
      })
    },
    [commitIsoValue, inForm]
  )

  const handleEdit = useCallback((isoValues: string[]): void => {
    pendingIsoRef.current = isoValues
    setDirty(true)
    setHasRequiredError(false)
  }, [])

  // Revert to last committed value on close when segments still show
  // placeholders (partially typed, or fully cleared on a non-clearable widget).
  // The display revert is handled by SingleDateInput/RangeDateInput locally.
  // Drop the buffered pending edit so form submit does not commit empty or
  // block on a required field that is already showing the restored date.
  const handleClose = useCallback(
    (shouldClearError?: boolean): void => {
      if (!shouldClearError) {
        return
      }
      pendingIsoRef.current = lastWrittenIsoRef.current ?? []
      setDirty(false)
      setHasRequiredError(false)
      resetError()
    },
    [resetError]
  )

  // Incoming setValue (session_state / script) is authoritative even when
  // the ISO value equals the last user write: a blocked empty attempt
  // leaves dirty display that must yield to the script.
  const incomingSetValue = element.setValue
  const protoValue = element.value
  useEffect(() => {
    if (incomingSetValue) {
      const incoming = protoValue ?? []
      lastWrittenIsoRef.current = incoming
      pendingIsoRef.current = incoming
      setDirty(false)
      setHasRequiredError(false)
      return
    }
    const lastWritten = lastWrittenIsoRef.current
    if (lastWritten !== undefined && !isoArraysEqual(value, lastWritten)) {
      lastWrittenIsoRef.current = value
      pendingIsoRef.current = value
      setDirty(false)
      setHasRequiredError(false)
    }
  }, [incomingSetValue, protoValue, value])

  const requiredError = requiredFieldError(
    element.required,
    hasRequiredError,
    isRequiredEmptyDateValue(pendingIsoRef.current, element.isRange)
  )
  if (hasRequiredError && requiredError === null) {
    setHasRequiredError(false)
  }
  const displayedError = requiredError ?? error

  /** Returns false to abort the form submit, painting the required error. */
  formSubmitValidatorRef.current = () => {
    if (dirty) {
      // Non-clearable single dates revert locally; do not commit the discarded
      // empty pending if overlay/blur has not already dropped it. Only skip
      // when last written is a real date — an empty last written (e.g.
      // session_state None) must still run required validation.
      const revertedNonClearableSingle =
        !element.isRange &&
        !allowEmptyCommit &&
        isRequiredEmptyDateValue(pendingIsoRef.current, false)
      if (revertedNonClearableSingle) {
        const lastWritten = lastWrittenIsoRef.current ?? []
        if (!isRequiredEmptyDateValue(lastWritten, false)) {
          pendingIsoRef.current = lastWritten
          setDirty(false)
          setHasRequiredError(false)
          resetError()
          return true
        }
      }
      const committed = commitIsoValue({
        isoValues: pendingIsoRef.current,
        fromUser: true,
      })
      // Min/max is a commit-time check only, so a non-required dirty field
      // must not abort submit.
      return element.required ? committed : true
    }
    if (element.required && isRequiredEmptyDateValue(value, element.isRange)) {
      setHasRequiredError(true)
      return false
    }
    return true
  }

  useEffect(() => {
    if (!inForm) {
      return undefined
    }

    const validator = (): boolean => formSubmitValidatorRef.current()
    widgetMgr.addFormSubmitValidator(element.formId, element.id, validator)

    return () => {
      widgetMgr.removeFormSubmitValidator(element.formId, element.id)
    }
  }, [element.formId, element.id, inForm, widgetMgr])

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
      // No committed value (initial render or after a clear): show today,
      // clamped to the widget's bounds, rather than a stale month.
      const fallback = getFocusedDateFallback(minDateCalendar, maxDateCalendar)
      setFocusedValue(prev => (datesEqual(prev, fallback) ? prev : fallback))
    }
  }, [element.isRange, singleValue, minDateCalendar, maxDateCalendar])

  useEffect(() => {
    if (!element.isRange) return
    if (rangeStartValue) {
      setFocusedValue(rangeStartValue)
    } else {
      // Same fallback as single mode — see above.
      const fallback = getFocusedDateFallback(minDateCalendar, maxDateCalendar)
      setFocusedValue(prev => (datesEqual(prev, fallback) ? prev : fallback))
    }
  }, [element.isRange, rangeStartValue, minDateCalendar, maxDateCalendar])

  return (
    <div className="stDateInput" data-testid="stDateInput">
      <WidgetLabel
        label={element.label}
        disabled={disabled}
        labelVisibility={labelVisibilityProtoValueToEnum(
          element.labelVisibility?.value
        )}
        required={element.required}
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
          required={element.required}
          suppressCommittedSync={dirty}
          onEdit={handleEdit}
          label={element.label}
          error={displayedError}
          locale={locale}
          isInSidebar={isInSidebar}
          enableQuickSelect={enableQuickSelect}
          focusedValue={focusedValue}
          onFocusChange={setFocusedValue}
          onValidate={handleValidate}
          onClose={handleClose}
          formCommit={inForm ? handleRangeChange : undefined}
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
          allowEmptyCommit={allowEmptyCommit}
          required={element.required}
          suppressCommittedSync={dirty}
          onEdit={handleEdit}
          label={element.label}
          error={displayedError}
          locale={locale}
          isInSidebar={isInSidebar}
          focusedValue={focusedValue}
          onFocusChange={setFocusedValue}
          onValidate={handleValidate}
          onClose={handleClose}
          formCommit={inForm ? handleSingleChange : undefined}
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
    widgetMgr.setStringArrayValue(element.id, vws.value, {
      formId: element.formId,
      fragmentId,
      fromUser: vws.fromUser,
      // on_change="ignore" buffers the value without scheduling a rerun.
      // WidgetStateManager ignores triggerRerun inside forms (the form owns
      // commit timing).
      ...(element.ignoreRerun ? { triggerRerun: false } : {}),
    })
  }
}

export default memo(DateInput)
