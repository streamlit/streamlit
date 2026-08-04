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
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react"

import {
  ErrorOutline,
  KeyboardArrowDown,
} from "@emotion-icons/material-outlined"
import { Cancel } from "@emotion-icons/material-rounded"
import { FloatingPortal } from "@floating-ui/react"
import { CalendarDate } from "@internationalized/date"
import {
  CalendarGridBody,
  CalendarGridHeader,
  DateField,
  I18nProvider,
  RangeCalendarStateContext,
} from "react-aria-components"

import { FLOATING_OVERLAY_PORTAL_ID } from "~lib/components/core/Portal/constants"
import Icon from "~lib/components/shared/Icon/Icon"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown/StreamlitMarkdown"
import Tooltip, { Placement } from "~lib/components/shared/Tooltip/Tooltip"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import {
  SHIFT_VIEWPORT_PADDING,
  useFloatingOverlay,
} from "~lib/hooks/useFloatingOverlay"
import { useOverlayDismissal } from "~lib/hooks/useOverlayDismissal"
import { convertRemToPx } from "~lib/theme/utils"

import { CalendarPopoverHeader } from "./CalendarPopoverHeader"
import {
  datesEqual,
  getQuickSelectPresets,
  isValidSegmentValue,
  parsePartialSegmentPaste,
  parsePastedDate,
} from "./dateInputUtils"
import { ReorderedDateSegments } from "./ReorderedDateSegments"
import {
  StyledCalendarCell,
  StyledCalendarGrid,
  StyledCalendarHeaderCell,
  StyledCalendarHeaderSelectChevron,
  StyledCalendarPopover,
  StyledClearButton,
  StyledDateField,
  StyledDateFieldContainer,
  StyledDateInputWrapper,
  StyledErrorIconContainer,
  StyledQuickSelectLabel,
  StyledQuickSelectListBox,
  StyledQuickSelectListBoxItem,
  StyledQuickSelectRow,
  StyledQuickSelectTrigger,
  StyledRangeCalendarRoot,
  StyledRangeSeparator,
  StyledVisuallyHidden,
} from "./styled-components"
import { getSafeLocale } from "./weekInfo"

interface RangeDateInputProps {
  startValue: CalendarDate | null
  endValue: CalendarDate | null
  onChange: (dates: CalendarDate[]) => void
  minDate: CalendarDate
  maxDate: CalendarDate | undefined
  format: string
  disabled: boolean
  clearable: boolean
  label: string
  error: string | null
  locale: string
  isInSidebar: boolean
  enableQuickSelect: boolean
  focusedValue: CalendarDate
  onFocusChange: (value: CalendarDate) => void
  onValidate: (date: CalendarDate | null) => void
  onClose: () => void
  formCommit?: (dates: CalendarDate[]) => void
  formResetKey: number
}

/**
 * Watches `RangeCalendarStateContext`'s `anchorDate` and fires `onAnchorSelect`
 * once per null→non-null transition (first click of a new selection).
 * `RangeCalendar`'s `onChange` only fires after a *complete* range (second
 * click), so this provides the "one date chosen so far" signal.
 *
 * Also seeds `anchorDate` on mount for partial values (start without end),
 * so reopening the popover lets the next click complete the range rather than
 * starting fresh.
 */
function AnchorDateWatcher({
  seedAnchor,
  onAnchorSelect,
}: {
  seedAnchor: CalendarDate | null
  onAnchorSelect: (date: CalendarDate) => void
}): null {
  const state = useContext(RangeCalendarStateContext)
  const prevAnchorRef = useRef<CalendarDate | null>(null)
  const hasSeededRef = useRef(false)

  useEffect(() => {
    if (!hasSeededRef.current && seedAnchor && !state?.anchorDate) {
      hasSeededRef.current = true
      prevAnchorRef.current = seedAnchor
      state?.setAnchorDate(seedAnchor)
      return
    }
    const anchor = state?.anchorDate ?? null
    if (anchor && !prevAnchorRef.current) {
      onAnchorSelect(anchor)
    }
    prevAnchorRef.current = anchor
  }, [state?.anchorDate, onAnchorSelect, seedAnchor, state])

  return null
}

function compact(dates: (CalendarDate | null)[]): CalendarDate[] {
  return dates.filter((d): d is CalendarDate => d !== null)
}

function rangeEqual(a: CalendarDate[], b: CalendarDate[]): boolean {
  if (a.length !== b.length) return false
  return a.every((d, i) => datesEqual(d, b[i]))
}

function RangeDateInput({
  startValue,
  endValue,
  onChange,
  minDate,
  maxDate,
  format,
  disabled,
  clearable,
  label,
  error,
  locale,
  isInSidebar,
  enableQuickSelect,
  focusedValue,
  onFocusChange,
  onValidate,
  onClose,
  formCommit,
  formResetKey,
}: RangeDateInputProps): ReactElement {
  const theme = useEmotionTheme()
  const id = useId()
  const errorId = `${id}-error`
  const triggerRef = useRef<HTMLDivElement | null>(null)
  const safeLocale = useMemo(() => getSafeLocale(locale), [locale])
  const quickSelectPresets = useMemo(() => getQuickSelectPresets(), [])

  const clearButtonRef = useRef<HTMLButtonElement | null>(null)
  const skipCloseCommitRef = useRef(false)
  // Guards against `handleFocus` reopening the popover during programmatic
  // focus restoration (see `focusLastFieldSegment` below).
  const isRestoringFocusRef = useRef(false)

  // --- Two-layer state (matches SingleDateInput pattern) ---
  const [displayStart, setDisplayStart] = useState<CalendarDate | null>(
    startValue
  )
  const [displayEnd, setDisplayEnd] = useState<CalendarDate | null>(endValue)

  // Sync from parent when values change externally
  const [prevStart, setPrevStart] = useState(startValue)
  if (prevStart !== startValue) {
    setPrevStart(startValue)
    setDisplayStart(startValue)
  }
  const [prevEnd, setPrevEnd] = useState(endValue)
  if (prevEnd !== endValue) {
    setPrevEnd(endValue)
    setDisplayEnd(endValue)
  }

  // Form clear: display may have diverged without value changing
  const [prevResetKey, setPrevResetKey] = useState(formResetKey)
  if (prevResetKey !== formResetKey) {
    setPrevResetKey(formResetKey)
    setDisplayStart(startValue)
    setDisplayEnd(endValue)
  }

  const displayStartRef = useRef(displayStart)
  displayStartRef.current = displayStart
  const displayEndRef = useRef(displayEnd)
  displayEndRef.current = displayEnd

  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const [isOpen, setIsOpenState] = useState(false)

  const wasOpenRef = useRef(isOpen)
  useEffect(() => {
    if (wasOpenRef.current && !isOpen) {
      if (skipCloseCommitRef.current) {
        skipCloseCommitRef.current = false
      } else {
        // Range mode does NOT revert to default on close with placeholders
        // (unlike single mode). BaseWeb's original range picker committed
        // the current state on close regardless of placeholder segments.
        // A null displayStart means "cleared" → commit [].
        const pending = compact([
          displayStartRef.current,
          displayEndRef.current,
        ])
        const committed = compact([startValue, endValue])
        if (!rangeEqual(pending, committed)) {
          onChangeRef.current(pending)
        }
      }
      onClose()
    }
    wasOpenRef.current = isOpen
  }, [isOpen, startValue, endValue, onClose])

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

  const focusLastFieldSegment = useCallback((): void => {
    const segments = triggerRef.current?.querySelectorAll<HTMLElement>(
      '[role="spinbutton"]'
    )
    const lastSegment = segments?.[segments.length - 1]
    isRestoringFocusRef.current = true
    if (lastSegment) {
      lastSegment.focus()
    } else {
      triggerRef.current?.focus()
    }
    requestAnimationFrame(() => {
      isRestoringFocusRef.current = false
    })
  }, [])

  const { setFloatingRef, setReferenceRef } = useOverlayDismissal({
    isOpen,
    onClose: () => setIsOpenState(false),
    floatingSetFn: refs.setFloating,
    referenceSetFn: refs.setReference,
    restoreFocusFn: focusLastFieldSegment,
    excludeSelectors: ['[data-testid="stDateInputHeaderPickerPopover"]'],
    excludeEscape: true,
  })

  const setTriggerRef = useCallback(
    (node: HTMLDivElement | null): void => {
      triggerRef.current = node
      setReferenceRef(node)
    },
    [setReferenceRef]
  )

  const [isQuickSelectOpen, setIsQuickSelectOpen] = useState(false)

  const handleFocus = useCallback((): void => {
    if (isRestoringFocusRef.current) return
    if (!disabled) setIsOpenState(true)
  }, [disabled])

  // Capture-phase fires before the clear button's own handler; without this
  // gate, clearing a value would immediately reopen the popover.
  const handleClickCapture = useCallback(
    (e: MouseEvent<HTMLDivElement>): void => {
      if (clearButtonRef.current?.contains(e.target as Node)) return
      handleFocus()
    },
    [handleFocus]
  )

  // Segment typing: update display only, no parent commit.
  // Clearing start also clears end — a range cannot have an end without a
  // start (prevents end-promotion into the start slot on close).
  const handleStartFieldChange = useCallback(
    (date: CalendarDate | null): void => {
      setDisplayStart(date)
      if (!date) {
        setDisplayEnd(null)
      }
      onValidate(date)
      if (date) onFocusChange(date)
    },
    [onFocusChange, onValidate]
  )

  const handleEndFieldChange = useCallback(
    (date: CalendarDate | null): void => {
      setDisplayEnd(date)
      onValidate(date)
      if (date) onFocusChange(date)
    },
    [onFocusChange, onValidate]
  )

  // Calendar value for the grid — only non-null with both endpoints
  const calendarValue = useMemo(
    () =>
      displayStart && displayEnd
        ? { start: displayStart, end: displayEnd }
        : null,
    [displayStart, displayEnd]
  )

  // Second click: RangeCalendar fires with complete {start, end}
  const handleCalendarChange = useCallback(
    (range: { start: CalendarDate; end: CalendarDate }): void => {
      setDisplayStart(range.start)
      setDisplayEnd(range.end)
      onChange([range.start, range.end])
      skipCloseCommitRef.current = true
      setIsOpenState(false)
      focusLastFieldSegment()
    },
    [onChange, focusLastFieldSegment]
  )

  // Tab from edge segments closes the popover and lets focus leave the widget
  // naturally (keyboard users type dates directly in segments).
  const handleFieldKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>): void => {
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
        setIsOpenState(false)
      }
    },
    [isOpen]
  )

  // If focus lands in the calendar (mouse click on a header control), Tab
  // closes the popover and returns focus to the field.
  const handleCalendarKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>): void => {
      if (e.key !== "Tab") return
      e.preventDefault()
      setIsOpenState(false)
      focusLastFieldSegment()
    },
    [focusLastFieldSegment]
  )

  // First click of a new range selection
  const handleAnchorSelect = useCallback(
    (date: CalendarDate): void => {
      setDisplayStart(date)
      setDisplayEnd(null)
      onChange([date])
    },
    [onChange]
  )

  const handleClear = useCallback((): void => {
    setDisplayStart(null)
    setDisplayEnd(null)
    onChange([])
  }, [onChange])

  const handleQuickSelect = useCallback(
    (presetId: string): void => {
      const preset = quickSelectPresets.find(p => p.id === presetId)
      if (!preset) return
      setDisplayStart(preset.start)
      setDisplayEnd(preset.end)
      onChange([preset.start, preset.end])
      skipCloseCommitRef.current = true
      setIsOpenState(false)
      setIsQuickSelectOpen(false)
    },
    [quickSelectPresets, onChange]
  )

  const makeHandlePaste = useCallback(
    (
      currentValue: CalendarDate | null,
      setDisplay: (date: CalendarDate | null) => void
    ) =>
      (e: ClipboardEvent<HTMLDivElement>): void => {
        if (disabled) return
        const text = e.clipboardData.getData("text").trim()

        const fullDate = parsePastedDate(text, format)
        if (fullDate) {
          e.preventDefault()
          setDisplay(fullDate)
          onChange(
            compact([
              currentValue === displayStartRef.current
                ? fullDate
                : displayStartRef.current,
              currentValue === displayEndRef.current
                ? fullDate
                : displayEndRef.current,
            ])
          )
          return
        }

        const target = e.target as HTMLElement
        if (target.getAttribute("role") !== "spinbutton") return
        const partial = parsePartialSegmentPaste(
          text,
          target.getAttribute("data-type")
        )
        if (!partial) return
        e.preventDefault()
        if (!isValidSegmentValue(partial.segmentType, partial.value)) return

        const base = currentValue ?? minDate
        const newDate = base.set({ [partial.segmentType]: partial.value })
        if (newDate[partial.segmentType] !== partial.value) return
        setDisplay(newDate)
        onChange(
          compact([
            currentValue === displayStartRef.current
              ? newDate
              : displayStartRef.current,
            currentValue === displayEndRef.current
              ? newDate
              : displayEndRef.current,
          ])
        )
      },
    [disabled, format, minDate, onChange]
  )

  const handleStartPaste = useMemo(
    () => makeHandlePaste(displayStart, setDisplayStart),
    [makeHandlePaste, displayStart]
  )
  const handleEndPaste = useMemo(
    () => makeHandlePaste(displayEnd, setDisplayEnd),
    [makeHandlePaste, displayEnd]
  )

  // Synchronous commit on blur for form-submit races
  const handleBlur = useCallback(
    (e: FocusEvent<HTMLDivElement>): void => {
      if (e.currentTarget.contains(e.relatedTarget)) return
      if (!formCommit) return
      const hasPlaceholders =
        triggerRef.current?.querySelector('[data-placeholder="true"]') !== null
      if (hasPlaceholders) return
      const pending = compact([displayStartRef.current, displayEndRef.current])
      const committed = compact([startValue, endValue])
      if (!rangeEqual(pending, committed)) {
        formCommit(pending)
      }
    },
    [formCommit, startValue, endValue]
  )

  const hasValue = displayStart !== null || displayEnd !== null

  return (
    <StyledDateFieldContainer>
      <StyledDateInputWrapper
        ref={setTriggerRef}
        data-testid="stDateInputField"
        data-disabled={disabled || undefined}
        data-has-error={error ? "" : undefined}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onClickCapture={handleClickCapture}
        onKeyDown={handleFieldKeyDown}
      >
        <I18nProvider locale="en-US">
          <StyledDateField $isRange>
            <div onPaste={handleStartPaste}>
              <DateField
                aria-label={`${label} start date`}
                aria-describedby={error ? errorId : undefined}
                isInvalid={!!error}
                value={displayStart}
                onChange={handleStartFieldChange}
                minValue={minDate}
                maxValue={maxDate}
                shouldForceLeadingZeros
                isDisabled={disabled}
              >
                <ReorderedDateSegments format={format} isRange />
              </DateField>
            </div>
          </StyledDateField>
          <StyledRangeSeparator aria-hidden="true">–</StyledRangeSeparator>
          <StyledDateField $isRange>
            <div onPaste={handleEndPaste}>
              <DateField
                aria-label={`${label} end date`}
                aria-describedby={error ? errorId : undefined}
                isInvalid={!!error}
                value={displayEnd}
                onChange={handleEndFieldChange}
                minValue={minDate}
                maxValue={maxDate}
                shouldForceLeadingZeros
                isDisabled={disabled}
              >
                <ReorderedDateSegments format={format} isRange />
              </DateField>
            </div>
          </StyledDateField>
        </I18nProvider>
        {error && (
          <StyledErrorIconContainer data-testid="stDateInputError">
            <Tooltip
              content={<StreamlitMarkdown source={error} allowHTML={false} />}
              placement={Placement.TOP_RIGHT}
              error
            >
              <Icon content={ErrorOutline} size="base" />
            </Tooltip>
          </StyledErrorIconContainer>
        )}
        {clearable && hasValue && (
          <StyledClearButton
            ref={clearButtonRef}
            type="button"
            onClick={handleClear}
            aria-label="Clear dates"
            data-testid="stDateInputClearButton"
            tabIndex={-1}
            onMouseDown={e => e.preventDefault()}
          >
            <Icon content={Cancel} size="base" />
          </StyledClearButton>
        )}
        {error && (
          <StyledVisuallyHidden id={errorId} role="alert">
            {error.replace(/\*\*/g, "")}
          </StyledVisuallyHidden>
        )}
      </StyledDateInputWrapper>
      {isOpen && (
        <FloatingPortal id={FLOATING_OVERLAY_PORTAL_ID}>
          <StyledCalendarPopover
            ref={setFloatingRef}
            style={floatingStyles}
            data-testid="stDateInputCalendar"
            onKeyDown={handleCalendarKeyDown}
          >
            <I18nProvider locale={safeLocale}>
              <StyledRangeCalendarRoot
                aria-label="Choose date"
                value={calendarValue}
                onChange={handleCalendarChange}
                minValue={minDate}
                maxValue={maxDate}
                focusedValue={focusedValue ?? undefined}
                onFocusChange={onFocusChange}
              >
                <AnchorDateWatcher
                  seedAnchor={displayEnd === null ? displayStart : null}
                  onAnchorSelect={handleAnchorSelect}
                />
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
                    {date => <StyledCalendarCell date={date} $isRangeMode />}
                  </CalendarGridBody>
                </StyledCalendarGrid>
              </StyledRangeCalendarRoot>
            </I18nProvider>
            {enableQuickSelect && (
              <StyledQuickSelectRow>
                <StyledQuickSelectLabel>
                  Choose a date range
                </StyledQuickSelectLabel>
                <StyledQuickSelectTrigger
                  aria-label="Quick select a date range"
                  aria-expanded={isQuickSelectOpen}
                  aria-haspopup="listbox"
                  onPress={() => setIsQuickSelectOpen(prev => !prev)}
                >
                  Select...
                  <StyledCalendarHeaderSelectChevron>
                    <KeyboardArrowDown size={theme.iconSizes.base} />
                  </StyledCalendarHeaderSelectChevron>
                </StyledQuickSelectTrigger>
                {isQuickSelectOpen && (
                  <StyledQuickSelectListBox
                    aria-label="Quick select a date range"
                    selectionMode="single"
                    onSelectionChange={keys => {
                      const key = [...keys][0]
                      if (key) handleQuickSelect(String(key))
                    }}
                  >
                    {quickSelectPresets.map(preset => (
                      <StyledQuickSelectListBoxItem
                        key={preset.id}
                        id={preset.id}
                      >
                        {preset.label}
                      </StyledQuickSelectListBoxItem>
                    ))}
                  </StyledQuickSelectListBox>
                )}
              </StyledQuickSelectRow>
            )}
          </StyledCalendarPopover>
        </FloatingPortal>
      )}
    </StyledDateFieldContainer>
  )
}

export default memo(RangeDateInput)
