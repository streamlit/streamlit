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
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import type { KeyboardEvent, MutableRefObject, RefObject } from "react"

import styled from "@emotion/styled"
import {
  ChevronLeft,
  ChevronRight,
  ErrorOutline,
} from "@emotion-icons/material-outlined"
import { CalendarDate, parseDate } from "@internationalized/date"
import { format } from "date-fns"
import moment from "moment"
import {
  Button,
  Calendar,
  CalendarCell,
  CalendarGrid,
  DatePicker,
  DatePickerStateContext,
  DateRangePicker,
  DateRangePickerStateContext,
  Dialog,
  Group,
  Heading,
  I18nProvider,
  Popover,
  RangeCalendar,
} from "react-aria-components"

import { DateInput as DateInputProto } from "@streamlit/protobuf"

import IsSidebarContext from "~lib/components/core/IsSidebarContext"
import { LibConfigContext } from "~lib/components/core/LibConfigContext"
import {
  getBorderColor,
  getPopoverContainerStyle,
} from "~lib/components/shared/Base/styled-components"
import Icon from "~lib/components/shared/Icon/Icon"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown/StreamlitMarkdown"
import Tooltip, { Placement } from "~lib/components/shared/Tooltip/Tooltip"
import { WidgetLabel } from "~lib/components/widgets/BaseWidget/WidgetLabel"
import { WidgetLabelHelpIcon } from "~lib/components/widgets/BaseWidget/WidgetLabelHelpIcon"
import {
  useBasicWidgetState,
  ValueWithSource,
} from "~lib/hooks/useBasicWidgetState"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { convertRemToPx } from "~lib/theme/utils"
import {
  isNullOrUndefined,
  labelVisibilityProtoValueToEnum,
} from "~lib/util/utils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import { useIntlLocale } from "./useIntlLocale"

export interface Props {
  disabled: boolean
  element: DateInputProto
  widgetMgr: WidgetStateManager
  fragmentId?: string
}

// Date format for protobuf communication (ISO 8601)
const DATE_FORMAT = "YYYY-MM-DD"

const RANGE_JOIN_EN = " – "
const RANGE_JOIN_ASCII = " - "

/** Convert an array of strings to an array of dates. */
function stringsToDates(strings: string[]): Date[] {
  return strings.map(val => moment(val, DATE_FORMAT).toDate())
}

/** Convert an array of dates to an array of strings. */
function datesToStrings(dates: Date[]): string[] {
  if (!dates) {
    return []
  }
  return dates.map((value: Date) => moment(value).format(DATE_FORMAT))
}

function dateToCalendarDate(d: Date): CalendarDate {
  return new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

function calendarDateToDate(cd: CalendarDate): Date {
  return new Date(cd.year, cd.month - 1, cd.day)
}

/** Parse protobuf/wire date strings for @internationalized/date (expects ISO `YYYY-MM-DD`). */
function wireStringToCalendarDate(s: string): CalendarDate {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return parseDate(s)
  }
  const m = moment(
    s,
    [DATE_FORMAT, "YYYY/MM/DD", "MM/DD/YYYY", "DD/MM/YYYY"],
    true
  )
  if (!m.isValid()) {
    throw new Error(`Invalid wire date string: ${s}`)
  }
  return dateToCalendarDate(m.toDate())
}

function formatDatesForDisplay(dates: Date[], displayPattern: string): string {
  if (!dates.length) {
    return ""
  }
  if (dates.length === 1) {
    return moment(dates[0]).format(displayPattern)
  }
  return `${moment(dates[0]).format(displayPattern)}${RANGE_JOIN_EN}${moment(
    dates[1]
  ).format(displayPattern)}`
}

function splitRangeString(raw: string): [string, string] | null {
  const enIdx = raw.indexOf(RANGE_JOIN_EN)
  if (enIdx !== -1) {
    return [
      raw.slice(0, enIdx).trim(),
      raw.slice(enIdx + RANGE_JOIN_EN.length).trim(),
    ]
  }
  const ascIdx = raw.indexOf(RANGE_JOIN_ASCII)
  if (ascIdx !== -1) {
    return [
      raw.slice(0, ascIdx).trim(),
      raw.slice(ascIdx + RANGE_JOIN_ASCII.length).trim(),
    ]
  }
  return null
}

function parseDisplayToDates(
  text: string,
  isRange: boolean,
  displayPattern: string
): Date[] | null {
  const trimmed = text.trim()
  if (!trimmed) {
    return []
  }
  if (!isRange) {
    const m = moment(trimmed, displayPattern, true)
    return m.isValid() ? [m.toDate()] : null
  }
  const parts = splitRangeString(trimmed)
  if (!parts) {
    return null
  }
  const [a, b] = parts
  const m1 = moment(a, displayPattern, true)
  const m2 = moment(b, displayPattern, true)
  if (!m1.isValid() || !m2.isValid()) {
    return null
  }
  return [m1.toDate(), m2.toDate()]
}

function resolveBcp47Locale(locale: string): string {
  try {
    return new Intl.Locale(locale).toString()
  } catch {
    return "en-US"
  }
}

/* eslint-disable @typescript-eslint/no-use-before-define -- styled components and QuickSelectControl are declared later in this module */
// Types for date validation
type ValidationResult = {
  errorType: "Start" | "End" | null
  newDates: Date[]
}

/** Must render under DatePicker or DateRangePicker so calendar overlay state is available. */
const StreamlitCalendarOpenButton = memo(function StreamlitCalendarOpenButton({
  disabled,
}: {
  disabled: boolean
}): ReactElement {
  const btnRef = useRef<HTMLButtonElement>(null)
  useLayoutEffect(() => {
    const el = btnRef.current
    if (!el) {
      return
    }
    el.removeAttribute("aria-labelledby")
    el.setAttribute("aria-label", "Select a date.")
  })
  return (
    <CalendarOpenButton
      ref={btnRef}
      isDisabled={disabled}
      data-testid="stDateInputCalendarButton"
    />
  )
})

const PickerTextInput = memo(function PickerTextInput({
  disabled,
  placeholderText,
  textValue,
  onTextInputChange,
  onBlurEmpty,
  onBlurCommit,
  /** Commit DOM text before closing overlay (e2e: Enter then Escape; RAC may resync from calendar). */
  commitDomValue,
  /** Parse + commit widget state from the native input value (typing, Playwright fill/change, Enter). */
  commitFromDomValue,
  clearable,
  onEscapeClear,
  textInputRef,
  racOverlayRef,
  editingRef,
  error,
  colors,
  sizes,
  spacing,
  lineHeights,
  fontWeights,
  zIndices,
  radii,
}: {
  disabled: boolean
  placeholderText: string
  textValue: string
  onTextInputChange: (raw: string | null | undefined) => void
  onBlurEmpty: () => void
  onBlurCommit: (domValue: string) => void
  commitDomValue: (domValue?: string) => void
  commitFromDomValue: (domValue: string) => void
  clearable: boolean
  onEscapeClear: () => void
  textInputRef: RefObject<HTMLInputElement>
  racOverlayRef: MutableRefObject<{
    isOpen: boolean
    setOpen: (open: boolean) => void
  } | null>
  editingRef: MutableRefObject<boolean>
  error: boolean
  colors: ReturnType<typeof useEmotionTheme>["colors"]
  sizes: ReturnType<typeof useEmotionTheme>["sizes"]
  spacing: ReturnType<typeof useEmotionTheme>["spacing"]
  lineHeights: ReturnType<typeof useEmotionTheme>["lineHeights"]
  fontWeights: ReturnType<typeof useEmotionTheme>["fontWeights"]
  zIndices: ReturnType<typeof useEmotionTheme>["zIndices"]
  radii: ReturnType<typeof useEmotionTheme>["radii"]
}): ReactElement {
  const datePickerState = useContext(DatePickerStateContext)
  const dateRangePickerState = useContext(DateRangePickerStateContext)
  const overlayState = datePickerState ?? dateRangePickerState

  useLayoutEffect(() => {
    racOverlayRef.current = overlayState ?? null
    return () => {
      racOverlayRef.current = null
    }
  }, [overlayState, racOverlayRef])

  const openPickerOnFieldClick = useCallback(() => {
    if (disabled || !overlayState) {
      return
    }
    overlayState.setOpen(true)
  }, [disabled, overlayState])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        if (overlayState?.isOpen) {
          e.preventDefault()
          commitDomValue()
          overlayState.setOpen(false)
          return
        }
        if (clearable) {
          e.preventDefault()
          onEscapeClear()
        }
      }
    },
    [clearable, commitDomValue, onEscapeClear, overlayState]
  )

  return (
    <StyledTextInput
      ref={textInputRef}
      data-testid="stDateInputField"
      type="text"
      disabled={disabled}
      placeholder={placeholderText}
      value={textValue}
      onClick={openPickerOnFieldClick}
      onKeyDownCapture={handleKeyDown}
      onKeyDown={e => {
        if (e.key === "Enter") {
          e.preventDefault()
          e.stopPropagation()
          const el = e.currentTarget as HTMLInputElement
          commitFromDomValue(el.value)
          const os = racOverlayRef.current
          if (os?.isOpen) {
            os.setOpen(false)
          }
        }
      }}
      onChange={e => {
        const el = e.currentTarget as HTMLInputElement
        onTextInputChange(el.value)
        commitFromDomValue(el.value)
      }}
      onFocus={e => {
        editingRef.current = true
        // Do not open the popover here: RAC moves focus into the overlay, which
        // prevents keyboard input from updating this field (e.g. tests using user.type).
        // Select-all so Playwright `type()`/`fill()` replace the existing display text.
        ;(e.target as HTMLInputElement).select()
      }}
      onBlur={e => {
        const el = e.target as HTMLInputElement
        const domVal = el.value
        onBlurCommit(domVal)
        if (domVal.trim() === "") {
          onBlurEmpty()
        }
        editingRef.current = false
      }}
      $hasError={error}
      $colors={colors}
      $sizes={sizes}
      $spacing={spacing}
      $lineHeights={lineHeights}
      $fontWeights={fontWeights}
      $zIndices={zIndices}
      $radii={radii}
    />
  )
})

function DateInput({
  disabled,
  element,
  widgetMgr,
  fragmentId,
}: Props): ReactElement {
  const theme = useEmotionTheme()
  const isInSidebar = useContext(IsSidebarContext)
  const [isEmpty, setIsEmpty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [textValue, setTextValue] = useState("")
  const valueWireRef = useRef<string | undefined>(undefined)
  const textFieldRef = useRef<HTMLInputElement | null>(null)
  /** True between field focus and blur; avoids value→text sync clobbering draft if activeElement check fails mid-typing. */
  const isDateFieldEditingRef = useRef(false)
  /** Skip one blur commit (form clear blurs before controlled value syncs to the DOM). */
  const skipNextBlurCommitRef = useRef(false)

  const resetError = useCallback(() => {
    setError(null)
  }, [])

  const handleFormCleared = useCallback(() => {
    skipNextBlurCommitRef.current = true
    resetError()
    setIsEmpty(false)
    valueWireRef.current = undefined
    // Blur so the value→text sync effect can run after form reset (field was focused with invalid text).
    textFieldRef.current?.blur()
  }, [resetError])

  const queryParamBinding = element.queryParamKey
    ? {
        paramKey: element.queryParamKey,
        valueType: "string_array_value" as const,
        clearable: element.default.length === 0,
        urlFormat: element.isRange ? ("repeated" as const) : undefined,
      }
    : undefined

  const [value, setValueWithSource] = useBasicWidgetState<
    Date[],
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

  const { colors, fontWeights, lineHeights, spacing, sizes, zIndices, radii } =
    useEmotionTheme()

  const { locale: libLocale } = useContext(LibConfigContext)
  const loadedLocale = useIntlLocale(libLocale)
  const bcp47Locale = useMemo(() => resolveBcp47Locale(libLocale), [libLocale])

  const displayPattern = element.format

  const minDate = useMemo(
    () => moment(element.min, DATE_FORMAT).toDate(),
    [element.min]
  )

  const maxDate = useMemo(() => getMaxDate(element), [element])

  const minValueCal = useMemo(
    () => wireStringToCalendarDate(element.min),
    [element.min]
  )
  const maxValueCal = useMemo(
    () =>
      element.max?.length ? wireStringToCalendarDate(element.max) : undefined,
    [element.max]
  )

  const enableQuickSelect = useMemo(() => {
    if (!element.isRange) {
      return false
    }
    const twoYearsAgo = moment().subtract(2, "years").toDate()
    return minDate < twoYearsAgo
  }, [element.isRange, minDate])

  const clearable = element.default.length === 0 && !disabled

  const dateFormatForErrors = useMemo(
    () => element.format.replaceAll("Y", "y").replaceAll("D", "d"),
    [element.format]
  )

  const minDateString = useMemo(
    () => format(minDate, dateFormatForErrors, { locale: loadedLocale }),
    [minDate, dateFormatForErrors, loadedLocale]
  )

  const maxDateString = useMemo(
    () =>
      maxDate
        ? format(maxDate, dateFormatForErrors, { locale: loadedLocale })
        : "",
    [maxDate, dateFormatForErrors, loadedLocale]
  )

  const createErrorMessage = useCallback(
    (errorType: string | null): string | null => {
      if (!errorType) return null

      if (element.isRange) {
        const messageEnding =
          errorType === "End"
            ? `before ${maxDateString}`
            : `after ${minDateString}`

        return `**Error**: ${errorType} date set outside allowed range. Please select a date ${messageEnding}.`
      }

      return `**Error**: Date set outside allowed range. Please select a date between ${minDateString} and ${maxDateString}.`
    },
    [element.isRange, maxDateString, minDateString]
  )

  const handleChange = useCallback(
    (nextDates: Date[] | null | undefined): void => {
      resetError()

      if (isNullOrUndefined(nextDates) || nextDates.length === 0) {
        setValueWithSource({ value: [], fromUi: true })
        setIsEmpty(true)
        setTextValue("")
        return
      }

      const normalizedDateInput: DateOrEmpty[] | DateOrEmpty = Array.isArray(
        nextDates
      )
        ? nextDates
            .filter((d): d is Date => Boolean(d))
            .map(d => normalizeToStartOfDay(d))
        : normalizeToStartOfDay(nextDates)

      const { errorType, newDates } = validateDates(
        normalizedDateInput,
        minDate,
        maxDate
      )
      if (errorType) {
        setError(createErrorMessage(errorType))
        // Do not push invalid dates to widget/session state (matches e2e: value unchanged).
        return
      }
      setValueWithSource({ value: newDates, fromUi: true })
      setIsEmpty(!newDates.length)
    },
    [createErrorMessage, maxDate, minDate, resetError, setValueWithSource]
  )

  const syncDisplayTextFromValue = useCallback(() => {
    const wire = datesToStrings(value).join("|")
    valueWireRef.current = wire
    setTextValue(formatDatesForDisplay(value, displayPattern))
  }, [value, displayPattern])

  useEffect(() => {
    const wire = datesToStrings(value).join("|")
    if (valueWireRef.current === wire) {
      return
    }
    // Avoid clobbering the field while it is focused: value from the server may
    // lag behind in-progress typing, fill(), or Enter commits.
    if (
      isDateFieldEditingRef.current ||
      textFieldRef.current === document.activeElement
    ) {
      valueWireRef.current = wire
      return
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    syncDisplayTextFromValue()
  }, [syncDisplayTextFromValue, value, displayPattern])

  const handleClose = useCallback((): void => {
    if (!isEmpty) return
    // Range inputs: an empty text field means [] — do not restore element.default
    // (defaults may be a non-empty range; tests expect () after clear + blur).
    if (element.isRange) {
      return
    }

    const newValue = stringsToDates(element.default)
    setValueWithSource({ value: newValue, fromUi: true })
    setIsEmpty(!newValue.length)
    setTextValue(formatDatesForDisplay(newValue, displayPattern))
  }, [
    displayPattern,
    element.default,
    element.isRange,
    isEmpty,
    setValueWithSource,
  ])

  const singleCalendarValue = useMemo((): CalendarDate | null => {
    if (element.isRange || !value.length) {
      return null
    }
    return dateToCalendarDate(value[0])
  }, [element.isRange, value])

  const rangeCalendarValue = useMemo(() => {
    if (!element.isRange || value.length < 2) {
      return null
    }
    return {
      start: dateToCalendarDate(value[0]),
      end: dateToCalendarDate(value[1]),
    }
  }, [element.isRange, value])

  // React Aria may call onChange(null) during overlay open/close or controlled sync.
  // We use a separate text field for typing; clearing is handled via clear button / empty input.
  const onCalendarChangeSingle = useCallback(
    (d: CalendarDate | null) => {
      if (!d) {
        return
      }
      handleChange([calendarDateToDate(d)])
    },
    [handleChange]
  )

  const onCalendarChangeRange = useCallback(
    (range: { start: CalendarDate; end: CalendarDate } | null) => {
      if (!range) {
        return
      }
      handleChange([
        calendarDateToDate(range.start),
        calendarDateToDate(range.end),
      ])
    },
    [handleChange]
  )

  /** Update visible text + validation while typing; widget commits on blur/Enter/calendar only. */
  const syncDraftText = useCallback(
    (raw: string) => {
      const next = String(raw)
      setTextValue(next)
      const trimmed = next.trim()
      if (!trimmed) {
        setIsEmpty(true)
        resetError()
        return
      }
      setIsEmpty(false)
      const parsed = parseDisplayToDates(next, element.isRange, displayPattern)
      if (parsed === null) {
        resetError()
        return
      }
      if (parsed.length === 0) {
        setIsEmpty(true)
        resetError()
        return
      }
      const normalizedDateInput: DateOrEmpty[] = parsed
        .filter((d): d is Date => Boolean(d))
        .map(d => normalizeToStartOfDay(d))

      const { errorType } = validateDates(
        normalizedDateInput,
        minDate,
        maxDate
      )
      if (errorType) {
        setError(createErrorMessage(errorType))
      } else {
        resetError()
      }
    },
    [
      createErrorMessage,
      displayPattern,
      element.isRange,
      maxDate,
      minDate,
      resetError,
    ]
  )

  const onTextInputChange = useCallback(
    (raw: string | null | undefined) => {
      syncDraftText(raw === null || raw === undefined ? "" : String(raw))
    },
    [syncDraftText]
  )

  const commitTextFromField = useCallback(
    (rawFromDom?: string) => {
      const v = rawFromDom !== undefined ? rawFromDom : textValue
      if (rawFromDom !== undefined) {
        setTextValue(rawFromDom)
      }
      const parsed = parseDisplayToDates(v, element.isRange, displayPattern)
      if (parsed === null) {
        return
      }
      const normalizedDateInput: DateOrEmpty[] = parsed
        .filter((d): d is Date => Boolean(d))
        .map(d => normalizeToStartOfDay(d))
      const { errorType, newDates } = validateDates(
        normalizedDateInput,
        minDate,
        maxDate
      )
      if (errorType) {
        return
      }
      const nextWire = datesToStrings(newDates).join("|")
      const currWire = datesToStrings(value).join("|")
      if (nextWire === currWire) {
        return
      }
      handleChange(parsed)
    },
    [
      displayPattern,
      element.isRange,
      handleChange,
      maxDate,
      minDate,
      textValue,
      value,
    ]
  )

  const handleBlurCommit = useCallback(
    (domVal: string) => {
      if (skipNextBlurCommitRef.current) {
        skipNextBlurCommitRef.current = false
        return
      }
      commitTextFromField(domVal)
    },
    [commitTextFromField]
  )

  const clearFieldFromEscape = useCallback(() => {
    handleChange([])
  }, [handleChange])

  const firstDayOfWeek = useMemo(() => {
    const ws = loadedLocale.options?.weekStartsOn ?? 0
    const names = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const
    return names[ws] ?? "sun"
  }, [loadedLocale.options?.weekStartsOn])

  const placeholderText = element.isRange
    ? `${element.format}${RANGE_JOIN_EN}${element.format}`
    : element.format

  const pickerCommon = {
    minValue: minValueCal,
    maxValue: maxValueCal,
    isDisabled: disabled,
    granularity: "day" as const,
    shouldCloseOnSelect: true,
  }

  const calendarChrome = (
    <>
      <CalendarNavRow>
        <Button slot="previous">
          <Icon content={ChevronLeft} size="lg" />
        </Button>
        <Heading />
        <Button slot="next">
          <Icon content={ChevronRight} size="lg" />
        </Button>
      </CalendarNavRow>
      <CalendarGrid weekdayStyle="narrow">
        {date => <StyledCalendarCell date={date} />}
      </CalendarGrid>
    </>
  )

  const racOverlayRef = useRef<{
    isOpen: boolean
    setOpen: (open: boolean) => void
  } | null>(null)

  return (
    <I18nProvider locale={bcp47Locale}>
      <div
        className="stDateInput"
        data-testid="stDateInput"
        data-validation-error={error ? "true" : undefined}
        data-validation-message={error ?? undefined}
      >
        <WidgetLabel
          label={element.label}
          disabled={disabled}
          labelVisibility={labelVisibilityProtoValueToEnum(
            element.labelVisibility?.value
          )}
        >
          {element.help && (
            <WidgetLabelHelpIcon
              content={element.help}
              label={element.label}
            />
          )}
        </WidgetLabel>

        {element.isRange ? (
          <DateRangePicker
            {...pickerCommon}
            value={rangeCalendarValue}
            onChange={onCalendarChangeRange}
            aria-label={element.label || "Date range"}
          >
            <StyledPickerRoot>
              <StyledGroup
                data-testid="stDateInputGroup"
                $hasError={Boolean(error)}
              >
                <PickerTextInput
                  disabled={disabled}
                  placeholderText={placeholderText}
                  textValue={textValue}
                  onTextInputChange={onTextInputChange}
                  onBlurEmpty={handleClose}
                  onBlurCommit={handleBlurCommit}
                  commitDomValue={commitTextFromField}
                  commitFromDomValue={commitTextFromField}
                  clearable={clearable}
                  onEscapeClear={clearFieldFromEscape}
                  textInputRef={textFieldRef}
                  racOverlayRef={racOverlayRef}
                  editingRef={isDateFieldEditingRef}
                  error={Boolean(error)}
                  colors={colors}
                  sizes={sizes}
                  spacing={spacing}
                  lineHeights={lineHeights}
                  fontWeights={fontWeights}
                  zIndices={zIndices}
                  radii={radii}
                />
                {clearable && (
                  <ClearButton
                    type="button"
                    disabled={disabled}
                    onClick={() => handleChange([])}
                    aria-label="Clear"
                  >
                    ×
                  </ClearButton>
                )}
                {error && (
                  <Tooltip
                    content={
                      <StreamlitMarkdown source={error} allowHTML={false} />
                    }
                    placement={Placement.TOP_RIGHT}
                    error
                  >
                    <ErrorIconWrap>
                      <Icon content={ErrorOutline} size="lg" />
                    </ErrorIconWrap>
                  </Tooltip>
                )}
                <StreamlitCalendarOpenButton disabled={disabled} />
              </StyledGroup>
              <Popover
                isNonModal
                placement="bottom start"
                offset={convertRemToPx(theme.spacing.twoXS)}
                shouldFlip={!isInSidebar}
                style={getPopoverContainerStyle(theme)}
              >
                <StyledDialog>
                  <StyledCalendarContainer data-testid="stDateInputCalendar">
                    {enableQuickSelect && (
                      <QuickSelect
                        element={element}
                        disabled={disabled}
                        onSelectRange={(start, end) => {
                          handleChange([start, end])
                        }}
                      />
                    )}
                    <RangeCalendar
                      firstDayOfWeek={firstDayOfWeek}
                      aria-label="Calendar."
                    >
                      {calendarChrome}
                    </RangeCalendar>
                  </StyledCalendarContainer>
                </StyledDialog>
              </Popover>
            </StyledPickerRoot>
          </DateRangePicker>
        ) : (
          <DatePicker
            {...pickerCommon}
            value={singleCalendarValue}
            onChange={onCalendarChangeSingle}
            aria-label={element.label || "Date"}
          >
            <StyledPickerRoot>
              <StyledGroup
                data-testid="stDateInputGroup"
                $hasError={Boolean(error)}
              >
                <PickerTextInput
                  disabled={disabled}
                  placeholderText={placeholderText}
                  textValue={textValue}
                  onTextInputChange={onTextInputChange}
                  onBlurEmpty={handleClose}
                  onBlurCommit={handleBlurCommit}
                  commitDomValue={commitTextFromField}
                  commitFromDomValue={commitTextFromField}
                  clearable={clearable}
                  onEscapeClear={clearFieldFromEscape}
                  textInputRef={textFieldRef}
                  racOverlayRef={racOverlayRef}
                  editingRef={isDateFieldEditingRef}
                  error={Boolean(error)}
                  colors={colors}
                  sizes={sizes}
                  spacing={spacing}
                  lineHeights={lineHeights}
                  fontWeights={fontWeights}
                  zIndices={zIndices}
                  radii={radii}
                />
                {clearable && (
                  <ClearButton
                    type="button"
                    disabled={disabled}
                    onClick={() => handleChange([])}
                    aria-label="Clear"
                  >
                    ×
                  </ClearButton>
                )}
                {error && (
                  <Tooltip
                    content={
                      <StreamlitMarkdown source={error} allowHTML={false} />
                    }
                    placement={Placement.TOP_RIGHT}
                    error
                  >
                    <ErrorIconWrap>
                      <Icon content={ErrorOutline} size="lg" />
                    </ErrorIconWrap>
                  </Tooltip>
                )}
                <StreamlitCalendarOpenButton disabled={disabled} />
              </StyledGroup>
              <Popover
                isNonModal
                placement="bottom start"
                offset={convertRemToPx(theme.spacing.twoXS)}
                shouldFlip={!isInSidebar}
                style={getPopoverContainerStyle(theme)}
              >
                <StyledDialog>
                  <StyledCalendarContainer data-testid="stDateInputCalendar">
                    <Calendar
                      firstDayOfWeek={firstDayOfWeek}
                      aria-label="Calendar."
                    >
                      {calendarChrome}
                    </Calendar>
                  </StyledCalendarContainer>
                </StyledDialog>
              </Popover>
            </StyledPickerRoot>
          </DatePicker>
        )}
      </div>
    </I18nProvider>
  )
}

const StyledPickerRoot = styled.div({
  position: "relative",
  width: "100%",
})

/**
 * Outer wrapper: owns border, background, rounded corners, and min height.
 * Follows the token-based "container + transparent input" pattern used by
 * Selectbox and NumberInput in this codebase, so the widget visually fits
 * with the rest of Streamlit's input family via shared theme tokens rather
 * than trying to reproduce BaseWeb's internal styling.
 */
const StyledGroup = styled(Group)<{ $hasError: boolean }>(
  ({ theme, $hasError }) => ({
    display: "flex",
    flexDirection: "row",
    alignItems: "stretch",
    width: "100%",
    position: "relative",
    fontSize: theme.fontSizes.md,
    lineHeight: theme.lineHeights.inputWidget,
    fontWeight: theme.fontWeights.normal,
    minHeight: theme.sizes.minElementHeight,
    borderLeftWidth: theme.sizes.borderWidth,
    borderRightWidth: theme.sizes.borderWidth,
    borderTopWidth: theme.sizes.borderWidth,
    borderBottomWidth: theme.sizes.borderWidth,
    borderStyle: "solid",
    borderColor: getBorderColor(theme.colors, false),
    boxSizing: "border-box",
    borderRadius: theme.radii.default,
    backgroundColor: $hasError
      ? theme.colors.redBackgroundColor
      : theme.colors.widgetBackgroundColor,
    "&[data-focus-within]": {
      borderColor: getBorderColor(theme.colors, true),
    },
  })
)

/**
 * Inner input: transparent, borderless, inherits sizing from StyledGroup.
 */
const StyledTextInput = styled.input<{
  $hasError: boolean
  $colors: ReturnType<typeof useEmotionTheme>["colors"]
  $sizes: ReturnType<typeof useEmotionTheme>["sizes"]
  $spacing: ReturnType<typeof useEmotionTheme>["spacing"]
  $lineHeights: ReturnType<typeof useEmotionTheme>["lineHeights"]
  $fontWeights: ReturnType<typeof useEmotionTheme>["fontWeights"]
  $zIndices: ReturnType<typeof useEmotionTheme>["zIndices"]
  $radii: ReturnType<typeof useEmotionTheme>["radii"]
}>(
  ({
    $hasError,
    $colors,
    $sizes,
    $spacing,
    $lineHeights,
    $fontWeights,
    $zIndices,
  }) => ({
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    boxSizing: "border-box",
    border: "none",
    outline: "none",
    background: "transparent",
    marginLeft: $sizes.tagMarginInsideBorder,
    paddingLeft: $spacing.sm,
    paddingRight: $spacing.sm,
    paddingTop: $spacing.sm,
    paddingBottom: $spacing.sm,
    lineHeight: $lineHeights.inputWidget,
    fontWeight: $fontWeights.normal,
    position: "relative",
    zIndex: $zIndices.priority,
    color: $hasError ? $colors.redTextColor : $colors.bodyText,
    caretColor: $colors.bodyText,
    "::placeholder": {
      color: $colors.fadedText60,
    },
    ":focus": {
      outline: "none",
    },
  })
)

const ClearButton = styled.button(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  boxSizing: "border-box",
  padding: theme.spacing.threeXS,
  marginRight: theme.spacing.twoXS,
  alignSelf: "center",
  height: theme.sizes.clearIconSize,
  width: theme.sizes.clearIconSize,
  border: "none",
  background: "transparent",
  cursor: "pointer",
  color: theme.colors.grayTextColor,
  lineHeight: theme.lineHeights.none,
  fontSize: theme.fontSizes.md,
  ":hover": {
    color: theme.colors.bodyText,
  },
  ":disabled": {
    cursor: "not-allowed",
    color: theme.colors.fadedText40,
  },
}))

const ErrorIconWrap = styled.span(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  alignSelf: "center",
  marginRight: theme.spacing.twoXS,
  color: theme.colors.redTextColor,
  backgroundColor: "transparent",
}))

const CalendarOpenButton = styled(Button)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  paddingRight: theme.spacing.sm,
  paddingLeft: theme.spacing.twoXS,
  border: "none",
  background: "transparent",
  cursor: "pointer",
  color: theme.colors.bodyText,
  "&[data-disabled]": {
    opacity: 0.5,
    cursor: "not-allowed",
  },
}))

const StyledDialog = styled(Dialog)({
  outline: "none",
})

const StyledCalendarContainer = styled.div(({ theme }) => ({
  fontSize: theme.fontSizes.sm,
  padding: theme.spacing.sm,
  color: theme.colors.bodyText,
  backgroundColor: theme.colors.bgColor,
}))

const CalendarNavRow = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: theme.spacing.xs,
  gap: theme.spacing.sm,
}))

const StyledCalendarCell = styled(CalendarCell)(({ theme }) => ({
  padding: theme.spacing.none,
  lineHeight: theme.lineHeights.base,
  "& > div": {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    minHeight: theme.sizes.elementHighlightHeight,
    fontSize: theme.fontSizes.sm,
    borderTopLeftRadius: theme.radii.md2,
    borderTopRightRadius: theme.radii.md2,
    borderBottomRightRadius: theme.radii.md2,
    borderBottomLeftRadius: theme.radii.md2,
    cursor: "default",
    outline: "none",
    "&[data-hovered]:not([data-disabled]):not([data-outside-month])": {
      backgroundColor: theme.colors.darkenedBgMix15,
    },
    "&[data-selected]": {
      backgroundColor: theme.colors.primary,
      color: theme.colors.white,
    },
    "&[data-disabled], &[data-outside-month]": {
      color: theme.colors.fadedText40,
    },
  },
}))

const QuickSelectControl = styled.select<{
  $theme: ReturnType<typeof useEmotionTheme>
}>(({ $theme }) => ({
  boxSizing: "border-box",
  height: $theme.sizes.minElementHeight,
  borderLeftWidth: $theme.sizes.borderWidth,
  borderRightWidth: $theme.sizes.borderWidth,
  borderTopWidth: $theme.sizes.borderWidth,
  borderBottomWidth: $theme.sizes.borderWidth,
  borderStyle: "solid",
  borderColor: $theme.colors.fadedText10,
  borderRadius: $theme.radii.default,
  backgroundColor: $theme.colors.widgetBackgroundColor,
  color: $theme.colors.bodyText,
  fontSize: $theme.fontSizes.sm,
  marginBottom: $theme.spacing.xs,
  width: "100%",
}))

const QuickSelect = memo(function QuickSelect({
  element,
  disabled,
  onSelectRange,
}: {
  element: DateInputProto
  disabled: boolean
  onSelectRange: (start: Date, end: Date) => void
}) {
  const theme = useEmotionTheme()
  return (
    <QuickSelectControl
      data-testid="stDateInputQuickSelect"
      disabled={disabled}
      defaultValue=""
      onChange={e => {
        const v = e.target.value
        if (!v) {
          return
        }
        const today = normalizeToStartOfDay(new Date())
        let start: Date
        let end: Date
        if (v === "past_week") {
          end = today
          start = moment(today).subtract(6, "day").toDate()
        } else if (v === "past_month") {
          end = today
          start = moment(today).subtract(1, "month").toDate()
        } else {
          e.target.selectedIndex = 0
          return
        }
        start = normalizeToStartOfDay(start)
        end = normalizeToStartOfDay(end)
        const minD = moment(element.min, DATE_FORMAT).toDate()
        const maxD = getMaxDate(element)
        if (start < minD) {
          start = minD
        }
        if (maxD && end > maxD) {
          end = maxD
        }
        onSelectRange(start, end)
        e.target.selectedIndex = 0
      }}
      $theme={theme}
    >
      <option value="" disabled>
        Quick select
      </option>
      <option value="past_week">Past Week</option>
      <option value="past_month">Past Month</option>
    </QuickSelectControl>
  )
})

/* eslint-enable @typescript-eslint/no-use-before-define */

function getStateFromWidgetMgr(
  widgetMgr: WidgetStateManager,
  element: DateInputProto
): Date[] | undefined {
  const storedValue = widgetMgr.getStringArrayValue(element)
  if (storedValue === undefined) {
    return undefined
  }
  return stringsToDates(storedValue)
}

function getDefaultStateFromProto(element: DateInputProto): Date[] {
  return stringsToDates(element.default) ?? []
}

function getCurrStateFromProto(element: DateInputProto): Date[] {
  return stringsToDates(element.value) ?? []
}

function updateWidgetMgrState(
  element: DateInputProto,
  widgetMgr: WidgetStateManager,
  vws: ValueWithSource<Date[]>,
  fragmentId: string | undefined
): void {
  const minDate = moment(element.min, DATE_FORMAT).toDate()
  const maxDate = getMaxDate(element)
  let isValid = true

  const normalizedStateValues = (vws.value || []).map(d =>
    normalizeToStartOfDay(d)
  )
  const { errorType } = validateDates(normalizedStateValues, minDate, maxDate)
  if (errorType) {
    isValid = false
  }
  if (isValid) {
    widgetMgr.setStringArrayValue(
      element,
      datesToStrings(vws.value),
      { fromUi: vws.fromUi },
      fragmentId
    )
  }
}

type DateOrEmpty = Date | null | undefined

function validateDates(
  dates: DateOrEmpty[] | DateOrEmpty,
  minDate: Date,
  maxDate: Date | undefined
): ValidationResult {
  const newDates: Date[] = []
  let errorType: "Start" | "End" | null = null

  if (isNullOrUndefined(dates)) {
    return { errorType: null, newDates: [] }
  }

  if (Array.isArray(dates)) {
    dates.forEach((dt: Date | null | undefined) => {
      if (dt) {
        if (maxDate && dt > maxDate) {
          errorType = "End"
        } else if (dt < minDate) {
          errorType = "Start"
        }
        newDates.push(dt)
      }
    })
  } else if (dates) {
    if (maxDate && dates > maxDate) {
      errorType = "End"
    } else if (dates < minDate) {
      errorType = "Start"
    }
    newDates.push(dates)
  }

  return {
    errorType,
    newDates,
  }
}

function getMaxDate(element: DateInputProto): Date | undefined {
  const maxDate = element.max

  return maxDate && maxDate.length > 0
    ? moment(maxDate, DATE_FORMAT).toDate()
    : undefined
}

function normalizeToStartOfDay(date: Date): Date {
  const normalized = new Date(date.getTime())
  normalized.setHours(0, 0, 0, 0)
  return normalized
}

export default memo(DateInput)
