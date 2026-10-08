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
  type ClipboardEvent,
  type FocusEvent,
  type KeyboardEvent,
  memo,
  type MouseEvent,
  type ReactElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react"

import {
  DateRange,
  ErrorOutline,
  KeyboardArrowDown,
} from "@emotion-icons/material-outlined"
import { Cancel } from "@emotion-icons/material-rounded"
import { FloatingPortal } from "@floating-ui/react"
import type { CalendarDate } from "@internationalized/date"
import {
  CalendarGridBody,
  CalendarGridHeader,
  DateField,
  I18nProvider,
  type Key,
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

import {
  CalendarPopoverHeader,
  DATE_INPUT_HEADER_PICKER_POPOVER_CLASS,
} from "./CalendarPopoverHeader"
import {
  applyPartialSegmentToDate,
  calendarDateFromSegments,
  calendarDateToIso,
  datesEqual,
  getQuickSelectPresets,
  getSafeLocale,
  isValidSegmentValue,
  noop,
  parseDateFieldPaste,
  readCalendarDateFromField,
  SEGMENT_SELECTOR,
  validateDate,
} from "./dateInputUtils"
import {
  handlePassivePreviewFieldTab,
  isConcreteOutsideLeave,
  usePopoverInteractionFlag,
} from "./focusLeave"
import { ReorderedSegments } from "./ReorderedSegments"
import {
  StyledCalendarButton,
  StyledCalendarCell,
  StyledCalendarGrid,
  StyledCalendarHeaderCell,
  StyledCalendarHeaderSelectChevron,
  StyledCalendarPopover,
  StyledClearButton,
  StyledDateField,
  StyledDateFieldContainer,
  StyledDateFieldsScroller,
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

/** Marks the quick-select popover so the calendar ignores nested clicks and Escape. */
const DATE_INPUT_QUICK_SELECT_POPOVER_CLASS = "stDateInputQuickSelectPopover"

const POPOVER_EXCLUDE_SELECTORS = [
  `.${DATE_INPUT_HEADER_PICKER_POPOVER_CLASS}`,
  `.${DATE_INPUT_QUICK_SELECT_POPOVER_CLASS}`,
] as const

interface RangeDateInputProps {
  startValue: CalendarDate | null
  endValue: CalendarDate | null
  onChange: (dates: CalendarDate[]) => void
  minDate: CalendarDate
  maxDate: CalendarDate | undefined
  format: string
  disabled: boolean
  clearable: boolean
  required: boolean
  /** Skip parent→display sync while dirty so a sibling rerun does not restore
   * the last accepted range over an in-progress edit. */
  suppressCommittedSync: boolean
  onEdit: (isoValues: string[]) => void
  label: string
  error: string | null
  locale: string
  isInSidebar: boolean
  enableQuickSelect: boolean
  focusedValue: CalendarDate
  onFocusChange: (value: CalendarDate) => void
  onValidate: (date: CalendarDate | null) => void
  onClose: (hasPlaceholderSegments: boolean) => void
  /** In a form, commit the pending range with the same required/range rules
   * as `onChange`, including a synchronous WidgetStateManager write so
   * submit sees the staged value. Undefined when not in a form. */
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
  // Latest calendar state for the effect. `state` is a new object every render,
  // so the effect reads it here instead of listing `state` as a dependency.
  const stateRef = useRef(state)
  stateRef.current = state
  const anchorDate = state?.anchorDate ?? null
  const prevAnchorRef = useRef<CalendarDate | null>(null)
  const prevSeedRef = useRef<CalendarDate | null>(null)

  useEffect(() => {
    const calendarState = stateRef.current
    // (Re-)seed when seedAnchor changes to a new non-null value (handles
    // both initial mount and user editing the start field while the calendar
    // is open with displayEnd === null).
    if (seedAnchor && !datesEqual(seedAnchor, prevSeedRef.current)) {
      prevSeedRef.current = seedAnchor
      prevAnchorRef.current = seedAnchor
      calendarState?.setAnchorDate(seedAnchor)
      return
    }
    if (!seedAnchor) {
      prevSeedRef.current = null
      if (prevAnchorRef.current) {
        calendarState?.setAnchorDate(null)
      }
    }
    if (anchorDate && !prevAnchorRef.current) {
      onAnchorSelect(anchorDate)
    }
    prevAnchorRef.current = anchorDate
  }, [anchorDate, onAnchorSelect, seedAnchor])

  return null
}

function compact(dates: (CalendarDate | null)[]): CalendarDate[] {
  return dates.filter((d): d is CalendarDate => d !== null)
}

function isFieldPartiallyTyped(field: Element): boolean {
  const segs = field.querySelectorAll('[role="spinbutton"]')
  const placeholders = field.querySelectorAll(
    '[role="spinbutton"][data-placeholder="true"]'
  )
  return placeholders.length > 0 && placeholders.length < segs.length
}

function isFieldFullyCleared(field: Element): boolean {
  const segs = field.querySelectorAll('[role="spinbutton"]')
  if (segs.length === 0) {
    return false
  }
  return Array.from(segs).every(segment => {
    const text = segment.textContent?.trim() ?? ""
    return segment.matches('[data-placeholder="true"]') && !/^\d+$/.test(text)
  })
}

/** DOM digits if present; skip stale display state while the field is
 * mid-edit (some segments still placeholders). A fully cleared field is
 * explicit `null` — do not fall back to display, because placeholder text
 * also makes `readCalendarDateFromField` return null. Otherwise fill from
 * display when React Aria has not flushed `onChange` yet. */
function resolveRangeBound(
  field: Element | null,
  display: CalendarDate | null
): CalendarDate | null {
  const fromDom = readCalendarDateFromField(field)
  if (field && isFieldPartiallyTyped(field)) {
    return fromDom
  }
  if (field && isFieldFullyCleared(field)) {
    return null
  }
  return fromDom ?? display
}

/** Last-resort parse of a complete range from the six painted spinbuttons.
 * Lenient so non-digit wrapper nodes do not abort a complete painted range. */
function readCompleteRangeFromSpinbuttons(
  container: HTMLElement | null
): CalendarDate[] {
  const buttons = container?.querySelectorAll('[role="spinbutton"]')
  if (!buttons || buttons.length < 6) {
    return []
  }
  const nodes = Array.from(buttons)
  const start = calendarDateFromSegments(nodes.slice(0, 3), { lenient: true })
  const end = calendarDateFromSegments(nodes.slice(3, 6), { lenient: true })
  return start && end ? [start, end] : []
}

/** Commit payload for close/blur. Prefer painted segment digits so a typed
 * complete range commits even when `onChange` has not flushed; ignore
 * controlled display while a field is only partially typed. */
function getPendingRange(
  container: HTMLElement | null,
  displayStart: CalendarDate | null,
  displayEnd: CalendarDate | null
): CalendarDate[] {
  const start = resolveRangeBound(
    container?.querySelector('[data-range-field="start"]') ?? null,
    displayStart
  )
  const end = resolveRangeBound(
    container?.querySelector('[data-range-field="end"]') ?? null,
    displayEnd
  )
  if (start && end) {
    return [start, end]
  }
  const fromButtons = readCompleteRangeFromSpinbuttons(container)
  if (fromButtons.length === 2) {
    return fromButtons
  }
  // A range cannot start from an end-only paint: handleEndFieldChange
  // ignores end typing when start is empty, so compacting that date would
  // wrongly promote it to start.
  if (!start) {
    return []
  }
  return compact([start, end])
}

function isRangeFullyCleared(container: HTMLElement | null): boolean {
  const segments = container?.querySelectorAll('[role="spinbutton"]')
  return (
    !!segments &&
    segments.length > 0 &&
    Array.from(segments).every(segment => {
      const text = segment.textContent?.trim() ?? ""
      return (
        segment.matches('[data-placeholder="true"]') && !/^\d+$/.test(text)
      )
    })
  )
}

function getClosePendingRange(
  container: HTMLElement | null,
  displayStart: CalendarDate | null,
  displayEnd: CalendarDate | null
): CalendarDate[] {
  if (isRangeFullyCleared(container)) {
    return []
  }
  const pending = getPendingRange(container, displayStart, displayEnd)
  if (pending.length === 2) {
    return pending
  }
  // DateField onChange may have both bounds while this frame's DOM parse
  // is still incomplete. Skip this when a field is mid-edit so a partial
  // clear still reverts, and when a field is fully cleared so a stale end
  // is not restored.
  if (displayStart && displayEnd && !hasPartiallyTypedField(container)) {
    const startField =
      container?.querySelector('[data-range-field="start"]') ?? null
    const endField =
      container?.querySelector('[data-range-field="end"]') ?? null
    if (
      !(startField && isFieldFullyCleared(startField)) &&
      !(endField && isFieldFullyCleared(endField))
    ) {
      return [displayStart, displayEnd]
    }
  }
  return pending
}

/** True when the user is mid-edit and we cannot yet parse a complete range. */
function shouldRevertPartialRange(
  container: HTMLElement | null,
  pending: CalendarDate[]
): boolean {
  return pending.length !== 2 && hasPartiallyTypedField(container)
}

function rangeEqual(a: CalendarDate[], b: CalendarDate[]): boolean {
  if (a.length !== b.length) return false
  return a.every((d, i) => datesEqual(d, b[i]))
}

function rangeIsoKey(dates: CalendarDate[]): string {
  return dates.map(calendarDateToIso).join(",")
}

/** True when close/blur should notify the parent, including a full clear
 * that matches an already-empty committed value after a real edit.
 * Callers must clear `hasEdited` after the pending edit is committed or
 * discarded so later empty blurs do not notify again. */
function shouldNotifyRangePending(
  pending: CalendarDate[],
  committed: CalendarDate[],
  hasEdited: boolean
): boolean {
  return !rangeEqual(pending, committed) || (pending.length === 0 && hasEdited)
}

function hasPartiallyTypedField(container: HTMLElement | null): boolean {
  const fields = container?.querySelectorAll("[data-range-field]")
  if (!fields) return false
  return Array.from(fields).some(isFieldPartiallyTyped)
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
  required,
  suppressCommittedSync,
  onEdit,
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
  const calendarButtonRef = useRef<HTMLButtonElement | null>(null)
  const skipCloseCommitRef = useRef(false)
  const lastNotifiedRangeKeyRef = useRef("")
  // A full clear that matches an empty default still needs to notify the
  // parent so a required field can paint.
  const hasEditedRef = useRef(false)
  // Guards against `handleFocus` reopening the popover during programmatic
  // focus restoration (see `restoreFocusToField` below).
  const isRestoringFocusRef = useRef(false)
  // Capture whether form reset must restore focus before its remount removes
  // the focused segment.
  const shouldRestoreFocusRef = useRef(false)

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
  // First-click start this widget last committed. That commit echoes back
  // through the value props and must not cancel the in-progress selection.
  // The echo path only reads this ref, so a re-run with the same props
  // (including Strict Mode) reaches the same conclusion.
  const selfCommittedAnchorRef = useRef<CalendarDate | null>(null)

  // --- Two-layer state (matches SingleDateInput pattern) ---
  const [displayStart, setDisplayStart] = useState<CalendarDate | null>(
    startValue
  )
  const [displayEnd, setDisplayEnd] = useState<CalendarDate | null>(endValue)

  // Sync display state when the committed range changes, and cancel an
  // in-progress selection unless this widget's first-click commit is echoing.
  const [prevStart, setPrevStart] = useState(startValue)
  const [prevEnd, setPrevEnd] = useState(endValue)
  if (prevStart !== startValue || prevEnd !== endValue) {
    // A first-click commit returns as [start] with no end. Any other change,
    // including a complete range with the same start, begins a new interaction.
    const isAnchorCommitEcho =
      selfCommittedAnchorRef.current !== null &&
      endValue === null &&
      datesEqual(startValue, selfCommittedAnchorRef.current)
    if (!isAnchorCommitEcho) {
      // Render-time ref writes survive a discarded render. Clearing is the
      // fail-safe outcome: handlers cannot retain a superseded interaction.
      inAnchorModeRef.current = false
      selfCommittedAnchorRef.current = null
    }
    // Script/session_state updates replace the last user-notified range.
    // Keep the key when committed props echo the same range so close/blur
    // and a late DateField onChange do not double-write.
    const committedKey = rangeIsoKey(compact([startValue, endValue]))
    if (committedKey !== lastNotifiedRangeKeyRef.current) {
      lastNotifiedRangeKeyRef.current = committedKey
    }
  }
  if (prevStart !== startValue) {
    const applyDisplay =
      !suppressCommittedSync ||
      (startValue !== null && !datesEqual(prevStart, startValue))
    if (applyDisplay) {
      setPrevStart(startValue)
      setDisplayStart(startValue)
    }
  }
  if (prevEnd !== endValue) {
    const applyDisplay =
      !suppressCommittedSync ||
      (endValue !== null && !datesEqual(prevEnd, endValue))
    if (applyDisplay) {
      setPrevEnd(endValue)
      setDisplayEnd(endValue)
    }
  }

  // Form clear: display may have diverged without value changing
  const [prevResetKey, setPrevResetKey] = useState(formResetKey)
  if (prevResetKey !== formResetKey) {
    setPrevResetKey(formResetKey)
    setDisplayStart(startValue)
    setDisplayEnd(endValue)
    inAnchorModeRef.current = false
    selfCommittedAnchorRef.current = null
    activeOriginRef.current = null
    hasEditedRef.current = false
    // Reading the DOM during render is safe here because this write sits inside
    // the same condition that advances `prevResetKey`: a discarded render
    // retries against live focus rather than keeping a stale `true`. Strict
    // Mode's double render sees the same focus.
    shouldRestoreFocusRef.current = !!triggerRef.current?.contains(
      document.activeElement
    )
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
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const [isOpen, setIsOpenState] = useState(false)
  const isOpenRef = useRef(isOpen)
  isOpenRef.current = isOpen
  const popoverInteractionRef = usePopoverInteractionFlag(
    isOpen,
    popoverRef,
    POPOVER_EXCLUDE_SELECTORS
  )

  const wasOpenRef = useRef(isOpen)
  useEffect(() => {
    if (wasOpenRef.current && !isOpen) {
      inAnchorModeRef.current = false
      selfCommittedAnchorRef.current = null
      if (skipCloseCommitRef.current) {
        skipCloseCommitRef.current = false
      } else {
        const pending = getClosePendingRange(
          triggerRef.current,
          displayStartRef.current,
          displayEndRef.current
        )
        if (shouldRevertPartialRange(triggerRef.current, pending)) {
          setDisplayStart(startValue)
          setDisplayEnd(endValue)
          hasEditedRef.current = false
          onCloseRef.current(true)
        } else {
          // Range mode intentionally commits [] on full clear (including
          // non-clearable widgets); SingleDateInput reverts to last committed.
          const committed = compact([startValue, endValue])
          if (
            shouldNotifyRangePending(pending, committed, hasEditedRef.current)
          ) {
            hasEditedRef.current = false
            lastNotifiedRangeKeyRef.current = rangeIsoKey(pending)
            onChangeRef.current(pending)
          }
        }
      }
    }
    wasOpenRef.current = isOpen
  }, [isOpen, startValue, endValue])

  // clear_on_submit remounts the DateFields via formResetKey but keeps this
  // instance. Drop the last-notified key so re-entering the same range writes.
  useEffect(() => {
    lastNotifiedRangeKeyRef.current = ""
    skipCloseCommitRef.current = false
  }, [formResetKey])

  // Restore focus to the first editable segment after the form-reset remount.
  // Suppress handleFocus while focusin dispatches synchronously so the calendar
  // does not reopen; clearing the guard after a frame could stall in hidden tabs.
  useEffect(() => {
    if (!shouldRestoreFocusRef.current) return
    shouldRestoreFocusRef.current = false
    isRestoringFocusRef.current = true
    triggerRef.current?.querySelector<HTMLElement>(SEGMENT_SELECTOR)?.focus()
    isRestoringFocusRef.current = false
  }, [formResetKey])

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

  const { floatingStyles, setFloating, setReference } =
    useFloatingOverlay(overlayOptions)

  // Returns focus to the control that opened the calendar after it closes:
  // - Calendar button already focused (e.g. Escape after focusing it): leave it.
  // - Active mode: the element recorded in `activeOriginRef`.
  // - Passive mode: the last date segment.
  const restoreFocusToField = useCallback((): void => {
    isRestoringFocusRef.current = true
    if (!calendarButtonRef.current?.contains(document.activeElement)) {
      if (isCalendarActiveRef.current && activeOriginRef.current) {
        activeOriginRef.current.focus()
      } else {
        const segments = triggerRef.current?.querySelectorAll<HTMLElement>(
          '[role="spinbutton"]'
        )
        const lastSegment = segments ? Array.from(segments).at(-1) : undefined
        if (lastSegment) {
          lastSegment.focus()
        } else {
          triggerRef.current?.focus()
        }
      }
    }
    // focus() dispatches focusin synchronously. Clear the guard immediately so
    // a later click can reopen the calendar. Waiting a frame can stall in a
    // hidden tab and swallow that click.
    isRestoringFocusRef.current = false
  }, [])

  const { setFloatingRef: setDismissalFloatingRef, setReferenceRef } =
    useOverlayDismissal({
      isOpen,
      onClose: () => {
        setIsOpenState(false)
        setIsCalendarActive(false)
        // Calendar click-to-commit and field blur already notified the parent.
        if (skipCloseCommitRef.current) {
          return
        }
        // Commit before the close effect (after paint). Escape after typing
        // does not blur, so this is the synchronous path for a complete range.
        const pending = getClosePendingRange(
          triggerRef.current,
          displayStartRef.current,
          displayEndRef.current
        )
        if (shouldRevertPartialRange(triggerRef.current, pending)) {
          // Will revert on next render. Clear pending now so a concurrent
          // form submit does not commit the discarded partial edit.
          hasEditedRef.current = false
          onCloseRef.current(true)
        } else {
          const committed = compact([startValue, endValue])
          const isRealClear =
            pending.length === 0 && isRangeFullyCleared(triggerRef.current)
          // If this frame could not parse a complete range and the field is
          // not actually cleared, do not stage [] or latch skipCloseCommit.
          // The close effect retries after paint once React Aria flushes.
          if (
            (pending.length === 2 || isRealClear) &&
            shouldNotifyRangePending(pending, committed, hasEditedRef.current)
          ) {
            hasEditedRef.current = false
            if (formCommit) {
              formCommit(pending)
            } else {
              onChangeRef.current(pending)
            }
            skipCloseCommitRef.current = true
            lastNotifiedRangeKeyRef.current = rangeIsoKey(pending)
          }
        }
      },
      floatingSetFn: setFloating,
      referenceSetFn: setReference,
      restoreFocusFn: restoreFocusToField,
      // Exclude the month/year and quick-select popovers so clicks and Escape
      // inside them do not dismiss the calendar.
      excludeSelectors: [...POPOVER_EXCLUDE_SELECTORS],
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

  // Opens the passive preview when focus enters a date segment. Focus on the
  // clear or calendar button is ignored so those controls do not reopen it.
  const handleFocus = useCallback(
    (e: FocusEvent<HTMLDivElement>): void => {
      if (isRestoringFocusRef.current) return
      if (clearButtonRef.current?.contains(e.target)) return
      if (calendarButtonRef.current?.contains(e.target)) return
      if (!disabled) setIsOpenState(true)
    },
    [disabled]
  )

  // Ignore clear and calendar clicks so they do not reopen a passive popover.
  // This capture handler runs before those buttons' own click handlers.
  const handleClickCapture = useCallback(
    (e: MouseEvent<HTMLDivElement>): void => {
      if (clearButtonRef.current?.contains(e.target as Node)) return
      if (calendarButtonRef.current?.contains(e.target as Node)) return
      // Pointer-only: active mode enters via rAF, so handleFocus can't reset
      // it without breaking Tab cycling inside the calendar.
      setIsCalendarActive(false)
      if (!isRestoringFocusRef.current && !disabled) setIsOpenState(true)
    },
    [disabled]
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
      displayStartRef.current = date
      setDisplayStart(date)
      if (!date) {
        displayEndRef.current = null
        setDisplayEnd(null)
      }
      const pending = compact([date, date ? displayEndRef.current : null])
      hasEditedRef.current = true
      onEdit(pending.map(calendarDateToIso))
      validateBothFields(date, date ? displayEndRef.current : null)
      if (date) onFocusChange(date)
      // Escape can close before React Aria flushes onChange. Commit here if
      // both bounds are now complete and close/blur did not already notify.
      if (
        !isOpenRef.current &&
        date &&
        displayEndRef.current &&
        rangeIsoKey([date, displayEndRef.current]) !==
          lastNotifiedRangeKeyRef.current
      ) {
        hasEditedRef.current = false
        lastNotifiedRangeKeyRef.current = rangeIsoKey([
          date,
          displayEndRef.current,
        ])
        onChangeRef.current([date, displayEndRef.current])
      }
    },
    [onEdit, onFocusChange, validateBothFields]
  )

  const handleEndFieldChange = useCallback(
    (date: CalendarDate | null): void => {
      displayEndRef.current = date
      setDisplayEnd(date)
      if (date && !displayStartRef.current) {
        return
      }
      hasEditedRef.current = true
      onEdit(compact([displayStartRef.current, date]).map(calendarDateToIso))
      validateBothFields(displayStartRef.current, date)
      if (date) onFocusChange(date)
      if (
        !isOpenRef.current &&
        displayStartRef.current &&
        date &&
        rangeIsoKey([displayStartRef.current, date]) !==
          lastNotifiedRangeKeyRef.current
      ) {
        hasEditedRef.current = false
        lastNotifiedRangeKeyRef.current = rangeIsoKey([
          displayStartRef.current,
          date,
        ])
        onChangeRef.current([displayStartRef.current, date])
      }
    },
    [onEdit, onFocusChange, validateBothFields]
  )

  // When required, incomplete ranges stay in local display until close/blur.
  const emitRangeSelection = useCallback(
    (dates: CalendarDate[]): void => {
      if (required && dates.length !== 2) {
        onEdit(dates.map(calendarDateToIso))
        return
      }
      hasEditedRef.current = false
      onChange(dates)
    },
    [onChange, onEdit, required]
  )

  // Null when start > end prevents RangeCalendar from rewriting state
  // with an inverted range during in-progress segment edits.
  const calendarValue = useMemo(
    () =>
      displayStart && displayEnd && displayStart.compare(displayEnd) <= 0
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
          selfCommittedAnchorRef.current = range.start
          setDisplayStart(range.start)
          setDisplayEnd(null)
          emitRangeSelection([range.start])
          return
        }
        if (inAnchorModeRef.current && displayStartRef.current) {
          // Second click — complete the range using the current start as anchor
          const anchor = displayStartRef.current
          inAnchorModeRef.current = false
          selfCommittedAnchorRef.current = null
          const [start, end] =
            anchor.compare(range.start) <= 0
              ? [anchor, range.start]
              : [range.start, anchor]
          setDisplayStart(start)
          setDisplayEnd(end)
          hasEditedRef.current = false
          onChange([start, end])
          skipCloseCommitRef.current = true
          lastNotifiedRangeKeyRef.current = rangeIsoKey([start, end])
          setIsOpenState(false)
          restoreFocusToField()
          setIsCalendarActive(false)
          return
        }
      }
      // Normal completed range (two distinct dates, or single-day when not
      // in anchor mode)
      inAnchorModeRef.current = false
      selfCommittedAnchorRef.current = null
      setDisplayStart(range.start)
      setDisplayEnd(range.end)
      hasEditedRef.current = false
      onChange([range.start, range.end])
      skipCloseCommitRef.current = true
      lastNotifiedRangeKeyRef.current = rangeIsoKey([range.start, range.end])
      setIsOpenState(false)
      restoreFocusToField()
      setIsCalendarActive(false)
    },
    [emitRangeSelection, onChange, restoreFocusToField]
  )

  // Passive preview stays open on Tab to the calendar button; closes on leave.
  // Alt+ArrowDown opens the active calendar.
  const handleFieldKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>): void => {
      if (e.key === "Escape") {
        // type_date and keyboard users commit with Escape even when the
        // calendar is not open (no overlay onClose / close effect).
        const pending = getClosePendingRange(
          triggerRef.current ?? e.currentTarget,
          displayStartRef.current,
          displayEndRef.current
        )
        if (pending.length === 2) {
          const committed = compact([startValue, endValue])
          const pendingKey = rangeIsoKey(pending)
          if (
            pendingKey !== lastNotifiedRangeKeyRef.current &&
            shouldNotifyRangePending(pending, committed, hasEditedRef.current)
          ) {
            hasEditedRef.current = false
            lastNotifiedRangeKeyRef.current = pendingKey
            if (formCommit) {
              formCommit(pending)
            } else {
              onChangeRef.current(pending)
            }
            if (isOpen) {
              skipCloseCommitRef.current = true
            }
          }
        }
        if (isOpen) {
          setIsOpenState(false)
        }
      }

      if (e.altKey && e.key === "ArrowDown") {
        e.preventDefault()
        activeOriginRef.current = e.target as HTMLElement
        if (!isOpen) setIsOpenState(true)
        setIsCalendarActive(true)
        return
      }

      if (e.key !== "Tab" || !isOpen) return

      const closePreview = (): void => {
        setIsOpenState(false)
        setIsCalendarActive(false)
      }
      handlePassivePreviewFieldTab(
        e,
        {
          field: triggerRef.current,
          calendarButton: calendarButtonRef.current,
          popover: popoverRef.current,
          excludeSelectors: POPOVER_EXCLUDE_SELECTORS,
          segmentSelector: SEGMENT_SELECTOR,
        },
        { immediate: closePreview, afterFocusSettles: closePreview }
      )
    },
    [isOpen, startValue, endValue, formCommit]
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
      selfCommittedAnchorRef.current = date
      setDisplayStart(date)
      setDisplayEnd(null)
      emitRangeSelection([date])
    },
    [emitRangeSelection]
  )

  const handleClear = useCallback((): void => {
    inAnchorModeRef.current = false
    selfCommittedAnchorRef.current = null
    setDisplayStart(null)
    setDisplayEnd(null)
    hasEditedRef.current = false
    onChange([])
  }, [onChange])

  const handleCalendarButtonClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>): void => {
      e.preventDefault()
      e.stopPropagation()
      if (disabled) return
      if (isOpen && isCalendarActive) {
        setIsOpenState(false)
        setIsCalendarActive(false)
        restoreFocusToField()
        return
      }
      const focusedInField =
        document.activeElement instanceof HTMLElement &&
        triggerRef.current?.contains(document.activeElement)
          ? document.activeElement
          : undefined
      // Focus returns here when the dialog closes: the focused field control, or
      // the calendar button itself (a pointer click doesn't focus it, since
      // mousedown is prevented).
      activeOriginRef.current =
        focusedInField ?? calendarButtonRef.current ?? null
      if (!isOpen) setIsOpenState(true)
      setIsCalendarActive(true)
    },
    [disabled, isOpen, isCalendarActive, restoreFocusToField]
  )

  const handleQuickSelect = useCallback(
    (presetId: string): void => {
      const preset = quickSelectPresets.find(p => p.id === presetId)
      if (!preset) return
      inAnchorModeRef.current = false
      selfCommittedAnchorRef.current = null
      setDisplayStart(preset.start)
      setDisplayEnd(preset.end)
      hasEditedRef.current = false
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
        const target = e.target as HTMLElement
        const segmentType =
          target.getAttribute("role") === "spinbutton"
            ? target.getAttribute("data-type")
            : null

        const parsed = parseDateFieldPaste(text, format, {
          // A whole-range paste replaces both endpoints only from the start field.
          // The end field continues to accept a single date or segment.
          allowRangePaste: isStartField,
          segmentType,
        })
        if (!parsed) return
        e.preventDefault()

        if (parsed.kind === "range") {
          inAnchorModeRef.current = false
          selfCommittedAnchorRef.current = null
          const [start, end] =
            parsed.start.compare(parsed.end) <= 0
              ? [parsed.start, parsed.end]
              : [parsed.end, parsed.start]
          setDisplayStart(start)
          setDisplayEnd(end)
          hasEditedRef.current = false
          onChange([start, end])
          return
        }

        if (parsed.kind === "date") {
          setDisplay(parsed.date)
          const next = compact([
            isStartField ? parsed.date : displayStartRef.current,
            isStartField ? displayEndRef.current : parsed.date,
          ])
          emitRangeSelection(next)
          return
        }

        if (!isValidSegmentValue(parsed.segmentType, parsed.value)) return

        const base =
          currentValue ??
          (isStartField ? minDate : (displayStartRef.current ?? minDate))
        const newDate = applyPartialSegmentToDate(base, parsed)
        if (!newDate) return
        setDisplay(newDate)
        const next = compact([
          isStartField ? newDate : displayStartRef.current,
          isStartField ? displayEndRef.current : newDate,
        ])
        emitRangeSelection(next)
      },
    [disabled, emitRangeSelection, format, minDate, onChange]
  )

  const handleStartPaste = useMemo(
    () => makeHandlePaste(displayStart, setDisplayStart, true),
    [makeHandlePaste, displayStart]
  )
  const handleEndPaste = useMemo(
    () => makeHandlePaste(displayEnd, setDisplayEnd, false),
    [makeHandlePaste, displayEnd]
  )

  // Commit buffered edits when focus leaves the field (matches TimeInput).
  // Also writes to WidgetStateManager synchronously when inside a form so a
  // concurrent Submit click reads the correct value.
  const handleBlur = useCallback(
    (e: FocusEvent<HTMLDivElement>): void => {
      // Safari fires field blur on popover mousedown before click — not a leave.
      if (popoverInteractionRef.current) {
        popoverInteractionRef.current = false
        return
      }
      if (e.currentTarget.contains(e.relatedTarget)) return
      if (isCalendarActiveRef.current) return
      // skipCloseCommitRef only when this blur commits (incomplete closes revert).
      let closedByBlur = false
      if (isOpen) {
        if (
          isConcreteOutsideLeave(e.relatedTarget, {
            popover: popoverRef.current,
            excludeSelectors: POPOVER_EXCLUDE_SELECTORS,
          })
        ) {
          closedByBlur = true
          setIsOpenState(false)
          setIsCalendarActive(false)
        } else {
          // null / inside popover: next-frame Tab or outside click closes.
          return
        }
      }
      if (skipCloseCommitRef.current) return
      const pending = getClosePendingRange(
        triggerRef.current,
        displayStartRef.current,
        displayEndRef.current
      )
      if (
        pending.length === 2 &&
        rangeIsoKey(pending) === lastNotifiedRangeKeyRef.current
      ) {
        return
      }
      if (shouldRevertPartialRange(triggerRef.current, pending)) {
        hasEditedRef.current = false
        onCloseRef.current(true)
        return
      }
      const committed = compact([startValue, endValue])
      if (
        !shouldNotifyRangePending(pending, committed, hasEditedRef.current)
      ) {
        return
      }
      hasEditedRef.current = false
      lastNotifiedRangeKeyRef.current = rangeIsoKey(pending)
      if (closedByBlur) {
        // This blur closed the popover. Skip the close-effect commit so an
        // optional empty-default range does not write twice.
        skipCloseCommitRef.current = true
      }
      if (formCommit) {
        formCommit(pending)
      } else {
        onChangeRef.current(pending)
      }
    },
    [formCommit, isOpen, startValue, endValue, popoverInteractionRef]
  )

  const hasValue = displayStart !== null || displayEnd !== null

  return (
    <StyledDateFieldContainer>
      <StyledDateInputWrapper
        ref={setTriggerRef}
        aria-keyshortcuts="Alt+ArrowDown"
        data-testid="stDateInputField"
        data-disabled={disabled || undefined}
        data-has-error={error ? "" : undefined}
        aria-required={required ? true : undefined}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onClickCapture={handleClickCapture}
        onKeyDown={handleFieldKeyDown}
      >
        <StyledDateFieldsScroller data-testid="stDateInputFieldsScroller">
          <I18nProvider locale="en-US">
            <StyledDateField $isRange data-range-field="start">
              <div onPaste={handleStartPaste}>
                <DateField
                  // Remount on form clear because React Aria retains incomplete
                  // segment text when the controlled value has not changed.
                  key={formResetKey}
                  aria-label={`${label} start date`}
                  aria-describedby={error ? errorId : undefined}
                  isInvalid={!!error}
                  // Keep invalid state tied to Streamlit's error, not native
                  // constraint validation. Required is exposed on the field
                  // group that contains the focused segments, not via RAC
                  // `isRequired` (which would mark empty as invalid).
                  validationBehavior="aria"
                  value={displayStart}
                  onChange={handleStartFieldChange}
                  minValue={minDate}
                  maxValue={maxDate}
                  shouldForceLeadingZeros
                  isDisabled={disabled}
                >
                  <ReorderedSegments
                    format={format}
                    isRange
                    required={required}
                  />
                </DateField>
              </div>
            </StyledDateField>
            <StyledRangeSeparator aria-hidden="true">–</StyledRangeSeparator>
            <StyledDateField $isRange data-range-field="end">
              <div onPaste={handleEndPaste}>
                <DateField
                  key={formResetKey}
                  aria-label={`${label} end date`}
                  aria-describedby={error ? errorId : undefined}
                  isInvalid={!!error}
                  validationBehavior="aria"
                  value={displayEnd}
                  onChange={handleEndFieldChange}
                  minValue={minDate}
                  maxValue={maxDate}
                  shouldForceLeadingZeros
                  isDisabled={disabled}
                >
                  <ReorderedSegments
                    format={format}
                    isRange
                    required={required}
                  />
                </DateField>
              </div>
            </StyledDateField>
          </I18nProvider>
        </StyledDateFieldsScroller>
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
          <StyledCalendarButton
            ref={calendarButtonRef}
            type="button"
            onClick={handleCalendarButtonClick}
            aria-label="Choose date range"
            aria-haspopup="dialog"
            aria-expanded={isCalendarActive}
            aria-controls={isCalendarActive ? popoverId : undefined}
            data-testid="stDateInputCalendarButton"
            disabled={disabled}
            onMouseDown={e => e.preventDefault()}
          >
            <Icon content={DateRange} size="base" />
          </StyledCalendarButton>
        </StyledTrailingIcons>
        {error && (
          <StyledVisuallyHidden id={errorId} role="alert">
            {error.replaceAll("**", "")}
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
                    <KeyboardArrowDown
                      size={theme.iconSizes.base}
                      aria-hidden="true"
                    />
                  </StyledCalendarHeaderSelectChevron>
                </StyledQuickSelectTrigger>
                <StyledDropdownPopover
                  className={DATE_INPUT_QUICK_SELECT_POPOVER_CLASS}
                  ref={setQuickSelectFloatingRef}
                  triggerRef={quickSelectTriggerRef}
                  isOpen={isQuickSelectOpen}
                  onOpenChange={setIsQuickSelectOpen}
                  isNonModal
                  placement="bottom end"
                  data-testid="stDateInputQuickSelectPopover"
                >
                  {/* oxlint-disable-next-line jsx-a11y/no-static-element-interactions */}
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
