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
import { CalendarDate, CalendarDateTime, Time } from "@internationalized/date"
import {
  CalendarGridBody,
  CalendarGridHeader,
  DateField,
  I18nProvider,
  type TimeValue,
} from "react-aria-components"

import { FLOATING_OVERLAY_PORTAL_ID } from "~lib/components/core/Portal/constants"
import Icon from "~lib/components/shared/Icon/Icon"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown/StreamlitMarkdown"
import Tooltip, { Placement } from "~lib/components/shared/Tooltip/Tooltip"
import {
  CalendarPopoverHeader,
  DATE_INPUT_HEADER_PICKER_POPOVER_CLASS,
} from "~lib/components/widgets/DateInput/CalendarPopoverHeader"
import { getSafeLocale } from "~lib/components/widgets/DateInput/dateInputUtils"
import { ReorderedSegments } from "~lib/components/widgets/DateInput/ReorderedSegments"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import {
  SHIFT_VIEWPORT_PADDING,
  useFloatingOverlay,
} from "~lib/hooks/useFloatingOverlay"
import { useOverlayDismissal } from "~lib/hooks/useOverlayDismissal"
import { convertRemToPx } from "~lib/theme/utils"
import { isNullOrUndefined } from "~lib/util/utils"

import {
  computeStepSnap,
  dateTimesEqual,
  getSegmentState,
  getTypedDateFromDom,
  getTypedTimeFromDom,
  parsePastedDateTime,
  validateDateTime,
} from "./dateTimeInputUtils"
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
  StyledPopoverTimeField,
  StyledPopoverTimeFieldInput,
  StyledPopoverTimeLabel,
  StyledPopoverTimeRow,
  StyledPopoverTimeSegment,
  StyledTrailingIcons,
  StyledVisuallyHidden,
} from "./styled-components"

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
  /** App-wide locale (`LibConfigContext`), used only to localize the
   * calendar popover's month/weekday text — the typed field is always
   * pinned to `en-US` (see `I18nProvider locale="en-US"` below). */
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
  // Guards against `handleFocus` reopening the popover it's in the middle
  // of closing — see `restoreFocusToField` below.
  const isRestoringFocusRef = useRef(false)

  const [isCalendarActive, setIsCalendarActive] = useState(false)
  const isCalendarActiveRef = useRef(false)
  isCalendarActiveRef.current = isCalendarActive
  const activeOriginRef = useRef<HTMLElement | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)

  // --- Two-layer state ---
  const [displayValue, setDisplayValue] = useState<CalendarDateTime | null>(
    value
  )

  // Three-state: undefined = no commit yet this interaction; null = cleared;
  // CalendarDateTime = last committed value. Prevents duplicate commits.
  const lastCommittedRef = useRef<CalendarDateTime | null | undefined>(
    undefined
  )

  // Which time control the user focused last. The inline segments and the
  // popover TimeField can hold different times at once, so the later edit wins.
  // Focus alone flips this, which is harmless: an untouched control reads as
  // null and `resolveGivenTime` falls back to the other.
  const lastTimeSourceRef = useRef<"inline" | "popover">("inline")
  // A complete time set in the popover before any date exists. React Aria resets
  // the TimeField's segments from its controlled `value` the moment they
  // complete, so without holding the time here it would blank out as the user
  // finished typing it.
  //
  // Display buffer only: `resolveGivenTime` never reads it, because a *partial*
  // popover time never reaches `onChange` and so never lands here. What commits
  // is always re-read from the rendered segments.
  const [pendingTime, setPendingTime] = useState<Time | null>(null)

  const [prevValue, setPrevValue] = useState(value)
  if (prevValue !== value) {
    setPrevValue(value)
    setDisplayValue(value)
    setPendingTime(null)
    lastCommittedRef.current = undefined
  }

  const [prevResetKey, setPrevResetKey] = useState(formResetKey)
  if (prevResetKey !== formResetKey) {
    setPrevResetKey(formResetKey)
    setDisplayValue(value)
    setPendingTime(null)
  }

  const displayValueRef = useRef(displayValue)
  displayValueRef.current = displayValue

  /** The time to merge into a date the user selects: the buffered display
   * value's if the field already holds one, otherwise whichever of the two time
   * controls they focused most recently, falling back to the other if that one
   * is empty. Null when they have given no time at all, in which case the caller
   * defaults to midnight.
   *
   * Both controls are read from their rendered segments, because neither reports
   * a partial time through `onChange`. Reading them here rather than tracking
   * them in state means there is no buffered copy to go stale. */
  const resolveGivenTime = useCallback((): Time | null => {
    const buffered = displayValueRef.current
    if (buffered) return new Time(buffered.hour, buffered.minute)
    // Dismissing clears `pendingTime` but leaves the inline segments alone, so
    // a time typed there survives into a later date pick while a popover one
    // does not. That asymmetry is deliberate: the popover unmounts with its
    // value, whereas the inline draft is still on screen, and committing what is
    // visible is the whole point of reading here.
    const popover = getTypedTimeFromDom(popoverRef.current)
    const inline = getTypedTimeFromDom(triggerRef.current)
    return lastTimeSourceRef.current === "popover"
      ? (popover ?? inline)
      : (inline ?? popover)
  }, [])

  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const formCommitRef = useRef(formCommit)
  formCommitRef.current = formCommit

  const [isOpen, setIsOpen] = useState(false)

  /** The datetime the two controls describe between them when the field itself
   * holds no value: a complete date read from the inline segments, plus a time
   * from whichever control the user last touched. Null unless both halves are
   * present — a date alone gives nothing to commit, and defaulting its time
   * would be inventing one. */
  const completeFromVisibleParts = useCallback((): CalendarDateTime | null => {
    const date = getTypedDateFromDom(triggerRef.current)
    const time = resolveGivenTime()
    if (!date || !time) return null
    return new CalendarDateTime(
      date.year,
      date.month,
      date.day,
      time.hour,
      time.minute
    )
  }, [resolveGivenTime])

  /** Validate and commit the pending value, or revert to the last committed
   * value. Returns true if the field holds a valid (committed or unchanged)
   * value, false if it was reverted. Calls both onChange (React state) and
   * formCommit (sync WM write) to prevent the form-submit race. */
  const commitOrRevert = useCallback((): boolean => {
    if (!triggerRef.current) return false
    const { isPartiallyTyped, isFullyCleared } = getSegmentState(
      triggerRef.current
    )

    // A date typed inline with its time given only in the popover reads as
    // partially typed, because the field withholds onChange while the hour and
    // minute are placeholders. Both halves are on screen, so complete the value
    // from them rather than discarding a date and time the user can see.
    //
    // The gate also requires the field to hold no value of its own. Clearing one
    // segment of an existing value reads as partially typed too — React Aria
    // reports nothing unless every segment is cleared — and that is an edit in
    // progress, not two halves to combine, so it still reverts.
    //
    // Read before `setPendingTime(null)` below, so the merge never depends on
    // React batching that clear: flushing it would blank the popover's segments.
    const completedFromParts =
      isPartiallyTyped && !displayValueRef.current
        ? completeFromVisibleParts()
        : null

    // A time given in the popover lives only as long as that popover session:
    // every path here either commits it into the value or discards it. Without
    // this, a dismissed time would be restored into the remounted TimeField and
    // then merged into a date picked in a later session, with nothing on screen
    // explaining where it came from.
    setPendingTime(null)

    // Safe to reach twice: an outside click commits on pointerdown and the
    // browser then fires blur, by which point the popover is unmounted and its
    // half unreadable. This branch touches only local display and error state, so
    // it cannot undo the commit that just happened.
    if (
      (isPartiallyTyped && !completedFromParts) ||
      (isFullyCleared && !clearable)
    ) {
      setDisplayValue(value)
      onCloseRef.current(true)
      return false
    }

    const pending =
      completedFromParts ?? (isFullyCleared ? null : displayValueRef.current)

    if (validateDateTime(pending, minDateTime, maxDateTime)) {
      setDisplayValue(value)
      onCloseRef.current(true)
      return false
    }

    if (dateTimesEqual(pending, value)) return true

    if (
      lastCommittedRef.current !== undefined &&
      dateTimesEqual(pending, lastCommittedRef.current)
    ) {
      return true
    }

    lastCommittedRef.current = pending
    onChangeRef.current(pending)
    formCommitRef.current?.(pending)
    return true
  }, [value, clearable, minDateTime, maxDateTime, completeFromVisibleParts])

  // Reset state when the popover opens: clear the commit-dedup guard and
  // sync the calendar's focused month to the committed value so a prior
  // reverted out-of-bounds edit doesn't leave the calendar on a wrong month.
  const wasOpenRef = useRef(isOpen)
  useEffect(() => {
    if (!wasOpenRef.current && isOpen) {
      lastCommittedRef.current = undefined
      if (value) {
        onFocusChange(new CalendarDate(value.year, value.month, value.day))
      }
    }
    wasOpenRef.current = isOpen
  }, [isOpen, value, onFocusChange])

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
        commitOrRevert()
      },
      floatingSetFn: refs.setFloating,
      referenceSetFn: refs.setReference,
      restoreFocusFn: restoreFocusToField,
      // Exclude the month/year picker so clicks and Escape inside it do not
      // dismiss the calendar.
      excludeSelectors: [`.${DATE_INPUT_HEADER_PICKER_POPOVER_CLASS}`],
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
        // The field now carries its own time, superseding any pending one.
        setPendingTime(null)
        onFocusChange(new CalendarDate(date.year, date.month, date.day))
      }
    },
    [onFocusChange, onValidate]
  )

  // Calendar date selection: merge the date with whatever time the user has
  // already given — the buffered display value's, else one given before any date
  // existed — and enter active mode so Tab cycles within the popover (reaching
  // the TimeField) instead of dismissing.
  const handleCalendarChange = useCallback(
    (date: CalendarDate): void => {
      const currentTime = resolveGivenTime()
      const merged = new CalendarDateTime(
        date.year,
        date.month,
        date.day,
        currentTime?.hour ?? 0,
        currentTime?.minute ?? 0
      )
      setDisplayValue(merged)
      setPendingTime(null)
      onValidate(merged)
      setIsCalendarActive(true)
      activeOriginRef.current = null
    },
    [onValidate, resolveGivenTime]
  )

  const handleFocus = useCallback((): void => {
    lastTimeSourceRef.current = "inline"
    if (isRestoringFocusRef.current) return
    if (!disabled) setIsOpen(true)
  }, [disabled])

  const handlePopoverTimeFocus = useCallback((): void => {
    lastTimeSourceRef.current = "popover"
  }, [])

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
    setPendingTime(null)
    lastCommittedRef.current = null
    onChange(null)
    formCommitRef.current?.(null)
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
        lastCommittedRef.current = fullDateTime
        onChange(fullDateTime)
        formCommitRef.current?.(fullDateTime)
        return
      }

      // For partial segment paste, let RAC handle it (no custom partial for datetime)
    },
    [disabled, format, onChange]
  )

  // Shared step-snap handler for ArrowUp/ArrowDown on time segments.
  const applyStepSnap = useCallback(
    (
      e: KeyboardEvent<HTMLDivElement>,
      current: CalendarDateTime | null
    ): void => {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return
      // No date yet: nothing to snap against, so React Aria's default ±1 applies.
      if (!current) return
      const target = e.target as HTMLElement
      const segmentType = target.getAttribute("data-type")
      const snapped = computeStepSnap(
        current,
        segmentType,
        step,
        e.key === "ArrowUp"
      )
      if (snapped) {
        e.preventDefault()
        e.stopPropagation()
        e.nativeEvent.stopImmediatePropagation()
        setDisplayValue(snapped)
        onValidate(snapped)
      }
    },
    [step, onValidate]
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
        const valid = commitOrRevert()
        if (valid && !error) formSubmit?.()
        return
      }

      // Step-aware arrow keys for time segments.
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        applyStepSnap(e, displayValue)
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
    [isOpen, displayValue, error, formSubmit, commitOrRevert, applyStepSnap]
  )

  // Active mode: Tab cycles within popover. Passive: Tab closes.
  const handleCalendarKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>): void => {
      if (e.key !== "Tab") return
      e.preventDefault()

      if (!isCalendarActiveRef.current) {
        commitOrRevert()
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
    [commitOrRevert, restoreFocusToField]
  )

  const handleBlur = useCallback(
    (e: FocusEvent<HTMLDivElement>): void => {
      if (e.currentTarget.contains(e.relatedTarget)) return
      if (isCalendarActiveRef.current) return
      if (
        isOpen &&
        (!e.relatedTarget || popoverRef.current?.contains(e.relatedTarget))
      )
        return
      commitOrRevert()
    },
    [isOpen, commitOrRevert]
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

  // Popover TimeField value: the committed time, or one set before a date.
  //
  // Before a date exists the two time controls can show different times: a time
  // typed inline is not mirrored here, and one typed here is not mirrored into
  // the inline segments. Neither can be: the inline `DateField` cannot be given
  // a time-only value, and mirroring the other way would mean reading the DOM
  // during render. `resolveGivenTime` picks between them at commit, so the
  // divergence is visual only.
  const popoverTimeValue = useMemo((): Time | null => {
    if (!displayValue) return pendingTime
    return new Time(displayValue.hour, displayValue.minute)
  }, [displayValue, pendingTime])

  // Popover TimeField change: merge new time with existing date, or hold it as
  // pending until a date selection can complete the value.
  const handlePopoverTimeChange = useCallback(
    (time: TimeValue | null): void => {
      const current = displayValueRef.current
      if (!current) {
        // Drop pendingTime when the user empties the field; otherwise the
        // controlled value puts the time back. With no date, that state is the
        // field's only record of the time.
        setPendingTime(time ? new Time(time.hour, time.minute) : null)
        return
      }
      // A CalendarDateTime always has a time, so there is nothing to clear.
      if (!time) return
      const merged = new CalendarDateTime(
        current.year,
        current.month,
        current.day,
        time.hour,
        time.minute
      )
      setDisplayValue(merged)
      onValidate(merged)
    },
    [onValidate]
  )

  const handlePopoverTimeKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>): void => {
      applyStepSnap(e, displayValueRef.current)
    },
    [applyStepSnap]
  )

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
            aria-label={isCalendarActive ? "Choose date and time" : undefined}
            aria-describedby={isCalendarActive ? popoverDescId : undefined}
          >
            {isCalendarActive && (
              <StyledVisuallyHidden id={popoverDescId}>
                Use arrow keys to navigate. Enter to select. Tab to switch
                between calendar and time. Escape to close.
              </StyledVisuallyHidden>
            )}
            <I18nProvider locale={safeLocale}>
              <StyledCalendarRoot
                aria-label="Choose date and time"
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
              <StyledPopoverTimeRow
                data-testid="stDateTimeInputPopoverTime"
                onKeyDownCapture={handlePopoverTimeKeyDown}
                onFocus={handlePopoverTimeFocus}
              >
                <StyledPopoverTimeLabel id={`${id}-time-label`}>
                  Time
                </StyledPopoverTimeLabel>
                <I18nProvider locale="en-US">
                  <StyledPopoverTimeField
                    aria-labelledby={`${id}-time-label`}
                    aria-describedby={error ? errorId : undefined}
                    isInvalid={!!error}
                    value={popoverTimeValue}
                    onChange={handlePopoverTimeChange}
                    granularity="minute"
                    hourCycle={24}
                    shouldForceLeadingZeros
                    isDisabled={disabled}
                  >
                    <StyledPopoverTimeFieldInput>
                      {segment => (
                        <StyledPopoverTimeSegment segment={segment} />
                      )}
                    </StyledPopoverTimeFieldInput>
                  </StyledPopoverTimeField>
                </I18nProvider>
              </StyledPopoverTimeRow>
            </I18nProvider>
          </StyledCalendarPopover>
        </FloatingPortal>
      )}
    </StyledDateFieldContainer>
  )
}

export default memo(SingleDateTimeInput)
