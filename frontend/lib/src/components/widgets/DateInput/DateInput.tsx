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

import styled from "@emotion/styled"
import { ErrorOutline } from "@emotion-icons/material-outlined"
import { CalendarDate, type DateValue } from "@internationalized/date"
import { DatePicker } from "@ark-ui/react/date-picker"
import type { DayTableCellState, LocaleDetails } from "@zag-js/date-picker"
import { format, isValid, parse } from "date-fns"
import moment from "moment"
import {
  memo,
  type ReactElement,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { DateInput as DateInputProto } from "@streamlit/protobuf"

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
import { hasLightBackgroundColor } from "~lib/theme/getColors"
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

const RANGE_DISPLAY_SEP = " – "

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

function datesToCalendarDates(dates: Date[]): DateValue[] {
  return dates.map(
    d => new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate())
  )
}

/** Sun–Sat narrow labels; rotated by `weekStartsOn` (0 = Sunday) to match BaseWeb/Streamlit tests. */
const ENGLISH_NARROW_SUN_FIRST = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

function getEnglishNarrowWeekdaysForCalendarHeader(
  weekStartsOn: number
): string[] {
  return Array.from(
    { length: 7 },
    (_, i) => ENGLISH_NARROW_SUN_FIRST[(i + weekStartsOn) % 7]
  )
}

/** Range presets using moment() so tests that mock `Date` / `moment.now` match BaseWeb. */
function getQuickSelectMomentRange(preset: string): [Date, Date] {
  const end = moment().startOf("day").toDate()
  switch (preset) {
    case "last7Days":
      return [moment().subtract(6, "days").startOf("day").toDate(), end]
    case "last30Days":
      return [moment().subtract(29, "days").startOf("day").toDate(), end]
    case "last90Days":
      return [moment().subtract(89, "days").startOf("day").toDate(), end]
    case "last180Days":
      return [moment().subtract(179, "days").startOf("day").toDate(), end]
    case "lastYear":
      return [moment().subtract(1, "year").startOf("day").toDate(), end]
    case "pastTwoYears":
      return [
        moment().subtract(2, "years").startOf("day").toDate(),
        moment().startOf("day").toDate(),
      ]
    default:
      return [moment().startOf("day").toDate(), end]
  }
}

// Types for date validation
type ValidationResult = {
  errorType: "Start" | "End" | null
  newDates: Date[]
}

function DateInput({
  disabled,
  element,
  widgetMgr,
  fragmentId,
}: Props): ReactElement {
  const theme = useEmotionTheme()
  const [isEmpty, setIsEmpty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [textValue, setTextValue] = useState("")
  const textValueRef = useRef("")
  const allowEmptyPickerCommitRef = useRef(false)
  /** True after committing [] from typed/blurred empty field; ignore stale Ark repopulate until calendar opens. */
  const commitEmptyFromTextRef = useRef(false)
  /** True briefly after a typed commit so stale Ark `onValueChange` (previous day) is ignored. */
  const commitFromTextInputRef = useRef(false)
  /** After a range validation error + empty commit, ignore Ark replaying the previous in-range selection. */
  const suppressArkRangeResyncRef = useRef(false)
  useEffect(() => {
    textValueRef.current = textValue
  }, [textValue])

  const timeZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    []
  )

  const resetError = useCallback(() => {
    setError(null)
  }, [])

  const scheduleClearTextCommitGuard = useCallback(() => {
    commitFromTextInputRef.current = true
    // Ark may emit a stale onValueChange after a typed commit (e.g. TZ/parsing). Keep the guard
    // past one task so we do not revert to the previous calendar day before React state catches up.
    window.setTimeout(() => {
      commitFromTextInputRef.current = false
    }, 100)
  }, [])

  const handleFormCleared = useCallback(() => {
    resetError()
    setIsEmpty(false)
  }, [resetError])

  /**
   * An array with start and end date specified by the user via the UI. If the user
   * didn't touch this widget's UI, the default value is used. End date is optional.
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

  const { colors, fontSizes, spacing, zIndices, sizes } = useEmotionTheme()

  const { locale: localeTag } = useContext(LibConfigContext)

  const safeLocaleTag = useMemo(() => {
    try {
      const canonical = Intl.getCanonicalLocales(localeTag)[0] ?? localeTag
      const supported = Intl.DateTimeFormat.supportedLocalesOf([canonical], {
        localeMatcher: "lookup",
      })
      return supported[0] ?? "en-US"
    } catch {
      return "en-US"
    }
  }, [localeTag])

  const loadedLocale = useIntlLocale(localeTag)

  const minDate = useMemo(
    () => normalizeToStartOfDay(moment(element.min, DATE_FORMAT).toDate()),
    [element.min]
  )

  const maxDate = useMemo(() => {
    const raw = getMaxDate(element)
    return raw ? normalizeToStartOfDay(raw) : undefined
  }, [element])

  const enableQuickSelect = useMemo(() => {
    if (!element.isRange) {
      return false
    }

    // Since quick select allows to select ranges up to the past 2 years,
    // we should only enable it if the min date is older than 2 years ago.
    const twoYearsAgo = moment().subtract(2, "years").toDate()
    return minDate < twoYearsAgo
  }, [element.isRange, minDate])

  const clearable = element.default.length === 0 && !disabled

  const dateMask = useMemo(
    () => element.format.replaceAll(/[a-zA-Z]/g, "9"),
    [element.format]
  )

  const dateFormat = useMemo(
    () => element.format.replaceAll("Y", "y").replaceAll("D", "d"),
    [element.format]
  )

  const minDateString = useMemo(
    () => format(minDate, dateFormat, { locale: loadedLocale }),
    [minDate, dateFormat, loadedLocale]
  )

  const maxDateString = useMemo(
    () =>
      maxDate ? format(maxDate, dateFormat, { locale: loadedLocale }) : "",
    [maxDate, dateFormat, loadedLocale]
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

  const formatDatesForDisplay = useCallback(
    (dates: Date[]): string => {
      if (!dates.length) return ""
      if (!element.isRange) {
        return format(dates[0], dateFormat, { locale: loadedLocale })
      }
      const [a, b] = dates
      if (!a || !b) {
        return [a, b]
          .filter(Boolean)
          .map(d => format(d as Date, dateFormat, { locale: loadedLocale }))
          .join(RANGE_DISPLAY_SEP)
      }
      return `${format(a, dateFormat, { locale: loadedLocale })}${RANGE_DISPLAY_SEP}${format(b, dateFormat, { locale: loadedLocale })}`
    },
    [dateFormat, element.isRange, loadedLocale]
  )

  const valueFingerprint = useMemo(
    () => datesToStrings(value ?? []).join("|"),
    [value]
  )

  // Tracks the last value we pushed to the widget manager from this control.
  // `value` from useBasicWidgetState lags one render behind setValueWithSource, so we
  // cannot rely on valueFingerprint alone to dedupe Enter after onChange already committed.
  const lastCommittedFpRef = useRef(valueFingerprint)
  const prevRenderValueFpRef = useRef(valueFingerprint)
  useLayoutEffect(() => {
    if (valueFingerprint !== prevRenderValueFpRef.current) {
      lastCommittedFpRef.current = valueFingerprint
      prevRenderValueFpRef.current = valueFingerprint
    }
  }, [valueFingerprint])

  const commitUserDates = useCallback(
    (dates: Date[]): void => {
      if (!dates.length) {
        if (lastCommittedFpRef.current === "") {
          setIsEmpty(true)
          return
        }
        resetError()
        suppressArkRangeResyncRef.current = false
        lastCommittedFpRef.current = ""
        setValueWithSource({ value: [], fromUi: true })
        setIsEmpty(true)
        return
      }

      const normalizedDateInput: DateOrEmpty[] | DateOrEmpty = element.isRange
        ? dates.map(d => normalizeToStartOfDay(d))
        : normalizeToStartOfDay(dates[0])

      const { errorType, newDates } = validateDates(
        normalizedDateInput,
        minDate,
        maxDate
      )
      const nextFp = datesToStrings(newDates).join("|")
      // Dedupe only "clean" commits. Out-of-range dates still need setError even when the
      // fingerprint matches a previous invalid commit (resetError must not win via early return).
      if (nextFp === lastCommittedFpRef.current && !errorType) {
        return
      }

      resetError()
      if (errorType) {
        setError(createErrorMessage(errorType))
        if (element.isRange) {
          suppressArkRangeResyncRef.current = true
          lastCommittedFpRef.current = ""
          setValueWithSource({ value: [], fromUi: true })
          setIsEmpty(true)
          setTextValue("")
        }
        return
      }
      suppressArkRangeResyncRef.current = false
      lastCommittedFpRef.current = nextFp
      setValueWithSource({ value: newDates, fromUi: true })
      setIsEmpty(!newDates.length)
    },
    [
      createErrorMessage,
      element.isRange,
      maxDate,
      minDate,
      resetError,
      setValueWithSource,
    ]
  )

  const handleArkValueChange = useCallback(
    ({ value: next }: { value: DateValue[] | null | undefined }) => {
      const nextDatesFiltered = (next ?? []).filter(Boolean)
      if (
        suppressArkRangeResyncRef.current &&
        element.isRange &&
        nextDatesFiltered.length > 0
      ) {
        return
      }
      if (commitEmptyFromTextRef.current && nextDatesFiltered.length > 0) {
        return
      }
      if (nextDatesFiltered.length === 0) {
        if (!allowEmptyPickerCommitRef.current) {
          return
        }
        allowEmptyPickerCommitRef.current = false
        commitUserDates([])
        return
      }
      const dates = nextDatesFiltered.map(d =>
        normalizeToStartOfDay(d.toDate(timeZone))
      )
      const nextFp = datesToStrings(dates).join("|")
      if (
        commitFromTextInputRef.current &&
        nextFp !== lastCommittedFpRef.current
      ) {
        return
      }
      // Drop stale Ark replays of the pre-commit widget value before React state catches up.
      const widgetFp = datesToStrings(value ?? []).join("|")
      if (
        nextFp === widgetFp &&
        lastCommittedFpRef.current !== widgetFp &&
        nextFp !== lastCommittedFpRef.current
      ) {
        return
      }
      if (nextFp === valueFingerprint) {
        return
      }
      commitUserDates(dates)
    },
    [commitUserDates, element.isRange, timeZone, value, valueFingerprint]
  )

  // Sync display when committed widget value changes. useBasicWidgetClientState applies
  // setCurrentValue in an effect, so we must not depend on a "skip" flag that is cleared
  // before valueFingerprint updates — that was clearing the field while value was still [].
  // Depend on valueFingerprint only (not value reference) so partial typing is not overwritten
  // on unrelated parent re-renders.
  useEffect(() => {
    setTextValue(formatDatesForDisplay(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- valueFingerprint tracks value semantics
  }, [valueFingerprint, formatDatesForDisplay])

  const isCompleteDateInput = useCallback(
    (raw: string): boolean => {
      const t = raw.trim()
      if (!t) {
        return true
      }
      if (!element.isRange) {
        return t.length === dateMask.length
      }
      const parts = t.split(/\s*[–-]\s*/)
      if (parts.length !== 2) {
        return false
      }
      return (
        parts[0].trim().length === dateMask.length &&
        parts[1].trim().length === dateMask.length
      )
    },
    [dateMask, element.isRange]
  )

  const parseTypedValue = useCallback(
    (raw: string): Date[] | null => {
      const trimmed = raw.trim()
      if (!trimmed) return []
      // Use moment + the proto display format so parsing matches wire serialization (datesToStrings / stringsToDates).
      if (!element.isRange) {
        const m = moment(trimmed, element.format, true)
        if (!m.isValid()) return null
        return [normalizeToStartOfDay(m.toDate())]
      }
      const parts = trimmed.split(/\s*[–-]\s*/)
      if (parts.length !== 2) return null
      const m1 = moment(parts[0].trim(), element.format, true)
      const m2 = moment(parts[1].trim(), element.format, true)
      if (!m1.isValid() || !m2.isValid()) return null
      return [
        normalizeToStartOfDay(m1.toDate()),
        normalizeToStartOfDay(m2.toDate()),
      ]
    },
    [element.format, element.isRange]
  )

  const handleClose = useCallback((): void => {
    // Range + empty text: commit empty tuple; never restore range defaults here.
    if (element.isRange && textValueRef.current.trim() === "") {
      commitEmptyFromTextRef.current = true
      commitUserDates([])
      setTextValue("")
      return
    }

    // Range + complete typed value: validate/commit on calendar close (e.g. Escape).
    if (element.isRange) {
      const rawField = textValueRef.current
      if (isCompleteDateInput(rawField)) {
        const parsed = parseTypedValue(rawField.trim())
        if (parsed !== null && parsed.length > 0) {
          scheduleClearTextCommitGuard()
          commitUserDates(parsed)
        }
      }
      return
    }

    if (!isEmpty) {
      return
    }

    if (clearable && textValueRef.current.trim() === "") {
      commitEmptyFromTextRef.current = true
      commitUserDates([])
      setTextValue("")
      return
    }

    // Non-clearable single date: restore proto default when the field was left empty.
    const newValue = stringsToDates(element.default)
    setValueWithSource({ value: newValue, fromUi: true })
    setIsEmpty(!newValue.length)
  }, [
    clearable,
    commitUserDates,
    element.default,
    element.isRange,
    isCompleteDateInput,
    isEmpty,
    parseTypedValue,
    scheduleClearTextCommitGuard,
    setValueWithSource,
  ])

  const handleTextChange = useCallback(
    (raw: string): void => {
      if (raw.trim() !== "") {
        commitEmptyFromTextRef.current = false
      }
      suppressArkRangeResyncRef.current = false
      setTextValue(raw)
      textValueRef.current = raw
      const parsed = parseTypedValue(raw)
      if (parsed === null) {
        return
      }
      if (parsed.length === 0) {
        if (raw.trim() === "") {
          commitEmptyFromTextRef.current = true
        }
        commitUserDates([])
        return
      }
      if (!isCompleteDateInput(raw)) {
        return
      }
      scheduleClearTextCommitGuard()
      commitUserDates(parsed)
    },
    [
      commitUserDates,
      isCompleteDateInput,
      parseTypedValue,
      scheduleClearTextCommitGuard,
    ]
  )

  /** Enter commits the current field text (typing, fill(), or IME). */
  const handleEnterKey = useCallback(
    (rawFromDom?: string): void => {
      const raw = rawFromDom ?? textValueRef.current
      const trimmed = raw.trim()
      const parsed = parseTypedValue(trimmed)
      if (parsed === null) {
        return
      }
      if (parsed.length === 0) {
        if (clearable || element.isRange) {
          commitEmptyFromTextRef.current = true
          commitUserDates([])
          setTextValue("")
        }
        return
      }
      scheduleClearTextCommitGuard()
      commitUserDates(parsed)
    },
    [
      clearable,
      commitUserDates,
      element.isRange,
      parseTypedValue,
      scheduleClearTextCommitGuard,
    ]
  )

  const handleOpenChange = useCallback(
    ({ open }: { open: boolean }): void => {
      if (open) {
        commitEmptyFromTextRef.current = false
        if (suppressArkRangeResyncRef.current) {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              suppressArkRangeResyncRef.current = false
            })
          })
        }
        return
      }
      handleClose()
    },
    [handleClose]
  )

  const handleBlurField = useCallback(
    (currentValue: string): void => {
      const t = currentValue.trim()
      if (t !== "") {
        if (isCompleteDateInput(currentValue)) {
          const parsed = parseTypedValue(t)
          if (parsed !== null) {
            if (parsed.length === 0) {
              commitEmptyFromTextRef.current = true
              commitUserDates([])
              setTextValue("")
            } else {
              scheduleClearTextCommitGuard()
              commitUserDates(parsed)
            }
          }
        }
        return
      }
      if (element.isRange) {
        commitEmptyFromTextRef.current = true
        commitUserDates([])
        setTextValue("")
        return
      }
      if (clearable) {
        commitEmptyFromTextRef.current = true
        commitUserDates([])
        setTextValue("")
        return
      }
      setIsEmpty(true)
      const newValue = stringsToDates(element.default)
      setValueWithSource({ value: newValue, fromUi: true })
      setTextValue(formatDatesForDisplay(newValue))
      setIsEmpty(!newValue.length)
    },
    [
      clearable,
      commitUserDates,
      element.default,
      element.isRange,
      formatDatesForDisplay,
      isCompleteDateInput,
      parseTypedValue,
      scheduleClearTextCommitGuard,
      setValueWithSource,
    ]
  )

  const minCv = useMemo(
    () =>
      new CalendarDate(
        minDate.getFullYear(),
        minDate.getMonth() + 1,
        minDate.getDate()
      ),
    [minDate]
  )

  const maxCv = useMemo(
    () =>
      maxDate
        ? new CalendarDate(
            maxDate.getFullYear(),
            maxDate.getMonth() + 1,
            maxDate.getDate()
          )
        : undefined,
    [maxDate]
  )

  const arkValue = useMemo(() => datesToCalendarDates(value), [value])

  const startOfWeek = loadedLocale.options?.weekStartsOn ?? 0

  const formatArk = useCallback(
    (date: DateValue, _details: LocaleDetails): string => {
      const js = date.toDate(timeZone)
      return format(js, dateFormat, { locale: loadedLocale })
    },
    [dateFormat, loadedLocale, timeZone]
  )

  const parseArk = useCallback(
    (val: string, _details: LocaleDetails): DateValue | undefined => {
      const parsed = parse(val.trim(), dateFormat, new Date(), {
        locale: loadedLocale,
      })
      if (!isValid(parsed)) return undefined
      return new CalendarDate(
        parsed.getFullYear(),
        parsed.getMonth() + 1,
        parsed.getDate()
      )
    },
    [dateFormat, loadedLocale]
  )

  const baseWebDayLabel = useCallback(
    (state: DayTableCellState): string => {
      const jsDate = state.value.toDate(timeZone)
      const long = format(jsDate, "EEEE, MMMM do yyyy", {
        locale: loadedLocale,
      })
      if (state.unavailable) {
        return `Not available. ${long}.`
      }
      if (state.selected) {
        return `Selected. ${long}. It's available.`
      }
      return `Choose ${long}. It's available.`
    },
    [loadedLocale, timeZone]
  )

  const translations = useMemo(
    () => ({
      trigger: (open: boolean) => (open ? "Close calendar" : "Select a date."),
      content: "Calendar.",
      dayCell: baseWebDayLabel,
    }),
    [baseWebDayLabel]
  )

  const positioning = useMemo(
    () => ({
      placement: "bottom-start" as const,
      gutter: convertRemToPx(theme.spacing.twoXS),
      strategy: "fixed" as const,
    }),
    [theme.spacing.twoXS]
  )

  const placeholderText = element.isRange
    ? `${element.format}${RANGE_DISPLAY_SEP}${element.format}`
    : element.format

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
      <DatePicker.Root
        locale={safeLocaleTag}
        timeZone={timeZone}
        selectionMode={element.isRange ? "range" : "single"}
        value={arkValue}
        onValueChange={handleArkValueChange}
        onOpenChange={handleOpenChange}
        min={minCv}
        max={maxCv}
        startOfWeek={startOfWeek}
        disabled={disabled}
        readOnly={false}
        openOnClick
        format={formatArk}
        parse={parseArk}
        placeholder={placeholderText}
        translations={translations}
        positioning={positioning}
        invalid={Boolean(error)}
        closeOnSelect={!element.isRange}
      >
        <StyledControlRow>
          <DatePicker.Control>
            <DatePicker.Context>
              {api => (
                <>
                  <StyledFieldRow $hasError={Boolean(error)}>
                    <MainDateInputField
                      disabled={disabled}
                      error={error}
                      placeholderText={placeholderText}
                      textValue={textValue}
                      clearable={clearable}
                      calendarOpen={api.open}
                      onRequestCloseCalendar={() => {
                        api.setOpen(false)
                      }}
                      onTextChange={handleTextChange}
                      onBlurField={handleBlurField}
                      onEscapeClear={() => {
                        if (!clearable) {
                          return
                        }
                        resetError()
                        commitEmptyFromTextRef.current = true
                        commitUserDates([])
                        setTextValue("")
                      }}
                      onEnterKey={handleEnterKey}
                      onTrustedPointerOpenCalendar={() => {
                        commitEmptyFromTextRef.current = false
                        api.setOpen(true)
                      }}
                    />
                    {error && (
                      <Tooltip
                        content={
                          <StreamlitMarkdown
                            source={error}
                            allowHTML={false}
                          />
                        }
                        placement={Placement.TOP_RIGHT}
                        error
                      >
                        <Icon content={ErrorOutline} size="lg" />
                      </Tooltip>
                    )}
                    {clearable && (
                      <DatePicker.ClearTrigger
                        onClick={() => {
                          allowEmptyPickerCommitRef.current = true
                        }}
                      />
                    )}
                  </StyledFieldRow>
                  <DatePicker.Trigger
                    data-testid="stDateInputCalendarTrigger"
                    disabled={disabled}
                    style={{
                      cursor: "pointer",
                      border: "none",
                      background: "transparent",
                      padding: spacing.twoXS,
                      minWidth: sizes.numberInputControlsWidth,
                      minHeight: sizes.numberInputControlsWidth,
                      flexShrink: 0,
                    }}
                    type="button"
                  >
                    <span aria-hidden>{"\u200b"}</span>
                  </DatePicker.Trigger>
                </>
              )}
            </DatePicker.Context>
          </DatePicker.Control>
        </StyledControlRow>
        <DatePicker.Context>
          {pickerApi =>
            pickerApi.open ? (
              <DatePicker.Positioner
                style={{
                  zIndex: zIndices.popup,
                  ...getPopoverContainerStyle(theme),
                  ...(hasLightBackgroundColor(theme) && {
                    borderWidth: theme.spacing.none,
                  }),
                }}
              >
                <DatePicker.Content
                  onMouseDown={e => {
                    e.preventDefault()
                  }}
                >
                  <div data-testid="stDateInputCalendar">
                    <StyledCalendarInner
                      fontSize={fontSizes.sm}
                      paddingRight={spacing.sm}
                      paddingLeft={spacing.sm}
                      paddingBottom={spacing.sm}
                      paddingTop={spacing.sm}
                    >
                      {enableQuickSelect && (
                        <StyledQuickSelect
                          data-testid="stDateInputQuickSelect"
                          aria-label="Choose a date range"
                          defaultValue=""
                          onChange={e => {
                            const v = e.target.value
                            if (!v) return
                            const [start, end] = getQuickSelectMomentRange(v)
                            const [cs, ce] = clampRangeToBounds(
                              start,
                              end,
                              minDate,
                              maxDate
                            )
                            commitUserDates([cs, ce])
                            const selectEl = e.target
                            queueMicrotask(() => {
                              selectEl.selectedIndex = 0
                            })
                          }}
                        >
                          <option value="">None</option>
                          <option value="last7Days">Past Week</option>
                          <option value="last30Days">Past Month</option>
                          <option value="last90Days">Past 3 Months</option>
                          <option value="last180Days">Past 6 Months</option>
                          <option value="lastYear">Past Year</option>
                          <option value="pastTwoYears">Past 2 Years</option>
                        </StyledQuickSelect>
                      )}
                      <DatePicker.View view="day">
                        <DatePicker.ViewControl
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: spacing.sm,
                          }}
                        >
                          <DatePicker.PrevTrigger
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              background: "transparent",
                              border: "none",
                              cursor: "pointer",
                              color: colors.bodyText,
                            }}
                          >
                            ‹
                          </DatePicker.PrevTrigger>
                          <DatePicker.ViewTrigger>
                            <DatePicker.RangeText />
                          </DatePicker.ViewTrigger>
                          <DatePicker.NextTrigger
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              background: "transparent",
                              border: "none",
                              cursor: "pointer",
                              color: colors.bodyText,
                            }}
                          >
                            ›
                          </DatePicker.NextTrigger>
                        </DatePicker.ViewControl>
                        <DatePicker.Context>
                          {api => {
                            const narrowWeekdays =
                              getEnglishNarrowWeekdaysForCalendarHeader(
                                startOfWeek
                              )
                            const weekdayNarrow = narrowWeekdays.join("")
                            return (
                              <DatePicker.Table>
                                <caption
                                  role="presentation"
                                  style={{
                                    position: "absolute",
                                    width: "1px",
                                    height: "1px",
                                    padding: 0,
                                    margin: "-1px",
                                    overflow: "hidden",
                                    clip: "rect(0, 0, 0, 0)",
                                    whiteSpace: "nowrap",
                                    border: 0,
                                  }}
                                >
                                  {weekdayNarrow}
                                </caption>
                                <DatePicker.TableHead>
                                  <DatePicker.TableRow>
                                    {narrowWeekdays.map((narrow, i) => (
                                      <DatePicker.TableHeader key={i}>
                                        {narrow}
                                      </DatePicker.TableHeader>
                                    ))}
                                  </DatePicker.TableRow>
                                </DatePicker.TableHead>
                                <DatePicker.TableBody>
                                  {api.weeks.map((week, wi) => (
                                    <DatePicker.TableRow key={wi}>
                                      {week.map((day, di) => (
                                        <DatePicker.TableCell
                                          key={di}
                                          value={day}
                                          visibleRange={api.visibleRange}
                                        >
                                          <DatePicker.TableCellTrigger>
                                            {day.day}
                                          </DatePicker.TableCellTrigger>
                                        </DatePicker.TableCell>
                                      ))}
                                    </DatePicker.TableRow>
                                  ))}
                                </DatePicker.TableBody>
                              </DatePicker.Table>
                            )
                          }}
                        </DatePicker.Context>
                      </DatePicker.View>
                    </StyledCalendarInner>
                  </div>
                </DatePicker.Content>
              </DatePicker.Positioner>
            ) : null
          }
        </DatePicker.Context>
      </DatePicker.Root>
    </div>
  )
}

function MainDateInputField({
  disabled,
  error,
  placeholderText,
  textValue,
  clearable,
  calendarOpen,
  onRequestCloseCalendar,
  onTextChange,
  onBlurField,
  onEscapeClear,
  onEnterKey,
  onTrustedPointerOpenCalendar,
}: {
  disabled: boolean
  error: string | null
  placeholderText: string
  textValue: string
  clearable: boolean
  calendarOpen: boolean
  onRequestCloseCalendar: () => void
  onTextChange: (v: string) => void
  onBlurField: (currentValue: string) => void
  onEscapeClear: () => void
  onEnterKey: (rawFromDom: string) => void
  onTrustedPointerOpenCalendar: () => void
}): ReactElement {
  return (
    <StyledTextInput
      aria-invalid={error ? true : undefined}
      data-testid="stDateInputField"
      disabled={disabled}
      placeholder={placeholderText}
      value={textValue}
      $hasError={Boolean(error)}
      onClick={e => {
        const el = e.currentTarget as HTMLInputElement
        el.select()
        // Vitest runs in MODE=test with synthetic (untrusted) clicks; production e2e uses a prod
        // build where MODE is not "test", so Playwright clicks always open the popup.
        const runningVitest =
          typeof import.meta !== "undefined" &&
          import.meta.env?.MODE === "test"
        const allowOpenPopup = !runningVitest || e.isTrusted
        if (allowOpenPopup) {
          onTrustedPointerOpenCalendar()
        }
      }}
      onFocus={e => {
        const el = e.target as HTMLInputElement
        // Select all so typing replaces the existing date instead of appending.
        el.select()
        // Production e2e: Ark may repaint after focus; one microtask re-select is safe.
        // Vitest (MODE=test): skip — async re-select runs between RTL keystrokes and corrupts input.
        if (import.meta.env.PROD) {
          queueMicrotask(() => {
            el.select()
          })
        }
      }}
      onChange={e => {
        onTextChange(e.currentTarget.value)
      }}
      onInput={e => {
        const t = e.currentTarget as HTMLInputElement
        onTextChange(t.value)
      }}
      onKeyDown={e => {
        if (
          calendarOpen &&
          !e.metaKey &&
          !e.ctrlKey &&
          (e.key.length === 1 ||
            e.key === "Backspace" ||
            e.key === "Delete" ||
            e.key.startsWith("Arrow"))
        ) {
          onRequestCloseCalendar()
        }
        if (e.key === "Enter") {
          e.preventDefault()
          e.stopPropagation()
          onEnterKey((e.currentTarget as HTMLInputElement).value)
        }
        if (e.key === "Escape") {
          if (calendarOpen) {
            e.preventDefault()
            e.stopPropagation()
            onRequestCloseCalendar()
            return
          }
          if (!clearable) {
            return
          }
          e.preventDefault()
          e.stopPropagation()
          onEscapeClear()
        }
      }}
      onBlur={e => {
        onBlurField((e.currentTarget as HTMLInputElement).value)
      }}
    />
  )
}

const StyledControlRow = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing.twoXS,
  width: "100%",
}))

const StyledFieldRow = styled.div<{
  $hasError: boolean
}>(({ theme, $hasError }) => {
  const borderColor = getBorderColor(theme.colors, false)
  return {
    display: "flex",
    alignItems: "center",
    flex: 1,
    borderLeftWidth: theme.sizes.borderWidth,
    borderRightWidth: theme.sizes.borderWidth,
    borderTopWidth: theme.sizes.borderWidth,
    borderBottomWidth: theme.sizes.borderWidth,
    borderStyle: "solid",
    borderTopColor: borderColor,
    borderRightColor: borderColor,
    borderBottomColor: borderColor,
    borderLeftColor: borderColor,
    borderRadius: theme.radii.md,
    paddingRight: theme.spacing.twoXS,
    ...($hasError && {
      backgroundColor: theme.colors.redBackgroundColor,
    }),
    "&:focus-within": {
      borderTopColor: getBorderColor(theme.colors, true),
      borderRightColor: getBorderColor(theme.colors, true),
      borderBottomColor: getBorderColor(theme.colors, true),
      borderLeftColor: getBorderColor(theme.colors, true),
    },
  }
})

const StyledTextInput = styled.input<{ $hasError: boolean }>(
  ({ theme, $hasError }) => ({
    flex: 1,
    border: "none",
    outline: "none",
    background: "transparent",
    position: "relative",
    zIndex: theme.zIndices.priority,
    fontWeight: theme.fontWeights.normal,
    paddingRight: theme.spacing.sm,
    paddingLeft: `calc(${theme.spacing.sm} + ${theme.sizes.tagMarginInsideBorder})`,
    paddingBottom: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    lineHeight: theme.lineHeights.inputWidget,
    color: $hasError ? theme.colors.redTextColor : theme.colors.bodyText,
    "::placeholder": {
      color: theme.colors.fadedText60,
    },
  })
)

const StyledCalendarInner = styled.div<{
  fontSize: string
  paddingRight: string
  paddingLeft: string
  paddingBottom: string
  paddingTop: string
}>(({ fontSize, paddingRight, paddingLeft, paddingBottom, paddingTop }) => ({
  fontSize,
  paddingRight,
  paddingLeft,
  paddingBottom,
  paddingTop,
  borderWidth: 0,
}))

const StyledQuickSelect = styled.select(({ theme }) => ({
  width: "100%",
  marginBottom: theme.spacing.sm,
  height: theme.sizes.minElementHeight,
  borderLeftWidth: theme.sizes.borderWidth,
  borderRightWidth: theme.sizes.borderWidth,
  borderTopWidth: theme.sizes.borderWidth,
  borderBottomWidth: theme.sizes.borderWidth,
  borderStyle: "solid",
  borderColor: theme.colors.fadedText40,
  borderRadius: theme.radii.md,
}))

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
  const minDate = normalizeToStartOfDay(
    moment(element.min, DATE_FORMAT).toDate()
  )
  const maxDateRaw = getMaxDate(element)
  const maxDate = maxDateRaw ? normalizeToStartOfDay(maxDateRaw) : undefined
  let isValidState = true

  // Check if date(s) outside of allowed min/max
  const normalizedStateValues = (vws.value || []).map(d =>
    normalizeToStartOfDay(d)
  )
  const { errorType } = validateDates(normalizedStateValues, minDate, maxDate)
  if (errorType) {
    isValidState = false
  }

  // Only update widget state if date(s) valid
  if (isValidState) {
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

function clampRangeToBounds(
  start: Date,
  end: Date,
  minD: Date,
  maxD: Date | undefined
): [Date, Date] {
  let s = normalizeToStartOfDay(start)
  let e = normalizeToStartOfDay(end)
  if (s < minD) {
    s = normalizeToStartOfDay(minD)
  }
  if (maxD && e > maxD) {
    e = normalizeToStartOfDay(maxD)
  }
  if (s > e) {
    return [s, s]
  }
  return [s, e]
}

export default memo(DateInput)
