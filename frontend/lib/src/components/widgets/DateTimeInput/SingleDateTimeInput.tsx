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
  ClipboardEvent,
  FocusEvent,
  KeyboardEvent,
  memo,
  MouseEvent,
  ReactElement,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react"

import { ErrorOutline } from "@emotion-icons/material-outlined"
import { Cancel } from "@emotion-icons/material-rounded"
import { FloatingPortal } from "@floating-ui/react"
import { CalendarDate, CalendarDateTime } from "@internationalized/date"
import {
  CalendarGridBody,
  CalendarGridHeader,
  DateField,
  I18nProvider,
} from "react-aria-components"

import { FLOATING_OVERLAY_PORTAL_ID } from "~lib/components/core/Portal/constants"
import Icon from "~lib/components/shared/Icon/Icon"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown/StreamlitMarkdown"
import Tooltip, { Placement } from "~lib/components/shared/Tooltip/Tooltip"
import { CalendarPopoverHeader } from "~lib/components/widgets/DateInput/CalendarPopoverHeader"
import { getSafeLocale } from "~lib/components/widgets/DateInput/dateInputUtils"
import { ReorderedSegments } from "~lib/components/widgets/DateInput/ReorderedSegments"
import {
  StyledCalendarCell,
  StyledCalendarGrid,
  StyledCalendarHeaderCell,
  StyledCalendarPopover,
  StyledCalendarRoot,
  StyledClearButton,
  StyledDateField,
  StyledDateFieldContainer,
  StyledDateInputWrapper,
  StyledErrorIconContainer,
  StyledTrailingIcons,
  StyledVisuallyHidden,
} from "~lib/components/widgets/DateInput/styled-components"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import {
  SHIFT_VIEWPORT_PADDING,
  useFloatingOverlay,
} from "~lib/hooks/useFloatingOverlay"
import { useOverlayDismissal } from "~lib/hooks/useOverlayDismissal"
import { convertRemToPx } from "~lib/theme/utils"
import { isNullOrUndefined } from "~lib/util/utils"

import {
  dateTimesEqual,
  getSegmentState,
  parsePastedDateTime,
  validateDateTime,
} from "./dateTimeInputUtils"

interface SingleDateTimeInputProps {
  value: CalendarDateTime | null
  onChange: (value: CalendarDateTime | null) => void
  minDateTime: CalendarDateTime | null
  maxDateTime: CalendarDateTime | null
  format: string
  step: number
  disabled: boolean
  clearable: boolean
  label: string
  error: string | null
  locale: string
  isInSidebar: boolean
  focusedValue: CalendarDate
  onFocusChange: (value: CalendarDate) => void
  onValidate: (dt: CalendarDateTime | null) => void
  onClose: (shouldClearError: boolean) => void
  formCommit?: (value: CalendarDateTime | null) => void
  /** When inside a form with enter_to_submit=True, submits the form.
   * Called after formCommit on Enter key. */
  formSubmit?: () => void
  formResetKey: number
}

function SingleDateTimeInput({
  value,
  onChange,
  minDateTime,
  maxDateTime,
  format,
  step,
  disabled,
  clearable,
  label,
  error,
  locale,
  isInSidebar,
  focusedValue,
  onFocusChange,
  onValidate,
  onClose,
  formCommit,
  formSubmit,
  formResetKey,
}: SingleDateTimeInputProps): ReactElement {
  const theme = useEmotionTheme()
  const id = useId()
  const errorId = `${id}-error`
  const popoverId = `${id}-calendar`
  const popoverDescId = `${id}-calendar-desc`
  const triggerRef = useRef<HTMLDivElement | null>(null)
  const clearButtonRef = useRef<HTMLButtonElement | null>(null)
  const safeLocale = useMemo(() => getSafeLocale(locale), [locale])
  const isRestoringFocusRef = useRef(false)
  const skipCloseCommitRef = useRef(false)

  const [isCalendarActive, setIsCalendarActive] = useState(false)
  const isCalendarActiveRef = useRef(false)
  isCalendarActiveRef.current = isCalendarActive
  const activeOriginRef = useRef<HTMLElement | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)

  const stepMins = step / 60

  // --- Two-layer state ---
  const [displayValue, setDisplayValue] = useState<CalendarDateTime | null>(
    value
  )

  const [prevValue, setPrevValue] = useState(value)
  if (prevValue !== value) {
    setPrevValue(value)
    setDisplayValue(value)
  }

  const [prevResetKey, setPrevResetKey] = useState(formResetKey)
  if (prevResetKey !== formResetKey) {
    setPrevResetKey(formResetKey)
    setDisplayValue(value)
  }

  const displayValueRef = useRef(displayValue)
  displayValueRef.current = displayValue

  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const formCommitRef = useRef(formCommit)
  formCommitRef.current = formCommit

  const [isOpen, setIsOpen] = useState(false)

  // Close-detection effect: handles commit/revert when popover closes.
  const wasOpenRef = useRef(isOpen)
  useEffect(() => {
    if (wasOpenRef.current && !isOpen) {
      if (skipCloseCommitRef.current) {
        skipCloseCommitRef.current = false
      } else if (triggerRef.current) {
        const { isPartiallyTyped, isFullyCleared } = getSegmentState(
          triggerRef.current
        )

        if (isPartiallyTyped || (isFullyCleared && !clearable)) {
          setDisplayValue(value)
          onCloseRef.current(true)
        } else {
          const pending = isFullyCleared ? null : displayValueRef.current
          const isOutOfBounds = !!validateDateTime(
            pending,
            minDateTime,
            maxDateTime
          )

          if (isOutOfBounds) {
            setDisplayValue(value)
            onCloseRef.current(true)
          } else if (!dateTimesEqual(pending, value)) {
            onChangeRef.current(pending)
            formCommitRef.current?.(pending)
          }
        }
      }
    }
    wasOpenRef.current = isOpen
  }, [isOpen, value, clearable, minDateTime, maxDateTime])

  // Focus active calendar cell on active mode entry.
  useEffect(() => {
    if (!isCalendarActive || !isOpen) return
    const rafId = requestAnimationFrame(() => {
      const cell = popoverRef.current?.querySelector<HTMLElement>(
        '[role="grid"] [tabindex="0"]'
      )
      cell?.focus()
    })
    return () => cancelAnimationFrame(rafId)
  }, [isCalendarActive, isOpen])

  const overlayOptions = useMemo(() => {
    const base = {
      open: isOpen,
      placement: "bottom-start" as const,
      offsetPx: convertRemToPx(theme.spacing.twoXS),
    }
    if (!isInSidebar || typeof document === "undefined") {
      return base
    }
    const boundary = document.documentElement
    return {
      ...base,
      flipOptions: { boundary },
      shiftOptions: { boundary, padding: SHIFT_VIEWPORT_PADDING },
    }
  }, [isOpen, theme.spacing.twoXS, isInSidebar])

  const { refs, floatingStyles } = useFloatingOverlay(overlayOptions)

  const restoreFocusToField = useCallback((): void => {
    isRestoringFocusRef.current = true
    if (isCalendarActiveRef.current && activeOriginRef.current) {
      activeOriginRef.current.focus()
    } else {
      const segments = triggerRef.current?.querySelectorAll<HTMLElement>(
        '[role="spinbutton"]'
      )
      const lastSegment = segments?.[segments.length - 1]
      if (lastSegment) {
        lastSegment.focus()
      } else {
        triggerRef.current?.focus()
      }
    }
    requestAnimationFrame(() => {
      isRestoringFocusRef.current = false
    })
  }, [])

  const { setFloatingRef: setDismissalFloatingRef, setReferenceRef } =
    useOverlayDismissal({
      isOpen,
      onClose: () => {
        setIsOpen(false)
        setIsCalendarActive(false)
        // Synchronous form commit: outside-click dismiss can race form submit
        // (the close-commit effect fires after paint). Mirrors handleBlur.
        if (formCommitRef.current && triggerRef.current) {
          const { isPartiallyTyped, isFullyCleared } = getSegmentState(
            triggerRef.current
          )
          if (isPartiallyTyped || (isFullyCleared && !clearable)) {
            // Will revert on next render — don't commit stale/invalid state.
          } else {
            const pending = isFullyCleared ? null : displayValueRef.current
            if (validateDateTime(pending, minDateTime, maxDateTime)) {
              // Out of bounds — close-detection effect will revert.
            } else if (!dateTimesEqual(pending, value)) {
              formCommitRef.current(pending)
            }
          }
        }
      },
      floatingSetFn: refs.setFloating,
      referenceSetFn: refs.setReference,
      restoreFocusFn: restoreFocusToField,
      // Exclude the month/year picker popover so Escape closes it first, not the whole calendar.
      excludeSelectors: ['[data-testid="stDateInputHeaderPickerPopover"]'],
      excludeEscape: true,
    })

  const setFloatingRef = useCallback(
    (node: HTMLDivElement | null): void => {
      popoverRef.current = node
      setDismissalFloatingRef(node)
    },
    [setDismissalFloatingRef]
  )

  const setTriggerRef = useCallback(
    (node: HTMLDivElement | null): void => {
      triggerRef.current = node
      setReferenceRef(node)
    },
    [setReferenceRef]
  )

  // Segment typing: buffer locally, sync calendar month, show real-time errors.
  const handleFieldChange = useCallback(
    (date: CalendarDateTime | null): void => {
      setDisplayValue(date)
      onValidate(date)
      if (date) {
        onFocusChange(new CalendarDate(date.year, date.month, date.day))
      }
    },
    [onFocusChange, onValidate]
  )

  // Calendar date selection: merge with existing time, commit immediately, close.
  // Clamps time to valid range when the selected date is on a boundary.
  const handleCalendarChange = useCallback(
    (date: CalendarDate): void => {
      const currentTime = displayValueRef.current
      let hour = currentTime?.hour ?? 0
      let minute = currentTime?.minute ?? 0

      // Clamp time when on the min boundary date
      if (
        minDateTime &&
        date.compare(
          new CalendarDate(
            minDateTime.year,
            minDateTime.month,
            minDateTime.day
          )
        ) === 0
      ) {
        const currentMins = hour * 60 + minute
        const minMins = minDateTime.hour * 60 + minDateTime.minute
        if (currentMins < minMins) {
          hour = minDateTime.hour
          minute = minDateTime.minute
        }
      }

      // Clamp time when on the max boundary date
      if (
        maxDateTime &&
        date.compare(
          new CalendarDate(
            maxDateTime.year,
            maxDateTime.month,
            maxDateTime.day
          )
        ) === 0
      ) {
        const currentMins = hour * 60 + minute
        const maxMins = maxDateTime.hour * 60 + maxDateTime.minute
        if (currentMins > maxMins) {
          hour = maxDateTime.hour
          minute = maxDateTime.minute
        }
      }

      const merged = new CalendarDateTime(
        date.year,
        date.month,
        date.day,
        hour,
        minute
      )
      setDisplayValue(merged)
      onChange(merged)
      skipCloseCommitRef.current = true
      setIsOpen(false)
      restoreFocusToField()
      setIsCalendarActive(false)
    },
    [onChange, restoreFocusToField, minDateTime, maxDateTime]
  )

  const handleFocus = useCallback((): void => {
    if (isRestoringFocusRef.current) return
    if (!disabled) setIsOpen(true)
  }, [disabled])

  const handleClickCapture = useCallback(
    (e: MouseEvent<HTMLDivElement>): void => {
      if (clearButtonRef.current?.contains(e.target as Node)) return
      setIsCalendarActive(false)
      handleFocus()
    },
    [handleFocus]
  )

  const handleClear = useCallback((): void => {
    setDisplayValue(null)
    onChange(null)
  }, [onChange])

  // Custom paste handler: ISO datetime or display-format datetime.
  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLDivElement>): void => {
      if (disabled) return
      const text = e.clipboardData.getData("text").trim()

      const fullDateTime = parsePastedDateTime(text, format)
      if (fullDateTime) {
        e.preventDefault()
        setDisplayValue(fullDateTime)
        onChange(fullDateTime)
        return
      }

      // For partial segment paste, let RAC handle it (no custom partial for datetime)
    },
    [disabled, format, onChange]
  )

  // Capture-phase keydown: step-aware time arrows, Alt+ArrowDown, Tab closing, Enter commit.
  const handleFieldKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>): void => {
      if (e.altKey && e.key === "ArrowDown") {
        e.preventDefault()
        activeOriginRef.current = e.target as HTMLElement
        if (!isOpen) setIsOpen(true)
        setIsCalendarActive(true)
        return
      }

      if (e.key === "Enter") {
        e.preventDefault()
        if (!triggerRef.current) return
        const { isPartiallyTyped, isFullyCleared } = getSegmentState(
          triggerRef.current
        )
        if (isPartiallyTyped || (isFullyCleared && !clearable)) return

        const pending = isFullyCleared ? null : displayValueRef.current
        if (validateDateTime(pending, minDateTime, maxDateTime)) {
          setDisplayValue(value)
          onCloseRef.current(true)
          return
        }
        if (!dateTimesEqual(pending, value)) {
          onChangeRef.current(pending)
          formCommitRef.current?.(pending)
        } else {
          formCommitRef.current?.(pending)
        }
        if (!error) {
          formSubmit?.()
        }
        return
      }

      // Step-aware arrow keys for time segments.
      // TODO: Steps not divisible by 60 (e.g. step=90) fall through to default
      // 1-minute increments — pre-existing behavior. Will be addressed with
      // seconds granularity and hour cycle support, consistent with TimeInput.
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        const target = e.target as HTMLElement
        const segmentType = target.getAttribute("data-type")
        const up = e.key === "ArrowUp"

        if (segmentType === "minute" && step % 60 === 0) {
          if (!Number.isInteger(stepMins) || stepMins <= 1) return
          if (!displayValue) return

          e.preventDefault()
          e.stopPropagation()
          e.nativeEvent.stopImmediatePropagation()

          const totalMins = displayValue.hour * 60 + displayValue.minute
          const next = up
            ? Math.floor(totalMins / stepMins) * stepMins + stepMins
            : Math.ceil(totalMins / stepMins) * stepMins - stepMins
          const wrapped =
            next >= 1440
              ? 0
              : next < 0
                ? Math.floor(1439 / stepMins) * stepMins
                : next
          const newDt = displayValue.set({
            hour: Math.floor(wrapped / 60),
            minute: wrapped % 60,
          })
          setDisplayValue(newDt)
          onValidate(newDt)
        } else if (segmentType === "hour" && step % 3600 === 0) {
          const stepHours = step / 3600
          if (!Number.isInteger(stepHours) || stepHours <= 1) return
          if (!displayValue) return

          e.preventDefault()
          e.stopPropagation()
          e.nativeEvent.stopImmediatePropagation()

          const next = up
            ? Math.floor(displayValue.hour / stepHours) * stepHours + stepHours
            : Math.ceil(displayValue.hour / stepHours) * stepHours - stepHours
          const wrapped =
            next >= 24
              ? 0
              : next < 0
                ? Math.floor(23 / stepHours) * stepHours
                : next
          const newDt = displayValue.set({ hour: wrapped, minute: 0 })
          setDisplayValue(newDt)
          onValidate(newDt)
        }
        return
      }

      if (e.key !== "Tab" || !isOpen) return
      const wrapper = triggerRef.current
      if (!wrapper) return
      const segments = wrapper.querySelectorAll<HTMLElement>(
        '[role="spinbutton"]'
      )
      const isLeavingField =
        (!e.shiftKey && e.target === segments[segments.length - 1]) ||
        (e.shiftKey && e.target === segments[0])
      if (isLeavingField) {
        setIsOpen(false)
      }
    },
    [
      isOpen,
      value,
      displayValue,
      clearable,
      error,
      formSubmit,
      minDateTime,
      maxDateTime,
      step,
      stepMins,
      onValidate,
    ]
  )

  // Active mode: Tab cycles within popover. Passive: Tab closes.
  const handleCalendarKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>): void => {
      if (e.key !== "Tab") return
      e.preventDefault()

      if (!isCalendarActiveRef.current) {
        setIsOpen(false)
        restoreFocusToField()
        return
      }

      const popover = popoverRef.current
      if (!popover) return

      const focusables = Array.from(
        popover.querySelectorAll<HTMLElement>(
          'button:not([tabindex="-1"]):not([disabled]), [tabindex="0"]'
        )
      )

      if (focusables.length === 0) return

      const currentIndex = focusables.indexOf(
        document.activeElement as HTMLElement
      )
      let nextIndex: number
      if (e.shiftKey) {
        nextIndex =
          currentIndex <= 0 ? focusables.length - 1 : currentIndex - 1
      } else {
        nextIndex =
          currentIndex >= focusables.length - 1 ? 0 : currentIndex + 1
      }
      focusables[nextIndex].focus()
    },
    [restoreFocusToField]
  )

  // Commit on blur (always, not just in forms — lesson from #16460).
  const handleBlur = useCallback(
    (e: FocusEvent<HTMLDivElement>): void => {
      if (e.currentTarget.contains(e.relatedTarget)) return
      if (isCalendarActiveRef.current) return
      if (triggerRef.current) {
        const { isPartiallyTyped, isFullyCleared } = getSegmentState(
          triggerRef.current
        )
        if (isPartiallyTyped) return
        if (isFullyCleared && !clearable) return
      }
      const pending = displayValueRef.current
      if (dateTimesEqual(pending, value)) return
      if (validateDateTime(pending, minDateTime, maxDateTime)) {
        setDisplayValue(value)
        onCloseRef.current(true)
        return
      }
      onChangeRef.current(pending)
      formCommitRef.current?.(pending)
    },
    [value, clearable, minDateTime, maxDateTime]
  )

  // Calendar value for display: extract date portion from displayValue.
  const calendarDisplayValue = useMemo((): CalendarDate | null => {
    if (!displayValue) return null
    return new CalendarDate(
      displayValue.year,
      displayValue.month,
      displayValue.day
    )
  }, [displayValue])

  // Min/max for calendar (date-only).
  const calendarMinDate = useMemo((): CalendarDate | undefined => {
    if (!minDateTime) return undefined
    return new CalendarDate(
      minDateTime.year,
      minDateTime.month,
      minDateTime.day
    )
  }, [minDateTime])

  const calendarMaxDate = useMemo((): CalendarDate | undefined => {
    if (!maxDateTime) return undefined
    return new CalendarDate(
      maxDateTime.year,
      maxDateTime.month,
      maxDateTime.day
    )
  }, [maxDateTime])

  return (
    <StyledDateFieldContainer>
      <StyledDateInputWrapper
        ref={setTriggerRef}
        aria-keyshortcuts="Alt+ArrowDown"
        aria-haspopup="dialog"
        aria-expanded={isCalendarActive}
        aria-controls={isCalendarActive ? popoverId : undefined}
        data-testid="stDateTimeInputField"
        data-disabled={disabled || undefined}
        data-has-error={error ? "" : undefined}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onClickCapture={handleClickCapture}
        onPaste={handlePaste}
        onKeyDownCapture={handleFieldKeyDown}
      >
        <I18nProvider locale="en-US">
          <StyledDateField>
            <DateField<CalendarDateTime>
              aria-label={label}
              aria-describedby={error ? errorId : undefined}
              isInvalid={!!error}
              value={displayValue}
              onChange={handleFieldChange}
              minValue={minDateTime ?? undefined}
              maxValue={maxDateTime ?? undefined}
              granularity="minute"
              hourCycle={24}
              shouldForceLeadingZeros
              isDisabled={disabled}
            >
              <ReorderedSegments format={format} includeTime />
            </DateField>
          </StyledDateField>
        </I18nProvider>
        <StyledTrailingIcons>
          {error && (
            <StyledErrorIconContainer data-testid="stDateTimeInputError">
              <Tooltip
                content={
                  <StreamlitMarkdown source={error} allowHTML={false} />
                }
                placement={Placement.TOP_RIGHT}
                error
              >
                <Icon content={ErrorOutline} size="base" />
              </Tooltip>
            </StyledErrorIconContainer>
          )}
          {clearable && !isNullOrUndefined(displayValue) && (
            <StyledClearButton
              ref={clearButtonRef}
              type="button"
              onClick={handleClear}
              aria-label="Clear date and time"
              data-testid="stDateTimeInputClearButton"
              tabIndex={-1}
              onMouseDown={e => e.preventDefault()}
            >
              <Icon content={Cancel} size="base" />
            </StyledClearButton>
          )}
        </StyledTrailingIcons>
        {error && (
          <StyledVisuallyHidden id={errorId} role="alert">
            {error.replace(/\*\*/g, "")}
          </StyledVisuallyHidden>
        )}
      </StyledDateInputWrapper>
      {isOpen && (
        <FloatingPortal id={FLOATING_OVERLAY_PORTAL_ID}>
          <StyledCalendarPopover
            id={popoverId}
            ref={setFloatingRef}
            style={floatingStyles}
            data-testid="stDateTimeInputCalendar"
            onKeyDown={handleCalendarKeyDown}
            role={isCalendarActive ? "dialog" : undefined}
            aria-modal={isCalendarActive ? "true" : undefined}
            aria-label={isCalendarActive ? "Choose date" : undefined}
            aria-describedby={isCalendarActive ? popoverDescId : undefined}
          >
            {isCalendarActive && (
              <StyledVisuallyHidden id={popoverDescId}>
                Use arrow keys to navigate dates. Enter to select. Escape to
                close.
              </StyledVisuallyHidden>
            )}
            <I18nProvider locale={safeLocale}>
              <StyledCalendarRoot
                aria-label="Choose date"
                value={calendarDisplayValue}
                onChange={handleCalendarChange}
                minValue={calendarMinDate}
                maxValue={calendarMaxDate}
                focusedValue={focusedValue ?? undefined}
                onFocusChange={onFocusChange}
              >
                <CalendarPopoverHeader />
                <StyledCalendarGrid weekdayStyle="narrow">
                  <CalendarGridHeader>
                    {day => (
                      <StyledCalendarHeaderCell>
                        {day}
                      </StyledCalendarHeaderCell>
                    )}
                  </CalendarGridHeader>
                  <CalendarGridBody>
                    {date => (
                      <StyledCalendarCell date={date} $isRangeMode={false} />
                    )}
                  </CalendarGridBody>
                </StyledCalendarGrid>
              </StyledCalendarRoot>
            </I18nProvider>
          </StyledCalendarPopover>
        </FloatingPortal>
      )}
    </StyledDateFieldContainer>
  )
}

export default memo(SingleDateTimeInput)
