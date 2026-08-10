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
  Key,
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
  validateDate,
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
  StyledDropdownListBox,
  StyledDropdownListBoxItem,
  StyledDropdownPopover,
  StyledErrorIconContainer,
  StyledQuickSelectLabel,
  StyledQuickSelectRow,
  StyledQuickSelectTrigger,
  StyledRangeCalendarRoot,
  StyledRangeSeparator,
  StyledTrailingIcons,
  StyledVisuallyHidden,
} from "./styled-components"
import { getSafeLocale } from "./weekInfo"

const noop = (): void => {}

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
  /** When inside a form, writes the pending range to WidgetStateManager
   * synchronously on blur so a concurrent form submit reads the correct
   * value. Undefined when not in a form. */
  formCommit?: (dates: CalendarDate[]) => void
  /** Incremented when the parent form is cleared. Signals this component to
   * reset its local display state to the parent's value props (which may not
   * have changed if segment edits were never committed). */
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
  const anchorDate = state?.anchorDate ?? null
  const setAnchorDate = state?.setAnchorDate
  const prevAnchorRef = useRef<CalendarDate | null>(null)
  const prevSeedRef = useRef<CalendarDate | null>(null)

  useEffect(() => {
    // (Re-)seed when seedAnchor changes to a new non-null value (handles
    // both initial mount and user editing the start field while the calendar
    // is open with displayEnd === null).
    if (seedAnchor && !datesEqual(seedAnchor, prevSeedRef.current)) {
      prevSeedRef.current = seedAnchor
      prevAnchorRef.current = seedAnchor
      setAnchorDate?.(seedAnchor)
      return
    }
    if (!seedAnchor) {
      prevSeedRef.current = null
      if (prevAnchorRef.current) {
        setAnchorDate?.(null)
      }
    }
    if (anchorDate && !prevAnchorRef.current) {
      onAnchorSelect(anchorDate)
    }
    prevAnchorRef.current = anchorDate
  }, [anchorDate, setAnchorDate, onAnchorSelect, seedAnchor])

  return null
}

function compact(dates: (CalendarDate | null)[]): CalendarDate[] {
  return dates.filter((d): d is CalendarDate => d !== null)
}

function rangeEqual(a: CalendarDate[], b: CalendarDate[]): boolean {
  if (a.length !== b.length) return false
  return a.every((d, i) => datesEqual(d, b[i]))
}

function hasPartiallyTypedField(container: HTMLElement | null): boolean {
  const fields = container?.querySelectorAll("[data-range-field]")
  if (!fields) return false
  for (const field of fields) {
    const segs = field.querySelectorAll('[role="spinbutton"]')
    const placeholders = field.querySelectorAll(
      '[role="spinbutton"][data-placeholder="true"]'
    )
    if (placeholders.length > 0 && placeholders.length < segs.length) {
      return true
    }
  }
  return false
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
  formCommit,
  formResetKey,
}: RangeDateInputProps): ReactElement {
  const theme = useEmotionTheme()
  const id = useId()
  const errorId = `${id}-error`
  const popoverId = `${id}-calendar`
  const popoverDescId = `${id}-calendar-desc`
  const triggerRef = useRef<HTMLDivElement | null>(null)
  const safeLocale = useMemo(() => getSafeLocale(locale), [locale])
  // today() inside getQuickSelectPresets is intentionally not a dep — the
  // component remounts on each script rerun, so stale-day is not possible.
  const quickSelectPresets = useMemo(() => {
    const presets = getQuickSelectPresets()
    if (!maxDate) return presets
    return presets
      .filter(p => p.start.compare(maxDate) <= 0)
      .map(p => (p.end.compare(maxDate) > 0 ? { ...p, end: maxDate } : p))
  }, [maxDate])
  const quickSelectRef = useRef<HTMLDivElement>(null)

  const clearButtonRef = useRef<HTMLButtonElement | null>(null)
  const skipCloseCommitRef = useRef(false)
  // Guards against `handleFocus` reopening the popover during programmatic
  // focus restoration (see `restoreFocusToField` below).
  const isRestoringFocusRef = useRef(false)

  // Dual-mode state: passive (visual aid) vs active (keyboard-modal).
  const [isCalendarActive, setIsCalendarActive] = useState(false)
  const isCalendarActiveRef = useRef(false)
  isCalendarActiveRef.current = isCalendarActive
  const activeOriginRef = useRef<HTMLElement | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)

  // True while in "anchor mode": user clicked a day to start a new range
  // and the calendar is waiting for the second click to complete it.
  // The anchor VALUE is always `displayStartRef.current` — never stored
  // separately, so it can't go stale when the user edits via keyboard/paste.
  const inAnchorModeRef = useRef(false)

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

  const activePreset = useMemo(() => {
    if (!displayStart || !displayEnd) return null
    return (
      quickSelectPresets.find(
        p => datesEqual(p.start, displayStart) && datesEqual(p.end, displayEnd)
      ) ?? null
    )
  }, [displayStart, displayEnd, quickSelectPresets])

  const activePresetLabel = activePreset?.label ?? "Select..."

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
      inAnchorModeRef.current = false
      if (skipCloseCommitRef.current) {
        skipCloseCommitRef.current = false
      } else {
        if (hasPartiallyTypedField(triggerRef.current)) {
          setDisplayStart(startValue)
          setDisplayEnd(endValue)
        } else {
          // Use the DOM as ground truth: if EVERY spinbutton segment shows
          // a placeholder, the user cleared the entire widget.
          const segments = triggerRef.current?.querySelectorAll(
            '[role="spinbutton"]'
          )
          const allCleared =
            segments &&
            segments.length > 0 &&
            Array.from(segments).every(s =>
              s.matches('[data-placeholder="true"]')
            )

          let pending: CalendarDate[]
          if (allCleared) {
            pending = []
          } else {
            pending = compact([displayStartRef.current, displayEndRef.current])
          }

          const committed = compact([startValue, endValue])
          if (!rangeEqual(pending, committed)) {
            onChangeRef.current(pending)
          }
        }
      }
    }
    wasOpenRef.current = isOpen
  }, [isOpen, startValue, endValue])

  // When entering active mode, move focus to the focused calendar cell.
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
        setIsOpenState(false)
        setIsCalendarActive(false)
      },
      floatingSetFn: refs.setFloating,
      referenceSetFn: refs.setReference,
      restoreFocusFn: restoreFocusToField,
      excludeSelectors: [
        '[data-testid="stDateInputHeaderPickerPopover"]',
        '[data-testid="stDateInputQuickSelectPopover"]',
      ],
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

  const [isQuickSelectOpen, setIsQuickSelectOpen] = useState(false)
  const quickSelectTriggerRef = useRef<HTMLButtonElement | null>(null)
  const {
    setFloatingRef: setQuickSelectFloatingRef,
    setReferenceRef: setQuickSelectReferenceRef,
  } = useOverlayDismissal({
    isOpen: isQuickSelectOpen,
    onClose: () => setIsQuickSelectOpen(false),
    floatingSetFn: noop,
  })

  const setQuickSelectTrigger = useCallback(
    (node: HTMLButtonElement | null): void => {
      quickSelectTriggerRef.current = node
      setQuickSelectReferenceRef(node)
    },
    [setQuickSelectReferenceRef]
  )

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

  // Validates both range display values so editing one field doesn't
  // clear a still-invalid sibling's error.
  const validateBothFields = useCallback(
    (start: CalendarDate | null, end: CalendarDate | null): void => {
      const invalidDate =
        (start && validateDate(start, minDate, maxDate) ? start : null) ??
        (end && validateDate(end, minDate, maxDate) ? end : null)
      onValidate(invalidDate)
    },
    [minDate, maxDate, onValidate]
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
      validateBothFields(date, date ? displayEndRef.current : null)
      if (date) onFocusChange(date)
    },
    [onFocusChange, validateBothFields]
  )

  const handleEndFieldChange = useCallback(
    (date: CalendarDate | null): void => {
      if (date && !displayStartRef.current) return
      setDisplayEnd(date)
      validateBothFields(displayStartRef.current, date)
      if (date) onFocusChange(date)
    },
    [onFocusChange, validateBothFields]
  )

  const calendarValue = useMemo(
    () =>
      displayStart && displayEnd
        ? { start: displayStart, end: displayEnd }
        : null,
    [displayStart, displayEnd]
  )

  // When start===end, treat it as "first click of a new range" (anchor mode)
  // if a complete range was showing, or "second click" (complete the range
  // using displayStartRef as anchor) if we're already in anchor mode.
  const handleCalendarChange = useCallback(
    (range: { start: CalendarDate; end: CalendarDate }): void => {
      // Guard: once we've committed and initiated a close, ignore any
      // additional onChange fires from RAC's internal state reconciliation.
      if (skipCloseCommitRef.current) return

      if (datesEqual(range.start, range.end)) {
        if (displayEndRef.current) {
          // First click while a complete range is shown — enter anchor mode.
          // Calendar stays open for the second click (core two-click UX).
          inAnchorModeRef.current = true
          setDisplayStart(range.start)
          setDisplayEnd(null)
          onChange([range.start])
          return
        }
        if (inAnchorModeRef.current && displayStartRef.current) {
          // Second click — complete the range using the current start as anchor
          const anchor = displayStartRef.current
          inAnchorModeRef.current = false
          const [start, end] =
            anchor.compare(range.start) <= 0
              ? [anchor, range.start]
              : [range.start, anchor]
          setDisplayStart(start)
          setDisplayEnd(end)
          onChange([start, end])
          skipCloseCommitRef.current = true
          setIsOpenState(false)
          restoreFocusToField()
          setIsCalendarActive(false)
          return
        }
      }
      // Normal completed range (two distinct dates, or single-day when not
      // in anchor mode)
      inAnchorModeRef.current = false
      setDisplayStart(range.start)
      setDisplayEnd(range.end)
      onChange([range.start, range.end])
      skipCloseCommitRef.current = true
      setIsOpenState(false)
      restoreFocusToField()
      setIsCalendarActive(false)
    },
    [onChange, restoreFocusToField]
  )

  // Alt+ArrowDown enters active calendar mode; Tab from edge segments
  // closes the passive popover and lets focus leave the widget naturally.
  const handleFieldKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>): void => {
      if (e.altKey && e.key === "ArrowDown") {
        e.preventDefault()
        activeOriginRef.current = e.target as HTMLElement
        if (!isOpen) setIsOpenState(true)
        setIsCalendarActive(true)
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
        setIsOpenState(false)
      }
    },
    [isOpen]
  )

  // In active mode: Tab cycles focus within the popover (focus trap).
  // In passive mode: Tab moves to quick-select or closes the popover.
  // Scoped to popoverRef only — portaled month/year pickers and the
  // quick-select listbox self-dismiss on Tab (stopPropagation + restore
  // trigger focus in CalendarPopoverHeader / handleQuickSelectKeyDown).
  const handlePopoverKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>): void => {
      if (e.key !== "Tab") return

      if (!isCalendarActiveRef.current) {
        // Passive mode: existing behavior
        const quickSelectBtn = quickSelectTriggerRef.current
        if (
          !e.shiftKey &&
          quickSelectBtn &&
          !quickSelectBtn.contains(e.target as Node)
        ) {
          e.preventDefault()
          quickSelectBtn.focus()
          return
        }
        e.preventDefault()
        setIsOpenState(false)
        restoreFocusToField()
        return
      }

      // Active mode: cycle through focusable elements within the popover
      e.preventDefault()
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

  // First click of a new range (from empty/partial state)
  const handleAnchorSelect = useCallback(
    (date: CalendarDate): void => {
      if (inAnchorModeRef.current && datesEqual(displayStartRef.current, date))
        return
      inAnchorModeRef.current = true
      setDisplayStart(date)
      setDisplayEnd(null)
      onChange([date])
    },
    [onChange]
  )

  const handleClear = useCallback((): void => {
    inAnchorModeRef.current = false
    setDisplayStart(null)
    setDisplayEnd(null)
    onChange([])
  }, [onChange])

  const handleQuickSelect = useCallback(
    (presetId: string): void => {
      const preset = quickSelectPresets.find(p => p.id === presetId)
      if (!preset) return
      inAnchorModeRef.current = false
      setDisplayStart(preset.start)
      setDisplayEnd(preset.end)
      onChange([preset.start, preset.end])
      setIsQuickSelectOpen(false)
    },
    [quickSelectPresets, onChange]
  )

  const handleQuickSelectSelection = useCallback(
    (keys: "all" | Set<Key>): void => {
      if (keys === "all") return
      const key = [...keys][0]
      if (key) {
        handleQuickSelect(String(key))
      } else {
        handleClear()
        setIsQuickSelectOpen(false)
      }
    },
    [handleClear, handleQuickSelect]
  )

  const handleQuickSelectKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>): void => {
      if (e.key === "Tab") {
        e.preventDefault()
        e.stopPropagation()
        setIsQuickSelectOpen(false)
        quickSelectTriggerRef.current?.focus()
      }
    },
    []
  )

  const makeHandlePaste = useCallback(
    (
      currentValue: CalendarDate | null,
      setDisplay: (date: CalendarDate | null) => void,
      isStartField: boolean
    ) =>
      (e: ClipboardEvent<HTMLDivElement>): void => {
        if (disabled) return
        if (!isStartField && !displayStartRef.current) return
        const text = e.clipboardData.getData("text").trim()

        const fullDate = parsePastedDate(text, format)
        if (fullDate) {
          e.preventDefault()
          setDisplay(fullDate)
          onChange(
            compact([
              isStartField ? fullDate : displayStartRef.current,
              isStartField ? displayEndRef.current : fullDate,
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

        const base =
          currentValue ??
          (isStartField ? minDate : (displayStartRef.current ?? minDate))
        const newDate = base.set({ [partial.segmentType]: partial.value })
        if (newDate[partial.segmentType] !== partial.value) return
        setDisplay(newDate)
        onChange(
          compact([
            isStartField ? newDate : displayStartRef.current,
            isStartField ? displayEndRef.current : newDate,
          ])
        )
      },
    [disabled, format, minDate, onChange]
  )

  const handleStartPaste = useMemo(
    () => makeHandlePaste(displayStart, setDisplayStart, true),
    [makeHandlePaste, displayStart]
  )
  const handleEndPaste = useMemo(
    () => makeHandlePaste(displayEnd, setDisplayEnd, false),
    [makeHandlePaste, displayEnd]
  )

  // Synchronous commit on blur for form-submit races.
  // A field is "partially typed" when it has a MIX of filled and placeholder
  // segments. Fully cleared (all placeholders → []) and filled start with
  // empty end (→ [start]) are valid committable states.
  const handleBlur = useCallback(
    (e: FocusEvent<HTMLDivElement>): void => {
      if (e.currentTarget.contains(e.relatedTarget)) return
      if (!formCommit) return
      if (isCalendarActiveRef.current) return
      if (hasPartiallyTypedField(triggerRef.current)) return
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
        aria-keyshortcuts="Alt+ArrowDown"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={isOpen ? popoverId : undefined}
        data-testid="stDateInputField"
        data-disabled={disabled || undefined}
        data-has-error={error ? "" : undefined}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onClickCapture={handleClickCapture}
        onKeyDown={handleFieldKeyDown}
      >
        <I18nProvider locale="en-US">
          <StyledDateField $isRange data-range-field="start">
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
          <StyledDateField $isRange data-range-field="end">
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
        <StyledTrailingIcons>
          {error && (
            <StyledErrorIconContainer data-testid="stDateInputError">
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
            data-testid="stDateInputCalendar"
            onKeyDown={handlePopoverKeyDown}
            role={isCalendarActive ? "dialog" : undefined}
            aria-modal={isCalendarActive ? "true" : undefined}
            aria-label={isCalendarActive ? "Choose date range" : undefined}
            aria-describedby={isCalendarActive ? popoverDescId : undefined}
          >
            {isCalendarActive && (
              <StyledVisuallyHidden id={popoverDescId}>
                Use arrow keys to navigate dates. Enter to select. Escape to
                close.
              </StyledVisuallyHidden>
            )}
            <I18nProvider locale={safeLocale}>
              <StyledRangeCalendarRoot
                aria-label="Choose date range"
                value={calendarValue}
                onChange={handleCalendarChange}
                commitBehavior="reset"
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
            {enableQuickSelect && quickSelectPresets.length > 0 && (
              <StyledQuickSelectRow
                ref={quickSelectRef}
                data-testid="stDateInputQuickSelect"
              >
                <StyledQuickSelectLabel>Date range</StyledQuickSelectLabel>
                <StyledQuickSelectTrigger
                  ref={setQuickSelectTrigger}
                  $isPlaceholder={!activePreset}
                  aria-label="Quick select a date range"
                  aria-expanded={isQuickSelectOpen}
                  aria-haspopup="listbox"
                  onPress={() => setIsQuickSelectOpen(prev => !prev)}
                >
                  {activePresetLabel}
                  <StyledCalendarHeaderSelectChevron>
                    <KeyboardArrowDown size={theme.iconSizes.base} />
                  </StyledCalendarHeaderSelectChevron>
                </StyledQuickSelectTrigger>
                <StyledDropdownPopover
                  ref={setQuickSelectFloatingRef}
                  triggerRef={quickSelectTriggerRef}
                  isOpen={isQuickSelectOpen}
                  onOpenChange={setIsQuickSelectOpen}
                  isNonModal
                  placement="bottom end"
                  data-testid="stDateInputQuickSelectPopover"
                >
                  {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
                  <div onKeyDown={handleQuickSelectKeyDown}>
                    <StyledDropdownListBox
                      aria-label="Quick select a date range"
                      selectionMode="single"
                      disallowEmptySelection={!clearable}
                      selectedKeys={activePreset ? [activePreset.id] : []}
                      onSelectionChange={handleQuickSelectSelection}
                      autoFocus
                    >
                      {quickSelectPresets.map(preset => (
                        <StyledDropdownListBoxItem
                          key={preset.id}
                          id={preset.id}
                        >
                          {preset.label}
                        </StyledDropdownListBoxItem>
                      ))}
                    </StyledDropdownListBox>
                  </div>
                </StyledDropdownPopover>
              </StyledQuickSelectRow>
            )}
          </StyledCalendarPopover>
        </FloatingPortal>
      )}
    </StyledDateFieldContainer>
  )
}

export default memo(RangeDateInput)
