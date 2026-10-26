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

import {
  CalendarDate,
  type CalendarDateTime,
  getLocalTimeZone,
  today,
} from "@internationalized/date"

import type { DateTimeInput as DateTimeInputProto } from "@streamlit/protobuf"

import IsSidebarContext from "~lib/components/core/IsSidebarContext"
import { LibConfigContext } from "~lib/components/core/LibConfigContext"
import { requiredFieldError } from "~lib/components/widgets/BaseWidget/requiredField"
import { WidgetLabel } from "~lib/components/widgets/BaseWidget/WidgetLabel"
import { WidgetLabelHelpIcon } from "~lib/components/widgets/BaseWidget/WidgetLabelHelpIcon"
import { useBasicWidgetState } from "~lib/hooks/useBasicWidgetState"
import { isInForm, labelVisibilityProtoValueToEnum } from "~lib/util/utils"
import type { WidgetStateManager } from "~lib/WidgetStateManager"

import {
  calendarDateTimeToIso,
  createDateTimeErrorMessage,
  type DateTimeValidationErrorType,
  formatCalendarDateTime,
  getCurrStateFromProto,
  getDefaultStateFromProto,
  getStateFromWidgetMgr,
  isoToCalendarDateTime,
  updateWidgetMgrState,
  validateDateTime,
} from "./dateTimeInputUtils"
import SingleDateTimeInput from "./SingleDateTimeInput"

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
  const isInSidebar = useContext(IsSidebarContext)
  const [error, setError] = useState<string | null>(null)
  const [hasRequiredError, setHasRequiredError] = useState(false)
  // Incremented to make the child drop its local display state and repaint the
  // committed value: on form clear, and on a programmatic value that equals the
  // committed one while the field shows something else.
  const [resetKey, setResetKey] = useState(0)
  const formSubmitValidatorRef = useRef<() => boolean>(() => true)
  /** Last value accepted by a commit, a programmatic update, or a form clear. */
  const lastWrittenIsoRef = useRef<string | null | undefined>(undefined)
  /** The last complete (or empty) value the field reported: edits, commits,
   * and blocked attempts. Partial drafts are not tracked, because the field
   * does not report them (see `onEdit`). */
  const pendingIsoRef = useRef<string | null>(null)

  const resetError = useCallback(() => {
    setError(null)
  }, [])

  const handleFormCleared = useCallback(() => {
    const defaultIso = getDefaultStateFromProto(element)
    lastWrittenIsoRef.current = defaultIso
    pendingIsoRef.current = defaultIso
    setHasRequiredError(false)
    resetError()
    setResetKey(k => k + 1)
  }, [element, resetError])

  const queryParamBinding = element.queryParamKey
    ? {
        paramKey: element.queryParamKey,
        valueType: "string_array_value" as const,
        // Query-param emptiness follows the default, not requiredness.
        clearable: element.default.length === 0,
      }
    : undefined

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
    onFormCleared: handleFormCleared,
  })

  if (lastWrittenIsoRef.current === undefined) {
    lastWrittenIsoRef.current = value
    pendingIsoRef.current = value
  }

  const { locale } = useContext(LibConfigContext)

  // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions -- `step` is a number or Long; an unset 0 falls back to 900 seconds
  const step = element.step ? Number(element.step) : 900

  const minDateTime = useMemo(
    () => isoToCalendarDateTime(element.min),
    [element.min]
  )
  const maxDateTime = useMemo(
    () => isoToCalendarDateTime(element.max),
    [element.max]
  )

  const currentValue = useMemo(() => isoToCalendarDateTime(value), [value])

  // Hide the clear X when required. Keyboard emptying still notifies the
  // parent when the default is empty (`allowEmptyCommit`), so `required` can
  // block it; non-empty defaults revert locally.
  const allowEmptyCommit = element.default.length === 0 && !disabled
  const clearable = allowEmptyCommit && !element.required

  const minDateString = useMemo(
    () =>
      minDateTime ? formatCalendarDateTime(minDateTime, element.format) : "",
    [minDateTime, element.format]
  )
  const maxDateString = useMemo(
    () =>
      maxDateTime ? formatCalendarDateTime(maxDateTime, element.format) : "",
    [maxDateTime, element.format]
  )

  const buildErrorMessage = useCallback(
    (errorType: DateTimeValidationErrorType): string | null =>
      createDateTimeErrorMessage(errorType, minDateString, maxDateString),
    [minDateString, maxDateString]
  )

  const inForm = isInForm({ formId: element.formId })

  /**
   * Writes a value after required-then-range checks. Returns false without
   * writing when either check fails. `skipRequired` stages an empty in-form
   * value so the submit validator can still paint the required error.
   */
  const commitIsoValue = useCallback(
    ({
      iso,
      fromUser,
      skipRequired = false,
    }: {
      iso: string | null
      fromUser: boolean
      skipRequired?: boolean
    }): boolean => {
      if (element.required && iso === null && !skipRequired) {
        // Record the blocked empty attempt as pending so the required error
        // paints, even when the field never reported the clear through
        // `onEdit`.
        pendingIsoRef.current = null
        setHasRequiredError(true)
        setError(null)
        return false
      }

      if (iso !== null) {
        const dt = isoToCalendarDateTime(iso)
        // Unreachable for values produced by calendarDateTimeToIso. Refuse the
        // write rather than send an unparsable string.
        if (!dt) return false
        const errorType = validateDateTime(dt, minDateTime, maxDateTime)
        if (errorType) {
          setError(buildErrorMessage(errorType))
          return false
        }
      }

      setHasRequiredError(false)
      setError(null)
      lastWrittenIsoRef.current = iso
      pendingIsoRef.current = iso
      setValueWithSource({ value: iso, fromUser })
      // Inside a form, write synchronously so a submit in the same event
      // (Enter-to-submit, or blur before the submit click) sees the value.
      // Form widget writes do not schedule a rerun.
      if (inForm) {
        updateWidgetMgrState(
          element,
          widgetMgr,
          { value: iso, fromUser },
          fragmentId
        )
      }
      return true
    },
    [
      buildErrorMessage,
      element,
      fragmentId,
      inForm,
      maxDateTime,
      minDateTime,
      setValueWithSource,
      widgetMgr,
    ]
  )

  const handleChange = useCallback(
    (dt: CalendarDateTime | null): boolean =>
      commitIsoValue({
        iso: dt ? calendarDateTimeToIso(dt) : null,
        fromUser: true,
        skipRequired: inForm,
      }),
    [commitIsoValue, inForm]
  )

  const handleEdit = useCallback((iso: string | null): void => {
    pendingIsoRef.current = iso
    setHasRequiredError(false)
  }, [])

  const handleValidate = useCallback(
    (dt: CalendarDateTime | null): void => {
      resetError()
      if (!dt) return
      const errorType = validateDateTime(dt, minDateTime, maxDateTime)
      if (errorType) {
        setError(buildErrorMessage(errorType))
      }
    },
    [buildErrorMessage, maxDateTime, minDateTime, resetError]
  )

  // The child reverted its display to the committed value (partial or
  // out-of-range entry, or a full clear of a non-empty default). Drop the
  // pending edit so the submit validator and the required error follow the
  // restored value.
  const handleClose = useCallback(
    (shouldClearError: boolean): void => {
      if (!shouldClearError) return
      pendingIsoRef.current = lastWrittenIsoRef.current ?? null
      setHasRequiredError(false)
      resetError()
    },
    [resetError]
  )

  // Incoming setValue (session_state / script) is authoritative, even when it
  // equals the last accepted value (e.g. after a blocked empty commit left the
  // field empty).
  const incomingSetValue = element.setValue
  const protoIso = getCurrStateFromProto(element)
  useEffect(() => {
    if (incomingSetValue) {
      const displayDiverged = pendingIsoRef.current !== protoIso
      lastWrittenIsoRef.current = protoIso
      pendingIsoRef.current = protoIso
      setHasRequiredError(false)
      // A different value repaints through the `value` prop. An unchanged ISO
      // string keeps `currentValue`'s identity, so the field needs a reset to
      // repaint, but only when it shows something else: resetting on every
      // setValue would remount (and refocus) the field in apps that assign
      // session state on every rerun.
      if (displayDiverged && protoIso === value) {
        setResetKey(k => k + 1)
      }
      return
    }
    const lastWritten = lastWrittenIsoRef.current
    if (lastWritten !== undefined && value !== lastWritten) {
      lastWrittenIsoRef.current = value
      pendingIsoRef.current = value
      setHasRequiredError(false)
    }
  }, [incomingSetValue, protoIso, value])

  const requiredError = requiredFieldError(
    element.required,
    hasRequiredError,
    pendingIsoRef.current === null
  )
  if (hasRequiredError && requiredError === null) {
    setHasRequiredError(false)
  }
  const displayedError = requiredError ?? error

  /**
   * Returns false to abort the form submit, painting the required error.
   * Reads refs rather than render state: Enter-to-submit runs it in the same
   * event as the commit.
   */
  formSubmitValidatorRef.current = () => {
    if (!element.required) return true
    const lastWritten = lastWrittenIsoRef.current ?? null
    // A field that cannot commit empty (!allowEmptyCommit) reverts a full clear
    // locally, so check the last written value instead.
    const pending =
      pendingIsoRef.current === null && !allowEmptyCommit
        ? lastWritten
        : pendingIsoRef.current
    if (pending !== lastWritten) {
      // Edited but not committed yet: no blur or Enter ran, e.g. a programmatic
      // submit while the field has focus. Commit it now so the submit sees
      // this value.
      return commitIsoValue({ iso: pending, fromUser: true })
    }
    if (pending === null) {
      setHasRequiredError(true)
      return false
    }
    return true
  }

  // Registered for every in-form datetime input, so toggling `required` on a
  // keyed widget does not need to re-register.
  useEffect(() => {
    if (!inForm) return undefined

    const validator = (): boolean => formSubmitValidatorRef.current()
    widgetMgr.addFormSubmitValidator(element.formId, element.id, validator)

    return () => {
      widgetMgr.removeFormSubmitValidator(element.formId, element.id)
    }
  }, [element.formId, element.id, inForm, widgetMgr])

  const handleFormSubmit = useCallback((): void => {
    widgetMgr.submitForm(element.formId, fragmentId)
  }, [element.formId, widgetMgr, fragmentId])

  const allowEnterToSubmit = inForm
    ? widgetMgr.allowFormEnterToSubmit(element.formId)
    : false

  // Seed the calendar's focused date from the current value or today.
  const [focusedValue, setFocusedValue] = useState<CalendarDate>(() => {
    if (currentValue) {
      return new CalendarDate(
        currentValue.year,
        currentValue.month,
        currentValue.day
      )
    }
    const now = today(getLocalTimeZone())
    if (minDateTime) {
      const minDate = new CalendarDate(
        minDateTime.year,
        minDateTime.month,
        minDateTime.day
      )
      return now.compare(minDate) < 0 ? minDate : now
    }
    return now
  })

  // Sync focused date when committed value changes externally.
  useEffect(() => {
    if (currentValue) {
      setFocusedValue(
        new CalendarDate(
          currentValue.year,
          currentValue.month,
          currentValue.day
        )
      )
    } else {
      const now = today(getLocalTimeZone())
      if (minDateTime) {
        const minDate = new CalendarDate(
          minDateTime.year,
          minDateTime.month,
          minDateTime.day
        )
        setFocusedValue(now.compare(minDate) < 0 ? minDate : now)
      } else {
        setFocusedValue(now)
      }
    }
  }, [currentValue, minDateTime])

  return (
    <div className="stDateTimeInput" data-testid="stDateTimeInput">
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
      <SingleDateTimeInput
        value={currentValue}
        onChange={handleChange}
        minDateTime={minDateTime}
        maxDateTime={maxDateTime}
        format={element.format}
        step={step}
        disabled={disabled}
        clearable={clearable}
        allowEmptyCommit={allowEmptyCommit}
        required={element.required}
        onEdit={handleEdit}
        label={element.label}
        error={displayedError}
        locale={locale}
        isInSidebar={isInSidebar}
        focusedValue={focusedValue}
        onFocusChange={setFocusedValue}
        onValidate={handleValidate}
        onClose={handleClose}
        formSubmit={allowEnterToSubmit ? handleFormSubmit : undefined}
        resetKey={resetKey}
      />
    </div>
  )
}

export default memo(DateTimeInput)
