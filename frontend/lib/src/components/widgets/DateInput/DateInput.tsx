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
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
  memo,
  ReactElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { DatePicker } from "@ark-ui/react/date-picker"
import type {
  IntlTranslations as ArkIntlTranslations,
  DatePickerValueChangeDetails,
} from "@ark-ui/react/date-picker"
import { Portal } from "@ark-ui/react/portal"
import styled from "@emotion/styled"
import { ErrorOutline } from "@emotion-icons/material-outlined"
import {
  CalendarDate,
  type DateValue,
  getLocalTimeZone,
} from "@internationalized/date"
import type { DayTableCellState } from "@zag-js/date-picker"
import type { DateRangePreset } from "@zag-js/date-utils"
import { format } from "date-fns"
import moment from "moment"

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

const RANGE_SEP = " – "

function normalizeLocaleTag(tag: string): string {
  try {
    const [canonical] = Intl.getCanonicalLocales(tag)
    return canonical ?? "en-US"
  } catch {
    return "en-US"
  }
}

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

// Types for date validation
type ValidationResult = {
  errorType: "Start" | "End" | null
  newDates: Date[]
}

function toCalendarDate(d: Date): CalendarDate {
  return new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

function dateValueToJs(dv: DateValue): Date {
  return normalizeToStartOfDay(dv.toDate(getLocalTimeZone()))
}

function datesToValueArray(dates: Date[]): DateValue[] {
  return dates.map(toCalendarDate)
}

/** True when the string is a full strict match for the moment format (e.g. YYYY/MM/DD). */
function isCompleteMomentDate(trimmed: string, momentFormat: string): boolean {
  const m = moment(trimmed, momentFormat, true)
  return m.isValid() && m.format(momentFormat) === trimmed
}

function buildDayCellTranslation(
  state: DayTableCellState,
  loadedLocale: import("date-fns").Locale
): string {
  const js = dateValueToJs(state.value)
  const longFmt = format(js, "EEEE, MMMM do yyyy", { locale: loadedLocale })
  if (state.unavailable || (state.invalid && !state.selectable)) {
    return `Not available. ${longFmt}.`
  }
  if (state.selected) {
    return `Selected. ${longFmt}. It's available.`
  }
  return `Choose ${longFmt}. It's available.`
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
  const [draftResetSeq, setDraftResetSeq] = useState(0)

  const resetError = useCallback(() => {
    setError(null)
  }, [])

  const handleFormCleared = useCallback(() => {
    resetError()
    setIsEmpty(false)
    setDraftResetSeq(s => s + 1)
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

  const { locale: localeTag } = useContext(LibConfigContext)
  const arkLocale = normalizeLocaleTag(localeTag)
  const loadedLocale = useIntlLocale(arkLocale)

  const minDate = useMemo(
    () => moment(element.min, DATE_FORMAT).toDate(),
    [element.min]
  )

  const maxDate = useMemo(() => getMaxDate(element), [element])

  const enableQuickSelect = useMemo(() => {
    if (!element.isRange) {
      return false
    }
    const twoYearsAgo = moment().subtract(2, "years").toDate()
    return minDate < twoYearsAgo
  }, [element.isRange, minDate])

  const clearable = element.default.length === 0 && !disabled

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

  const handleChange = useCallback(
    ({
      date,
    }: {
      date: Date | (Date | null | undefined)[] | null | undefined
    }): void => {
      resetError()

      if (isNullOrUndefined(date)) {
        setValueWithSource({ value: [], fromUi: true })
        setIsEmpty(true)
        return
      }

      const normalizedDateInput: DateOrEmpty[] | DateOrEmpty = Array.isArray(
        date
      )
        ? date
            .filter((d): d is Date => Boolean(d))
            .map(d => normalizeToStartOfDay(d))
        : normalizeToStartOfDay(date)

      const { errorType, newDates } = validateDates(
        normalizedDateInput,
        minDate,
        maxDate
      )
      if (errorType) {
        setError(createErrorMessage(errorType))
      }
      setValueWithSource({ value: newDates, fromUi: true })
      setIsEmpty(!newDates.length)
    },
    [
      createErrorMessage,
      maxDate,
      minDate,
      resetError,
      setError,
      setValueWithSource,
    ]
  )

  const handleClose = useCallback((): void => {
    if (!isEmpty) return

    // Range: a cleared field must stay empty (()) rather than snapping back to the
    // proto default range. Single-date widgets still reset to default when empty.
    if (element.isRange) {
      return
    }

    const newValue = stringsToDates(element.default)
    setValueWithSource({ value: newValue, fromUi: true })
    setIsEmpty(!newValue.length)
  }, [isEmpty, element, setValueWithSource])

  /** Commit an empty range from Escape without clearing validation error UI (e2e parity). */
  const commitEmptyRangeKeepError = useCallback((): void => {
    setValueWithSource({ value: [], fromUi: true })
    setIsEmpty(true)
  }, [setValueWithSource])

  const timeZone = getLocalTimeZone()
  const minCal = useMemo(() => toCalendarDate(minDate), [minDate])
  const maxCal = useMemo(
    () => (maxDate ? toCalendarDate(maxDate) : undefined),
    [maxDate]
  )

  const arkValue = useMemo(() => {
    const filtered = (value || []).filter(d => {
      const n = normalizeToStartOfDay(d)
      if (n < minDate) return false
      if (maxDate && n > maxDate) return false
      return true
    })
    return datesToValueArray(filtered)
  }, [value, minDate, maxDate])

  const startOfWeek = loadedLocale.options?.weekStartsOn ?? 0

  const translations = useMemo((): ArkIntlTranslations => {
    return {
      dayCell: (state: DayTableCellState) =>
        buildDayCellTranslation(state, loadedLocale),
      nextTrigger: v =>
        ({
          year: "Switch to next decade",
          month: "Switch to next year",
          day: "Switch to next month",
        })[v],
      monthSelect: "Select month",
      yearSelect: "Select year",
      viewTrigger: v =>
        ({
          year: "Switch to month view",
          month: "Switch to day view",
          day: "Switch to year view",
        })[v],
      prevTrigger: v =>
        ({
          year: "Switch to previous decade",
          month: "Switch to previous year",
          day: "Switch to previous month",
        })[v],
      presetTrigger: () => "",
      clearTrigger: "Clear selected dates",
      trigger: () => "Open calendar",
      content: "Calendar.",
      placeholder: () => ({ day: "dd", month: "mm", year: "yyyy" }),
      weekColumnHeader: "Wk",
      weekNumberCell: (weekNumber: number) => `Week ${weekNumber}`,
    }
  }, [loadedLocale])

  const formatArkDate = useCallback(
    (date: DateValue, _details: { locale: string; timeZone: string }) => {
      const js = date.toDate(timeZone)
      return format(js, dateFormat, { locale: loadedLocale })
    },
    [dateFormat, loadedLocale, timeZone]
  )

  const onValueChange = useCallback(
    (details: DatePickerValueChangeDetails) => {
      const dates = details.value
        .filter((v): v is DateValue => notNullOrUndefined(v))
        .map(v => dateValueToJs(v))

      if (element.isRange) {
        handleChange({ date: dates })
      } else {
        handleChange({ date: dates[0] ?? null })
      }
    },
    [element.isRange, handleChange]
  )

  const placeholderText = element.isRange
    ? `${element.format}${RANGE_SEP}${element.format}`
    : element.format

  const positioning = useMemo(
    () => ({
      placement: "bottom-start" as const,
      strategy: "fixed" as const,
      gutter: convertRemToPx(theme.spacing.twoXS),
    }),
    [theme.spacing.twoXS]
  )

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
        locale={arkLocale}
        selectionMode={element.isRange ? "range" : "single"}
        value={arkValue}
        onValueChange={onValueChange}
        min={minCal}
        max={maxCal}
        disabled={disabled}
        readOnly={false}
        timeZone={timeZone}
        startOfWeek={startOfWeek}
        translations={translations}
        format={formatArkDate}
        placeholder={placeholderText}
        openOnClick={false}
        closeOnSelect={!element.isRange}
        positioning={positioning}
        onOpenChange={({ open }) => {
          if (!open) {
            handleClose()
          }
        }}
      >
        <StyledControl>
          {element.isRange ? (
            <RangeTextField
              value={value}
              minDate={minDate}
              maxDate={maxDate}
              momentFormat={element.format}
              dateFormat={dateFormat}
              loadedLocale={loadedLocale}
              element={element}
              clearable={clearable}
              handleChange={handleChange}
              handleClose={handleClose}
              commitEmptyRangeKeepError={commitEmptyRangeKeepError}
              setIsEmpty={setIsEmpty}
              error={error}
              draftResetSeq={draftResetSeq}
            />
          ) : (
            <SingleTextField
              value={value}
              minDate={minDate}
              maxDate={maxDate}
              placeholder={element.format}
              momentFormat={element.format}
              dateFormat={dateFormat}
              loadedLocale={loadedLocale}
              clearable={clearable}
              handleChange={handleChange}
              handleClose={handleClose}
              setIsEmpty={setIsEmpty}
              error={error}
              draftResetSeq={draftResetSeq}
            />
          )}
          {error && (
            <Tooltip
              content={<StreamlitMarkdown source={error} allowHTML={false} />}
              placement={Placement.TOP_RIGHT}
              error
            >
              <Icon content={ErrorOutline} size="lg" />
            </Tooltip>
          )}
          {clearable && (
            <StyledClearTrigger type="button">×</StyledClearTrigger>
          )}
        </StyledControl>

        <Portal>
          <DatePicker.Positioner>
            <DatePicker.Context>
              {datePicker => (
                <StyledContent
                  data-testid={
                    datePicker.open ? "stDateInputCalendar" : undefined
                  }
                >
                  <>
                    {enableQuickSelect && (
                      <StyledQuickSelect
                        data-testid={
                          datePicker.open
                            ? "stDateInputQuickSelect"
                            : undefined
                        }
                        aria-label="Quick select date range"
                        defaultValue=""
                        onChange={e => {
                          const preset = e.target.value as DateRangePreset
                          if (!preset) return
                          const next = datePicker.getRangePresetValue(preset)
                          datePicker.setValue(next)
                          e.currentTarget.selectedIndex = 0
                        }}
                      >
                        <option value="" disabled>
                          Presets
                        </option>
                        <option value="last7Days">Past Week</option>
                      </StyledQuickSelect>
                    )}
                    <DatePicker.View view="day">
                      <StyledViewControl>
                        <DatePicker.PrevTrigger />
                        <DatePicker.ViewTrigger view="day">
                          <DatePicker.RangeText />
                        </DatePicker.ViewTrigger>
                        <DatePicker.NextTrigger />
                      </StyledViewControl>
                      <DatePicker.Table>
                        <DatePicker.TableHead>
                          <DatePicker.TableRow>
                            {datePicker.weekDays.map((day, i) => (
                              <DatePicker.TableHeader key={i}>
                                {day.short}
                              </DatePicker.TableHeader>
                            ))}
                          </DatePicker.TableRow>
                        </DatePicker.TableHead>
                        <DatePicker.TableBody>
                          {datePicker.weeks.map((week, weekIdx) => (
                            <DatePicker.TableRow key={weekIdx}>
                              {week.map((day, dayIdx) => (
                                <DatePicker.TableCell key={dayIdx} value={day}>
                                  <DatePicker.TableCellTrigger />
                                </DatePicker.TableCell>
                              ))}
                            </DatePicker.TableRow>
                          ))}
                        </DatePicker.TableBody>
                      </DatePicker.Table>
                    </DatePicker.View>
                  </>
                </StyledContent>
              )}
            </DatePicker.Context>
          </DatePicker.Positioner>
        </Portal>
      </DatePicker.Root>
    </div>
  )
}

function SingleTextField({
  value,
  minDate: _minDate,
  maxDate: _maxDate,
  placeholder,
  momentFormat,
  dateFormat,
  loadedLocale,
  clearable,
  handleChange,
  handleClose,
  setIsEmpty,
  error,
  draftResetSeq,
}: {
  value: Date[]
  minDate: Date
  maxDate: Date | undefined
  placeholder: string
  momentFormat: string
  dateFormat: string
  loadedLocale: import("date-fns").Locale
  clearable: boolean
  handleChange: (args: {
    date: Date | (Date | null | undefined)[] | null | undefined
  }) => void
  handleClose: () => void
  setIsEmpty: (v: boolean) => void
  error: string | null
  draftResetSeq: number
}): ReactElement {
  const [draft, setDraft] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const lastNativeValueRef = useRef<string>("")
  /** Latest commit fn for native `change` (Playwright `fill`) — defined inside Context render. */
  const commitSingleIfDistinctRef = useRef<(raw: string) => void>(() => {})

  const valueSyncKey = useMemo(
    () =>
      value.length === 0
        ? ""
        : String(normalizeToStartOfDay(value[0]).getTime()),
    [value]
  )

  useEffect(() => {
    setDraft(null)
  }, [valueSyncKey])

  useEffect(() => {
    setDraft(null)
  }, [draftResetSeq])

  useEffect(() => {
    const el = inputRef.current
    if (!el) {
      return
    }
    // Playwright `fill()` and some native paths update the DOM without React seeing a
    // synthetic change event. Keep `draft` in sync so the controlled value does not
    // overwrite the DOM before Enter/blur commits.
    const syncNative = (): void => {
      const v = el.value
      lastNativeValueRef.current = v
      setDraft(v)
      if (v === "") {
        setIsEmpty(true)
      }
    }
    const tryCommitNative = (): void => {
      // Playwright `fill()` can dispatch `input` without a reliable `change` for
      // controlled inputs. Per-keystroke typing is handled by React `onChange`.
      commitSingleIfDistinctRef.current(lastNativeValueRef.current)
    }
    const onNativeInput = (_ev: Event): void => {
      syncNative()
      // Playwright `fill()` often dispatches `input` without `insertReplacementText`;
      // still commit when the field becomes a complete date (distinct from widget value).
      tryCommitNative()
    }
    const onNativeChange = (): void => {
      syncNative()
      tryCommitNative()
    }
    el.addEventListener("input", onNativeInput, { capture: true })
    el.addEventListener("change", onNativeChange, { capture: true })
    // Avoid syncNative() on attach — stale DOM after form-clear can overwrite `draft`.
    lastNativeValueRef.current = el.value
    return () => {
      el.removeEventListener("input", onNativeInput, { capture: true })
      el.removeEventListener("change", onNativeChange, { capture: true })
    }
  }, [valueSyncKey, draftResetSeq])

  return (
    <DatePicker.Context>
      {dp => {
        const fromState = value[0]
          ? format(normalizeToStartOfDay(value[0]), dateFormat, {
              locale: loadedLocale,
            })
          : ""
        const shown = draft ?? fromState

        const commitSingle = (raw: string): void => {
          const trimmed = raw.trim()
          if (!trimmed) {
            return
          }
          if (!isCompleteMomentDate(trimmed, momentFormat)) {
            return
          }
          const m = moment(trimmed, momentFormat, true)
          const d = normalizeToStartOfDay(m.toDate())
          handleChange({ date: d })
        }

        /** Used for Enter/blur so fill()+Enter does not commit twice (same parsed date). */
        const commitSingleIfDistinct = (raw: string): void => {
          const trimmed = raw.trim()
          if (!trimmed) {
            return
          }
          if (!isCompleteMomentDate(trimmed, momentFormat)) {
            return
          }
          const m = moment(trimmed, momentFormat, true)
          const d = normalizeToStartOfDay(m.toDate())
          if (
            value.length > 0 &&
            normalizeToStartOfDay(value[0]).getTime() === d.getTime()
          ) {
            return
          }
          handleChange({ date: d })
        }
        commitSingleIfDistinctRef.current = commitSingleIfDistinct

        const handleInputChangeLike = (
          e: ChangeEvent<HTMLInputElement>
        ): void => {
          const v = e.currentTarget.value
          setDraft(v)
          if (v === "") {
            setIsEmpty(true)
          }
          commitSingle(v)
        }

        const handleDateFieldFocus = (
          e: FocusEvent<HTMLInputElement>
        ): void => {
          // Select-all on focus when a date is committed so typing/fill replaces the
          // whole value (e2e: dynamic date input `fill` must not append). For an empty
          // field, avoid select-all so segmented typing still works.
          if (value.length === 0) {
            return
          }
          e.currentTarget.select()
        }

        const handleInputKeyDown = (
          e: KeyboardEvent<HTMLInputElement>
        ): void => {
          if (e.key === "Enter" || e.key === "NumpadEnter") {
            e.preventDefault()
            e.stopPropagation()
            const el = e.currentTarget
            // After Playwright `fill()`, React can reconcile the controlled `value` prop and
            // revert the DOM before keydown; `lastNativeValueRef` is updated in capture phase
            // on input/change and stays authoritative.
            const v = lastNativeValueRef.current ?? el.value
            commitSingleIfDistinct(v)
            el.blur()
            return
          }
          if (e.key === "Escape") {
            e.preventDefault()
            e.stopPropagation()
            dp.setOpen(false)
            if (clearable) {
              setDraft(null)
              handleChange({ date: null })
            }
          }
        }

        return (
          <StyledRangeInput
            ref={inputRef}
            $hasError={Boolean(error)}
            data-testid="stDateInputField"
            disabled={dp.disabled}
            aria-label="Select a date."
            value={shown}
            placeholder={placeholder}
            onClick={() => {
              dp.setOpen(true)
              requestAnimationFrame(() => {
                inputRef.current?.select()
              })
            }}
            onFocus={handleDateFieldFocus}
            onChange={handleInputChangeLike}
            onBlur={e => {
              const raw = e.currentTarget.value
              setDraft(null)
              const trimmed = raw.trim()
              if (!trimmed) {
                handleChange({ date: null })
                handleClose()
                return
              }
              commitSingleIfDistinct(raw)
            }}
            onKeyDown={handleInputKeyDown}
          />
        )
      }}
    </DatePicker.Context>
  )
}

function RangeTextField({
  value,
  minDate: _minDate,
  maxDate: _maxDate,
  momentFormat,
  dateFormat,
  loadedLocale,
  element,
  clearable,
  handleChange,
  handleClose,
  commitEmptyRangeKeepError,
  setIsEmpty,
  error,
  draftResetSeq,
}: {
  value: Date[]
  minDate: Date
  maxDate: Date | undefined
  momentFormat: string
  dateFormat: string
  loadedLocale: import("date-fns").Locale
  element: DateInputProto
  clearable: boolean
  handleChange: (args: {
    date: Date | (Date | null | undefined)[] | null | undefined
  }) => void
  handleClose: () => void
  commitEmptyRangeKeepError: () => void
  setIsEmpty: (v: boolean) => void
  error: string | null
  draftResetSeq: number
}): ReactElement {
  const [draft, setDraft] = useState<string | null>(null)
  const rangeInputRef = useRef<HTMLInputElement>(null)
  const lastNativeRangeValueRef = useRef<string>("")
  const commitRangeRef = useRef<(raw: string) => void>(() => {})

  const valueSyncKey = useMemo(
    () => value.map(d => String(normalizeToStartOfDay(d).getTime())).join("|"),
    [value]
  )

  useEffect(() => {
    setDraft(null)
  }, [valueSyncKey])

  useEffect(() => {
    setDraft(null)
  }, [draftResetSeq])

  useEffect(() => {
    const el = rangeInputRef.current
    if (!el) {
      return
    }
    const syncNative = (): void => {
      const v = el.value
      lastNativeRangeValueRef.current = v
      setDraft(v)
    }
    const tryCommitRangeNative = (): void => {
      commitRangeRef.current(lastNativeRangeValueRef.current)
    }
    const onNativeInput = (_ev: Event): void => {
      syncNative()
      tryCommitRangeNative()
    }
    const onNativeChange = (): void => {
      syncNative()
      tryCommitRangeNative()
    }
    el.addEventListener("input", onNativeInput, { capture: true })
    el.addEventListener("change", onNativeChange, { capture: true })
    lastNativeRangeValueRef.current = el.value
    return () => {
      el.removeEventListener("input", onNativeInput, { capture: true })
      el.removeEventListener("change", onNativeChange, { capture: true })
    }
  }, [valueSyncKey, draftResetSeq])

  return (
    <DatePicker.Context>
      {dp => {
        const fromState =
          value.length >= 2
            ? `${format(normalizeToStartOfDay(value[0]), dateFormat, {
                locale: loadedLocale,
              })}${RANGE_SEP}${format(
                normalizeToStartOfDay(value[1]),
                dateFormat,
                {
                  locale: loadedLocale,
                }
              )}`
            : value.length === 1
              ? format(normalizeToStartOfDay(value[0]), dateFormat, {
                  locale: loadedLocale,
                })
              : ""

        const shown = draft ?? fromState

        const commitRange = (raw: string): void => {
          const trimmed = raw.trim()
          if (!trimmed) {
            return
          }
          const parts = trimmed.split(/\s*[–-]\s*/)
          if (parts.length < 2) {
            return
          }
          const p0 = parts[0].trim()
          const p1 = parts[1].trim()
          if (
            !isCompleteMomentDate(p0, momentFormat) ||
            !isCompleteMomentDate(p1, momentFormat)
          ) {
            return
          }
          const d0 = normalizeToStartOfDay(
            moment(p0, momentFormat, true).toDate()
          )
          const d1 = normalizeToStartOfDay(
            moment(p1, momentFormat, true).toDate()
          )
          handleChange({ date: [d0, d1] })
        }
        commitRangeRef.current = commitRange

        const handleRangeInputChangeLike = (
          e: ChangeEvent<HTMLInputElement>
        ): void => {
          const v = e.currentTarget.value
          setDraft(v)
          if (v === "") {
            setIsEmpty(true)
          }
          commitRange(v)
        }

        const handleRangeDateFieldFocus = (
          e: FocusEvent<HTMLInputElement>
        ): void => {
          if (value.length === 0) {
            return
          }
          e.currentTarget.select()
        }

        const handleRangeKeyDown = (
          e: KeyboardEvent<HTMLInputElement>
        ): void => {
          if (e.key === "Enter" || e.key === "NumpadEnter") {
            e.preventDefault()
            e.stopPropagation()
            const el = e.currentTarget
            const v = lastNativeRangeValueRef.current
            commitRange(v)
            el.blur()
            return
          }
          if (e.key === "Escape") {
            e.preventDefault()
            e.stopPropagation()
            dp.setOpen(false)
            if (clearable) {
              setDraft(null)
              handleChange({ date: null })
            } else if (error) {
              setDraft(null)
              commitEmptyRangeKeepError()
            }
          }
        }

        return (
          <StyledRangeInput
            ref={rangeInputRef}
            $hasError={Boolean(error)}
            data-testid="stDateInputField"
            disabled={dp.disabled}
            aria-label="Select a date."
            value={shown}
            placeholder={`${element.format}${RANGE_SEP}${element.format}`}
            onClick={() => {
              dp.setOpen(true)
              requestAnimationFrame(() => {
                rangeInputRef.current?.select()
              })
            }}
            onFocus={handleRangeDateFieldFocus}
            onChange={handleRangeInputChangeLike}
            onBlur={e => {
              const raw = e.currentTarget.value
              setDraft(null)
              const trimmed = raw.trim()
              if (!trimmed) {
                handleChange({ date: null })
                handleClose()
                return
              }
              commitRange(raw)
            }}
            onKeyDown={handleRangeKeyDown}
          />
        )
      }}
    </DatePicker.Context>
  )
}

const StyledControl = styled(DatePicker.Control)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  flexDirection: "row",
  position: "relative",
  width: "100%",
  paddingRight: theme.spacing.twoXS,
}))

const StyledRangeInput = styled("input", {
  shouldForwardProp: p => p !== "$hasError",
})<{ $hasError: boolean }>(({ theme, $hasError }) => {
  const { colors, fontWeights, lineHeights, sizes, spacing, zIndices } = theme
  const unfocused = getBorderColor(colors, false)
  const focused = getBorderColor(colors, true)
  return {
    flex: 1,
    position: "relative",
    zIndex: zIndices.priority,
    fontWeight: fontWeights.normal,
    borderLeftWidth: sizes.borderWidth,
    borderRightWidth: sizes.borderWidth,
    borderTopWidth: sizes.borderWidth,
    borderBottomWidth: sizes.borderWidth,
    borderStyle: "solid",
    borderTopColor: unfocused,
    borderRightColor: unfocused,
    borderBottomColor: unfocused,
    borderLeftColor: unfocused,
    paddingRight: spacing.sm,
    paddingLeft: `calc(${spacing.sm} + ${sizes.tagMarginInsideBorder})`,
    paddingBottom: spacing.sm,
    paddingTop: spacing.sm,
    lineHeight: lineHeights.inputWidget,
    backgroundColor: colors.widgetBackgroundColor,
    "::placeholder": { color: colors.fadedText60 },
    "&:focus": {
      borderTopColor: focused,
      borderRightColor: focused,
      borderBottomColor: focused,
      borderLeftColor: focused,
      outline: 0,
    },
    ...($hasError && {
      color: colors.redTextColor,
      backgroundColor: colors.redBackgroundColor,
    }),
  }
})

const StyledClearTrigger = styled(DatePicker.ClearTrigger)(({ theme }) => ({
  color: theme.colors.grayTextColor,
  padding: theme.spacing.threeXS,
  height: theme.sizes.clearIconSize,
  width: theme.sizes.clearIconSize,
  lineHeight: 1,
  border: "none",
  background: "transparent",
  cursor: "pointer",
  ":hover": {
    color: theme.colors.bodyText,
  },
}))

const StyledContent = styled(DatePicker.Content)(({ theme }) => ({
  ...getPopoverContainerStyle(theme),
  ...(hasLightBackgroundColor(theme) && {
    borderWidth: theme.spacing.none,
  }),
  fontSize: theme.fontSizes.sm,
  padding: theme.spacing.sm,
}))

const StyledQuickSelect = styled("select")(({ theme }) => ({
  width: "100%",
  height: theme.sizes.minElementHeight,
  marginBottom: theme.spacing.sm,
  borderLeftWidth: theme.sizes.borderWidth,
  borderRightWidth: theme.sizes.borderWidth,
  borderTopWidth: theme.sizes.borderWidth,
  borderBottomWidth: theme.sizes.borderWidth,
}))

const StyledViewControl = styled(DatePicker.ViewControl)({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: "0.5rem",
})

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
