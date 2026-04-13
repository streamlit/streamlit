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
import {
  FloatingFocusManager,
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  shift,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from "@floating-ui/react"
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns"
import type { Locale as DateFnsLocale } from "date-fns"
import {
  memo,
  ReactElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react"

import moment from "moment"

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

const RANGE_SEP_DISPLAY = " – "

/** Convert an array of strings to an array of dates. */
function stringsToDates(strings: string[]): Date[] {
  return strings.map(val => {
    const m = moment(val, DATE_FORMAT, true)
    if (m.isValid()) {
      return normalizeToStartOfDay(new Date(m.year(), m.month(), m.date()))
    }
    return normalizeToStartOfDay(moment(val, DATE_FORMAT).toDate())
  })
}

/** Convert an array of dates to an array of strings. */
function datesToStrings(dates: Date[]): string[] {
  if (!dates) {
    return []
  }
  return dates.map(value => {
    const y = value.getFullYear()
    const mo = value.getMonth() + 1
    const d = value.getDate()
    return `${String(y).padStart(4, "0")}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`
  })
}

// Types for date validation
type ValidationResult = {
  errorType: "Start" | "End" | null
  newDates: Date[]
}

/** BaseWeb-style day cell aria (English labels + localized date phrase). */
function buildDayAriaLabel(
  day: Date,
  opts: {
    disabled: boolean
    selected: boolean
    localeForFormat: DateFnsLocale
  }
): string {
  const datePhrase = format(day, "EEEE, MMMM do yyyy", {
    locale: opts.localeForFormat,
  })
  if (opts.disabled) {
    return `Not available. ${datePhrase}. `
  }
  if (opts.selected) {
    return `Selected. ${datePhrase}. It's available.`
  }
  return `Choose ${datePhrase}. It's available.`
}

function formatValueForInput(
  dates: Date[],
  elementFormat: string,
  isRange: boolean
): string {
  if (!dates?.length) {
    return ""
  }
  if (!isRange) {
    return moment(dates[0]).format(elementFormat)
  }
  const a = dates[0] ? moment(dates[0]).format(elementFormat) : ""
  const b = dates[1] ? moment(dates[1]).format(elementFormat) : ""
  if (!a && !b) {
    return ""
  }
  return `${a}${RANGE_SEP_DISPLAY}${b}`
}

function tryParseInputToDates(
  raw: string,
  elementFormat: string,
  isRange: boolean
): Date[] | null {
  const trimmed = raw.trim()
  if (!trimmed) {
    return []
  }
  if (!isRange) {
    const d = moment(trimmed, elementFormat, true)
    return d.isValid()
      ? [normalizeToStartOfDay(new Date(d.year(), d.month(), d.date()))]
      : null
  }
  const parts = trimmed.split(/\s*[–-]\s*/)
  if (parts.length !== 2) {
    return null
  }
  const d0 = moment(parts[0].trim(), elementFormat, true)
  const d1 = moment(parts[1].trim(), elementFormat, true)
  if (!d0.isValid() || !d1.isValid()) {
    return null
  }
  const a = normalizeToStartOfDay(new Date(d0.year(), d0.month(), d0.date()))
  const b = normalizeToStartOfDay(new Date(d1.year(), d1.month(), d1.date()))
  return a <= b ? [a, b] : [b, a]
}

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
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()))
  const [highlightedDay, setHighlightedDay] = useState<Date | null>(null)
  const [rangeAnchor, setRangeAnchor] = useState<Date | null>(null)
  const [inputFocused, setInputFocused] = useState(false)
  const [draftInput, setDraftInput] = useState("")
  const [quickMenuOpen, setQuickMenuOpen] = useState(false)

  const resetError = useCallback(() => {
    setError(null)
  }, [])

  const handleFormCleared = useCallback(() => {
    resetError()
    setIsEmpty(false)
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

  const { locale } = useContext(LibConfigContext)
  const loadedLocale = useIntlLocale(locale)

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
      if (!errorType) {
        return null
      }

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
    if (!isEmpty) {
      return
    }

    const newValue = stringsToDates(element.default)
    setValueWithSource({ value: newValue, fromUi: true })
    setIsEmpty(!newValue.length)
  }, [isEmpty, element, setValueWithSource])

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: nextOpen => {
      setOpen(nextOpen)
      if (!nextOpen) {
        inputRef.current?.focus()
        handleClose()
      }
    },
    placement: "bottom-start",
    strategy: "fixed",
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(convertRemToPx(theme.spacing.twoXS)),
      flip({
        boundary: isInSidebar ? document.documentElement : undefined,
      }),
      shift({ padding: 8 }),
    ],
  })

  const dismiss = useDismiss(context, {
    outsidePress: true,
    escapeKey: true,
  })
  const role = useRole(context, { role: "dialog" })

  const { getFloatingProps } = useInteractions([dismiss, role])

  const inputId = useId()

  useEffect(() => {
    if (value.length && value[0]) {
      setViewMonth(startOfMonth(value[0]))
    }
  }, [value])

  useEffect(() => {
    if (open && value[0]) {
      setHighlightedDay(normalizeToStartOfDay(value[0]))
    } else if (open) {
      setHighlightedDay(normalizeToStartOfDay(viewMonth))
    }
  }, [open, value, viewMonth])

  const commitParsed = useCallback(
    (parsed: Date[] | null) => {
      if (parsed === null) {
        return
      }
      handleChange({ date: parsed.length ? parsed : null })
    },
    [handleChange]
  )

  const committedInput = useMemo(
    () => formatValueForInput(value, element.format, element.isRange),
    [value, element.format, element.isRange]
  )

  useEffect(() => {
    setDraftInput(committedInput)
  }, [committedInput])

  const setReferenceMerged = useCallback(
    (node: HTMLInputElement | null) => {
      inputRef.current = node
      refs.setReference(node)
    },
    [refs]
  )

  const onInputChange = useCallback(
    (ev: React.ChangeEvent<HTMLInputElement>) => {
      const raw = String(ev.target.value ?? "")
      setDraftInput(raw)
      if (raw === "") {
        handleChange({ date: null })
        return
      }
      const parsed = tryParseInputToDates(raw, element.format, element.isRange)
      if (parsed !== null) {
        commitParsed(parsed)
      }
    },
    [commitParsed, element.format, element.isRange, handleChange]
  )

  const onInputBlur = useCallback(() => {
    setInputFocused(false)
    const raw = String(inputRef.current?.value ?? "")
    if (raw === "") {
      // Single date: snap back to default when the field is cleared (BaseWeb parity).
      // Range: keep an empty range; resetting here would restore element.default dates.
      if (!element.isRange) {
        handleClose()
      }
    } else {
      setDraftInput(committedInput)
    }
  }, [committedInput, element.isRange, handleClose])

  const onCalendarKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!highlightedDay) {
        return
      }
      if (e.key === "Escape") {
        setOpen(false)
        inputRef.current?.focus()
        e.preventDefault()
        return
      }
      if (e.key === "Enter") {
        if (element.isRange) {
          if (!rangeAnchor) {
            setRangeAnchor(highlightedDay)
            handleChange({
              date: [normalizeToStartOfDay(highlightedDay)],
            })
          } else {
            const start = rangeAnchor
            const end = highlightedDay
            const lo = isBefore(start, end) ? start : end
            const hi = isAfter(start, end) ? start : end
            handleChange({ date: [lo, hi] })
            setRangeAnchor(null)
            setOpen(false)
            inputRef.current?.focus()
          }
        } else {
          handleChange({ date: normalizeToStartOfDay(highlightedDay) })
          setOpen(false)
          inputRef.current?.focus()
        }
        e.preventDefault()
        return
      }
      let next = highlightedDay
      if (e.key === "ArrowRight") {
        next = addDays(highlightedDay, 1)
      } else if (e.key === "ArrowLeft") {
        next = addDays(highlightedDay, -1)
      } else if (e.key === "ArrowDown") {
        next = addDays(highlightedDay, 7)
      } else if (e.key === "ArrowUp") {
        next = addDays(highlightedDay, -7)
      } else {
        return
      }
      e.preventDefault()
      setHighlightedDay(next)
      if (!isSameMonth(next, viewMonth)) {
        setViewMonth(startOfMonth(next))
      }
    },
    [
      element.isRange,
      handleChange,
      highlightedDay,
      loadedLocale.options?.weekStartsOn,
      rangeAnchor,
      viewMonth,
    ]
  )

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(viewMonth)
    const monthEnd = endOfMonth(viewMonth)
    const gridStart = startOfWeek(monthStart, {
      weekStartsOn: loadedLocale.options?.weekStartsOn as
        | 0
        | 1
        | 2
        | 3
        | 4
        | 5
        | 6,
    })
    const gridEnd = endOfWeek(monthEnd, {
      weekStartsOn: loadedLocale.options?.weekStartsOn as
        | 0
        | 1
        | 2
        | 3
        | 4
        | 5
        | 6,
    })
    return eachDayOfInterval({ start: gridStart, end: gridEnd })
  }, [viewMonth, loadedLocale.options?.weekStartsOn])

  const weekdayLabels = useMemo(() => {
    const refMonday = new Date(2024, 0, 8)
    const start = startOfWeek(refMonday, {
      weekStartsOn: loadedLocale.options?.weekStartsOn as
        | 0
        | 1
        | 2
        | 3
        | 4
        | 5
        | 6,
    })
    return Array.from({ length: 7 }, (_, i) => {
      const label = format(addDays(start, i), "EEE", {
        locale: loadedLocale,
      })
      return label.replace(/\./g, "").slice(0, 2)
    })
  }, [loadedLocale])

  useEffect(() => {
    if (open) {
      setRangeAnchor(null)
    }
  }, [open])

  const isDayDisabled = useCallback(
    (d: Date): boolean => {
      const day = normalizeToStartOfDay(d)
      if (day < normalizeToStartOfDay(minDate)) {
        return true
      }
      if (maxDate && day > normalizeToStartOfDay(maxDate)) {
        return true
      }
      return false
    },
    [maxDate, minDate]
  )

  const isDaySelected = useCallback(
    (d: Date): boolean => {
      if (!element.isRange) {
        return value.length > 0 && isSameDay(d, value[0])
      }
      if (value.length >= 2 && value[0] && value[1]) {
        const lo = normalizeToStartOfDay(value[0])
        const hi = normalizeToStartOfDay(value[1])
        const day = normalizeToStartOfDay(d)
        return (isSameDay(day, lo) || isSameDay(day, hi)) && !isDayDisabled(d)
      }
      return value.length > 0 && value[0] && isSameDay(d, value[0])
    },
    [element.isRange, isDayDisabled, value]
  )

  const inRangeHighlight = useCallback(
    (d: Date): boolean => {
      if (!element.isRange || value.length < 2 || !value[0] || !value[1]) {
        return false
      }
      const lo = normalizeToStartOfDay(value[0])
      const hi = normalizeToStartOfDay(value[1])
      const day = normalizeToStartOfDay(d)
      return !isDayDisabled(d) && day >= lo && day <= hi
    },
    [element.isRange, isDayDisabled, value]
  )

  const quickSelectOptions = useMemo(() => {
    const NOW = moment()
      .hours(12)
      .minutes(0)
      .seconds(0)
      .milliseconds(0)
      .toDate()
    return [
      { id: "Past Week", begin: moment(NOW).subtract(1, "week").toDate() },
      { id: "Past Month", begin: moment(NOW).subtract(1, "month").toDate() },
      {
        id: "Past 3 Months",
        begin: moment(NOW).subtract(3, "month").toDate(),
      },
      {
        id: "Past 6 Months",
        begin: moment(NOW).subtract(6, "month").toDate(),
      },
      { id: "Past Year", begin: moment(NOW).subtract(1, "year").toDate() },
      { id: "Past 2 Years", begin: moment(NOW).subtract(2, "year").toDate() },
    ]
  }, [])

  const displayValue = inputFocused ? draftInput : committedInput

  const popoverStyle = useMemo(
    () => ({
      ...getPopoverContainerStyle(theme),
      ...(hasLightBackgroundColor(theme) && {
        borderWidth: theme.spacing.none,
      }),
    }),
    [theme]
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

      <InputRoot>
        <StyledInputContainer
          $hasError={Boolean(error)}
          $isFocused={open}
          theme={theme}
        >
          <StyledInputWrapper>
            <StyledNativeInput
              ref={setReferenceMerged}
              id={inputId}
              data-testid="stDateInputField"
              aria-label={
                element.isRange ? "Select a date range." : "Select a date."
              }
              $hasError={Boolean(error)}
              disabled={disabled}
              value={displayValue}
              placeholder={
                element.isRange
                  ? `${element.format}${RANGE_SEP_DISPLAY}${element.format}`
                  : element.format
              }
              onChange={onInputChange}
              onBlur={onInputBlur}
              onClick={() => {
                if (!disabled) {
                  setOpen(true)
                }
              }}
              onFocus={e => {
                setInputFocused(true)
                setDraftInput(committedInput)
                try {
                  e.currentTarget.select()
                } catch {
                  // select() unsupported for some input modes
                }
              }}
              onKeyDown={e => {
                if (e.key === "ArrowDown" && !disabled) {
                  setOpen(true)
                }
                if (e.key === "Escape") {
                  if (open) {
                    setOpen(false)
                    e.preventDefault()
                    return
                  }
                  if (
                    clearable &&
                    !disabled &&
                    (value.length > 0 || displayValue)
                  ) {
                    e.preventDefault()
                    handleChange({ date: null })
                  }
                }
              }}
            />
          </StyledInputWrapper>
          {error && (
            <EndEnhancer>
              <Tooltip
                content={
                  <StreamlitMarkdown source={error} allowHTML={false} />
                }
                placement={Placement.TOP_RIGHT}
                error
              >
                <Icon content={ErrorOutline} size="lg" />
              </Tooltip>
            </EndEnhancer>
          )}
          {clearable && displayValue && !disabled && (
            <ClearButton
              type="button"
              aria-label="Clear"
              onClick={() => handleChange({ date: null })}
            >
              ×
            </ClearButton>
          )}
        </StyledInputContainer>
      </InputRoot>

      {open && (
        <FloatingPortal>
          <FloatingFocusManager
            context={context}
            modal={false}
            initialFocus={-1}
          >
            <CalendarPopover
              ref={refs.setFloating}
              style={{ ...floatingStyles, zIndex: theme.zIndices.popup }}
              {...getFloatingProps()}
            >
              <CalendarPanel
                data-testid="stDateInputCalendar"
                role="application"
                aria-label="Calendar."
                tabIndex={-1}
                onKeyDown={onCalendarKeyDown}
                style={popoverStyle}
              >
                <NavRow>
                  <NavButton
                    type="button"
                    aria-label="Previous month."
                    onClick={() => setViewMonth(m => addMonths(m, -1))}
                  >
                    ‹
                  </NavButton>
                  <MonthTitle>
                    {format(viewMonth, "MMMM yyyy", { locale: loadedLocale })}
                  </MonthTitle>
                  <NavButton
                    type="button"
                    aria-label="Next month."
                    onClick={() => setViewMonth(m => addMonths(m, 1))}
                  >
                    ›
                  </NavButton>
                </NavRow>

                <WeekdayPresentation role="presentation">
                  {weekdayLabels.map((w, i) => (
                    <span key={i}>{w}</span>
                  ))}
                </WeekdayPresentation>

                <DayGrid role="grid">
                  {calendarDays.map(day => {
                    const outside = !isSameMonth(day, viewMonth)
                    const dis = isDayDisabled(day)
                    const sel = isDaySelected(day)
                    const inRange = inRangeHighlight(day)
                    const label = buildDayAriaLabel(day, {
                      disabled: dis,
                      selected: sel,
                      localeForFormat: loadedLocale,
                    })
                    return (
                      <DayCell
                        key={day.toISOString()}
                        role="gridcell"
                        aria-label={outside ? undefined : label}
                        tabIndex={
                          highlightedDay && isSameDay(day, highlightedDay)
                            ? 0
                            : -1
                        }
                        $outside={outside}
                        $disabled={dis}
                        $selected={sel}
                        $inRange={inRange}
                        $pseudoSelected={inRange && !sel}
                        onClick={() => {
                          if (dis || outside) {
                            return
                          }
                          if (element.isRange) {
                            if (!rangeAnchor) {
                              setRangeAnchor(day)
                              handleChange({
                                date: [normalizeToStartOfDay(day)],
                              })
                            } else {
                              const a = rangeAnchor
                              const lo = isBefore(a, day) ? a : day
                              const hi = isAfter(a, day) ? a : day
                              handleChange({
                                date: [
                                  normalizeToStartOfDay(lo),
                                  normalizeToStartOfDay(hi),
                                ],
                              })
                              setRangeAnchor(null)
                              setOpen(false)
                              inputRef.current?.focus()
                            }
                          } else {
                            handleChange({ date: normalizeToStartOfDay(day) })
                            setOpen(false)
                            inputRef.current?.focus()
                          }
                        }}
                        onMouseEnter={() => {
                          if (!dis && !outside) {
                            setHighlightedDay(day)
                          }
                        }}
                      >
                        <DayNum>{format(day, "d")}</DayNum>
                      </DayCell>
                    )
                  })}
                </DayGrid>

                {enableQuickSelect && (
                  <QuickSelectRow>
                    <QuickSelectLabel id={`${inputId}-qsl`}>
                      Choose a date range
                    </QuickSelectLabel>
                    <QuickSelectComboboxWrap data-testid="stDateInputQuickSelect">
                      <QuickSelectComboButton
                        type="button"
                        id={`${inputId}-qs`}
                        aria-label="Choose a date range"
                        role="combobox"
                        aria-expanded={quickMenuOpen}
                        aria-haspopup="listbox"
                        aria-labelledby={`${inputId}-qsl`}
                        onClick={() => setQuickMenuOpen(o => !o)}
                      >
                        None
                      </QuickSelectComboButton>
                      {quickMenuOpen && (
                        <QuickSelectListbox
                          role="listbox"
                          aria-label="Choose a date range"
                        >
                          {quickSelectOptions.map(o => (
                            <QuickSelectOption
                              key={o.id}
                              type="button"
                              role="option"
                              onClick={() => {
                                const end = normalizeToStartOfDay(new Date())
                                const start = normalizeToStartOfDay(o.begin)
                                handleChange({ date: [start, end] })
                                setQuickMenuOpen(false)
                              }}
                            >
                              {o.id}
                            </QuickSelectOption>
                          ))}
                        </QuickSelectListbox>
                      )}
                    </QuickSelectComboboxWrap>
                  </QuickSelectRow>
                )}
              </CalendarPanel>
            </CalendarPopover>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </div>
  )
}

const InputRoot = styled.div({
  width: "100%",
})

const StyledInputContainer = styled.div<{
  $hasError: boolean
  $isFocused: boolean
  theme: ReturnType<typeof useEmotionTheme>
}>(({ $hasError, $isFocused, theme }) => {
  const borderColor = getBorderColor(theme.colors, $isFocused)
  return {
    display: "flex",
    alignItems: "center",
    flexDirection: "row",
    borderLeftWidth: theme.sizes.borderWidth,
    borderRightWidth: theme.sizes.borderWidth,
    borderTopWidth: theme.sizes.borderWidth,
    borderBottomWidth: theme.sizes.borderWidth,
    borderStyle: "solid",
    borderTopColor: borderColor,
    borderRightColor: borderColor,
    borderBottomColor: borderColor,
    borderLeftColor: borderColor,
    borderRadius: theme.radii.default,
    paddingRight: theme.spacing.twoXS,
    backgroundColor: $hasError ? theme.colors.redBackgroundColor : undefined,
  }
})

const StyledInputWrapper = styled.div({
  flex: 1,
  minWidth: 0,
  backgroundColor: "transparent",
})

const StyledNativeInput = styled.input<{ $hasError: boolean }>(
  ({ theme, $hasError }) => ({
    width: "100%",
    border: "none",
    outline: "none",
    background: "transparent",
    boxSizing: "border-box",
    position: "relative",
    zIndex: theme.zIndices.priority,
    fontWeight: theme.fontWeights.normal,
    paddingRight: theme.spacing.sm,
    paddingLeft: `calc(${theme.spacing.sm} + ${theme.sizes.tagMarginInsideBorder})`,
    paddingBottom: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    lineHeight: theme.lineHeights.inputWidget,
    fontSize: theme.fontSizes.md,
    color: $hasError ? theme.colors.redTextColor : "inherit",
    "::placeholder": {
      color: theme.colors.fadedText60,
    },
  })
)

const EndEnhancer = styled.div(({ theme }) => ({
  color: theme.colors.redTextColor,
  backgroundColor: theme.colors.transparent,
  display: "flex",
  alignItems: "center",
}))

const ClearButton = styled.button(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: "none",
  background: "transparent",
  cursor: "pointer",
  color: theme.colors.grayTextColor,
  padding: theme.spacing.threeXS,
  height: theme.sizes.clearIconSize,
  width: theme.sizes.clearIconSize,
  lineHeight: 1,
  "&:hover": {
    color: theme.colors.bodyText,
  },
}))

const CalendarPopover = styled.div({})

const CalendarPanel = styled.div(({ theme }) => ({
  fontSize: theme.fontSizes.sm,
  paddingRight: theme.spacing.sm,
  paddingLeft: theme.spacing.sm,
  paddingBottom: theme.spacing.sm,
  paddingTop: theme.spacing.sm,
  borderWidth: theme.spacing.none,
  minWidth: "260px",
}))

const QuickSelectRow = styled.div(({ theme }) => ({
  marginTop: theme.spacing.sm,
  marginBottom: theme.spacing.sm,
}))

const QuickSelectLabel = styled.label(({ theme }) => ({
  display: "block",
  marginBottom: theme.spacing.threeXS,
}))

const QuickSelectComboboxWrap = styled.div({
  position: "relative",
  width: "100%",
})

const QuickSelectComboButton = styled.button(({ theme }) => ({
  width: "100%",
  height: theme.sizes.minElementHeight,
  textAlign: "left",
  cursor: "pointer",
  borderLeftWidth: theme.sizes.borderWidth,
  borderRightWidth: theme.sizes.borderWidth,
  borderTopWidth: theme.sizes.borderWidth,
  borderBottomWidth: theme.sizes.borderWidth,
  borderStyle: "solid",
  borderColor: theme.colors.widgetBorderColor ?? theme.colors.secondaryBg,
  backgroundColor: theme.colors.secondaryBg ?? theme.colors.bgColor,
  borderRadius: theme.radii.default,
  paddingLeft: theme.spacing.sm,
  paddingRight: theme.spacing.sm,
}))

const QuickSelectListbox = styled.div(({ theme }) => ({
  position: "absolute",
  left: 0,
  right: 0,
  top: "100%",
  zIndex: 1,
  marginTop: theme.spacing.threeXS,
  maxHeight: "200px",
  overflowY: "auto",
  backgroundColor: theme.colors.bgColor,
  borderWidth: theme.sizes.borderWidth,
  borderStyle: "solid",
  borderColor: theme.colors.borderColor,
  borderRadius: theme.radii.default,
  boxShadow: theme.shadows.popover,
}))

const QuickSelectOption = styled.button(({ theme }) => ({
  display: "block",
  width: "100%",
  textAlign: "left",
  border: "none",
  background: "transparent",
  cursor: "pointer",
  padding: theme.spacing.sm,
  fontSize: theme.fontSizes.sm,
  ":hover": {
    backgroundColor: theme.colors.darkenedBgMix15,
  },
}))

const NavRow = styled.div({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 8,
})

const NavButton = styled.button(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: "none",
  background: "transparent",
  cursor: "pointer",
  fontSize: theme.fontSizes.lg,
  ":active": { backgroundColor: theme.colors.transparent },
  ":focus": {
    backgroundColor: theme.colors.transparent,
    outline: 0,
  },
}))

const MonthTitle = styled.div({
  fontWeight: 600,
  textAlign: "center",
  flex: 1,
})

const WeekdayPresentation = styled.div({
  display: "flex",
  flexDirection: "row",
  justifyContent: "space-between",
  marginBottom: 4,
})

const DayGrid = styled.div({
  display: "grid",
  gridTemplateColumns: "repeat(7, 1fr)",
  gap: 2,
})

const DayNum = styled.span({
  position: "relative",
  zIndex: 1,
})

const DayCell = styled.div<{
  $outside: boolean
  $disabled: boolean
  $selected: boolean
  $inRange: boolean
  $pseudoSelected: boolean
}>(({ theme, $outside, $disabled, $selected, $inRange, $pseudoSelected }) => ({
  position: "relative",
  fontSize: theme.fontSizes.sm,
  lineHeight: theme.lineHeights.base,
  textAlign: "center",
  padding: 4,
  cursor: $disabled || $outside ? "default" : "pointer",
  opacity: $outside ? 0.35 : 1,
  color: $selected
    ? theme.colors.bodyText
    : hasLightBackgroundColor(theme) && $pseudoSelected && !$selected
      ? theme.colors.secondaryBg
      : undefined,
  "::before": {
    content: '""',
    position: "absolute",
    inset: 0,
    borderRadius: theme.radii.full,
    zIndex: 0,
    backgroundColor:
      $selected || $inRange || $pseudoSelected
        ? `${theme.colors.darkenedBgMix15} !important`
        : theme.colors.transparent,
  },
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
