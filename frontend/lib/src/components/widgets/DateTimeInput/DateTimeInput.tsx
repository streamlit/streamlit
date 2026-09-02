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

import {
  CalendarDate,
  CalendarDateTime,
  getLocalTimeZone,
  today,
} from "@internationalized/date"

import { DateTimeInput as DateTimeInputProto } from "@streamlit/protobuf"

import IsSidebarContext from "~lib/components/core/IsSidebarContext"
import { LibConfigContext } from "~lib/components/core/LibConfigContext"
import { WidgetLabel } from "~lib/components/widgets/BaseWidget/WidgetLabel"
import { WidgetLabelHelpIcon } from "~lib/components/widgets/BaseWidget/WidgetLabelHelpIcon"
import { useBasicWidgetState } from "~lib/hooks/useBasicWidgetState"
import { isInForm, labelVisibilityProtoValueToEnum } from "~lib/util/utils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import {
  calendarDateTimeToIso,
  createDateTimeErrorMessage,
  DateTimeValidationErrorType,
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
  const [formResetKey, setFormResetKey] = useState(0)

  const resetError = useCallback(() => {
    setError(null)
  }, [])

  const handleFormCleared = useCallback(() => {
    resetError()
    setFormResetKey(k => k + 1)
  }, [resetError])

  const queryParamBinding = element.queryParamKey
    ? {
        paramKey: element.queryParamKey,
        valueType: "string_array_value" as const,
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

  const { locale } = useContext(LibConfigContext)

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

  const clearable = element.default.length === 0 && !disabled

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

  const handleChange = useCallback(
    (dt: CalendarDateTime | null): void => {
      resetError()

      if (!dt) {
        setValueWithSource({ value: null, fromUser: true })
        return
      }

      const errorType = validateDateTime(dt, minDateTime, maxDateTime)
      if (errorType) {
        setError(buildErrorMessage(errorType))
        return
      }
      setValueWithSource({ value: calendarDateTimeToIso(dt), fromUser: true })
    },
    [
      buildErrorMessage,
      maxDateTime,
      minDateTime,
      resetError,
      setValueWithSource,
    ]
  )

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

  const handleClose = useCallback(
    (shouldClearError?: boolean): void => {
      if (!shouldClearError) return
      resetError()
    },
    [resetError]
  )

  const inForm = isInForm({ formId: element.formId })
  const handleFormCommit = useCallback(
    (dt: CalendarDateTime | null): void => {
      if (!inForm) return
      const isoValue = dt ? calendarDateTimeToIso(dt) : null
      updateWidgetMgrState(
        element,
        widgetMgr,
        { value: isoValue, fromUser: true },
        fragmentId
      )
    },
    [inForm, element, widgetMgr, fragmentId]
  )

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
        label={element.label}
        error={error}
        locale={locale}
        isInSidebar={isInSidebar}
        focusedValue={focusedValue}
        onFocusChange={setFocusedValue}
        onValidate={handleValidate}
        onClose={handleClose}
        formCommit={inForm ? handleFormCommit : undefined}
        formSubmit={allowEnterToSubmit ? handleFormSubmit : undefined}
        formResetKey={formResetKey}
      />
    </div>
  )
}

export default memo(DateTimeInput)
