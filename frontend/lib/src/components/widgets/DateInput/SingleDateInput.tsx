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
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react"

import { CalendarToday, ErrorOutline } from "@emotion-icons/material-outlined"
import { Cancel } from "@emotion-icons/material-rounded"
import { FloatingPortal } from "@floating-ui/react"
import type { CalendarDate } from "@internationalized/date"
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
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import {
  SHIFT_VIEWPORT_PADDING,
  useFloatingOverlay,
} from "~lib/hooks/useFloatingOverlay"
import { useOverlayDismissal } from "~lib/hooks/useOverlayDismissal"
import { convertRemToPx } from "~lib/theme/utils"
import { isNullOrUndefined } from "~lib/util/utils"

import {
  CalendarPopoverHeader,
  DATE_INPUT_HEADER_PICKER_POPOVER_CLASS,
} from "./CalendarPopoverHeader"
import {
  applyPartialSegmentToDate,
  calendarDateToIso,
  datesEqual,
  getSafeLocale,
  isValidSegmentValue,
  parseDateFieldPaste,
  SEGMENT_SELECTOR,
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
  StyledCalendarPopover,
  StyledCalendarRoot,
  StyledClearButton,
  StyledDateField,
  StyledDateFieldContainer,
  StyledDateFieldsScroller,
  StyledDateInputWrapper,
  StyledErrorIconContainer,
  StyledTrailingIcons,
  StyledVisuallyHidden,
} from "./styled-components"

const POPOVER_EXCLUDE_SELECTORS = [
  `.${DATE_INPUT_HEADER_PICKER_POPOVER_CLASS}`,
] as const

interface SingleDateInputProps {
  value: CalendarDate | null
  onChange: (value: CalendarDate | null) => void
  minDate: CalendarDate
  maxDate: CalendarDate | undefined
  format: string
  disabled: boolean
  clearable: boolean
  /** When true, a full keyboard clear notifies the parent instead of reverting.
   * True for empty defaults that are not disabled, including required fields. */
  allowEmptyCommit: boolean
  required: boolean
  /** Skip parent→display sync while dirty so a sibling rerun does not restore
   * the last accepted date over an in-progress edit. */
  suppressCommittedSync: boolean
  onEdit: (isoValues: string[]) => void
  label: string
  error: string | null
  /** App-wide locale (`LibConfigContext`), used only to localize the
   * calendar popover's month/weekday text — the typed field is always
   * pinned to `en-US` (see `I18nProvider locale="en-US"` below). */
  locale: string
  isInSidebar: boolean
  focusedValue: CalendarDate
  onFocusChange: (value: CalendarDate) => void
  /** Validates a date and updates the parent's error state without
   * committing the value to widget state. Used for real-time error
   * feedback during segment editing. */
  onValidate: (date: CalendarDate | null) => void
  /** Called when close/blur leaves placeholder segments. The parent
   * discards the pending edit (restore last written ISO, clear dirty) and
   * the validation error; display revert is local. */
  onClose: (shouldClearError: boolean) => void
  /** In a form, commit the pending value with the same required/range rules
   * as `onChange`, including a synchronous WidgetStateManager write so
   * submit sees the staged value. Undefined when not in a form. */
  formCommit?: (value: CalendarDate | null) => void
  /** Incremented when the parent form is cleared. Signals this component to
   * reset its local displayValue to the parent's value prop (which may not
   * have changed if segment edits were never committed). */
  formResetKey: number
}

/** True when close/blur should notify the parent, including a full clear
 * that matches an already-empty committed value after a real edit.
 * Callers must clear `hasEdited` after the pending edit is committed or
 * discarded so later empty blurs do not notify again. */
function shouldNotifySinglePending(
  pending: CalendarDate | null,
  committed: CalendarDate | null,
  isFullyCleared: boolean,
  hasEdited: boolean,
  allowEmptyCommit: boolean
): boolean {
  return (
    !datesEqual(pending, committed) ||
    (isFullyCleared && hasEdited && allowEmptyCommit)
  )
}

function SingleDateInput({
  value,
  onChange,
  minDate,
  maxDate,
  format,
  disabled,
  clearable,
  allowEmptyCommit,
  required,
  suppressCommittedSync,
  onEdit,
  label,
  error,
  locale,
  isInSidebar,
  focusedValue,
  onFocusChange,
  onValidate,
  onClose,
  formCommit,
  formResetKey,
}: SingleDateInputProps): ReactElement {
  const theme = useEmotionTheme()
  const id = useId()
  const errorId = `${id}-error`
  const popoverId = `${id}-calendar`
  const popoverDescId = `${id}-calendar-desc`
  const triggerRef = useRef<HTMLDivElement | null>(null)
  const clearButtonRef = useRef<HTMLButtonElement | null>(null)
  const calendarButtonRef = useRef<HTMLButtonElement | null>(null)
  const safeLocale = useMemo(() => getSafeLocale(locale), [locale])
  // Guards against `handleFocus` reopening the popover it's in the middle
  // of closing — see `restoreFocusToField` below.
  const isRestoringFocusRef = useRef(false)
  // When an action (calendar click, paste, clear) already committed the value
  // via onChange, the close-detection effect should skip its own commit to
  // avoid a redundant write + backend rerun.
  const skipCloseCommitRef = useRef(false)
  // Segment typing that returns to empty still needs to notify the parent so
  // a required field can paint, even though pending equals the empty default.
  const hasEditedRef = useRef(false)

  // Dual-mode state: passive (visual aid) vs active (keyboard-modal).
  const [isCalendarActive, setIsCalendarActive] = useState(false)
  const isCalendarActiveRef = useRef(false)
  isCalendarActiveRef.current = isCalendarActive
  // Tracks which segment had focus before Alt+ArrowDown entered active mode.
  const activeOriginRef = useRef<HTMLElement | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)

  // --- Two-layer state (matches TimeInput/NumberInput pattern) ---
  // `displayValue` tracks what the field shows during editing.
  // Segment typing updates only displayValue; the parent's `onChange` is
  // called only on explicit actions (calendar click, paste, clear) or when
  // the popover closes. This prevents intermediate backspace states from
  // triggering backend reruns and on_change callbacks.
  const [displayValue, setDisplayValue] = useState<CalendarDate | null>(value)

  // Sync from parent when value changes externally (session_state, form
  // clear, close-commit, calendar click). Render-time adjustment pattern per
  // React docs. Identity-only echoes while dirty are ignored so a sibling
  // rerun does not clobber an in-progress edit; a real date change still
  // updates display.
  const [prevValue, setPrevValue] = useState(value)
  if (prevValue !== value) {
    // Skip identity-only echoes and null staging writes while dirty so an
    // in-progress edit stays visible. Do not advance prevValue in that
    // case: a later empty setValue can still sync once dirty clears.
    const applyDisplay =
      !suppressCommittedSync ||
      (value !== null && !datesEqual(prevValue, value))
    if (applyDisplay) {
      setPrevValue(value)
      setDisplayValue(value)
    }
  }

  // Capture whether the remount must restore focus. By effect time, the
  // previously focused segment has already been removed.
  const shouldRestoreFocusRef = useRef(false)

  // Form clear: displayValue may have diverged (uncommitted typing) while
  // the widget state stayed at default. The value prop won't change in that
  // case, so watch the resetKey separately.
  const [prevResetKey, setPrevResetKey] = useState(formResetKey)
  if (prevResetKey !== formResetKey) {
    setPrevResetKey(formResetKey)
    setDisplayValue(value)
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

  // Ref so the close-detection effect always reads the latest displayValue
  // without needing it in its dependency array.
  const displayValueRef = useRef(displayValue)
  displayValueRef.current = displayValue

  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const [isOpen, setIsOpen] = useState(false)
  const popoverInteractionRef = usePopoverInteractionFlag(
    isOpen,
    popoverRef,
    POPOVER_EXCLUDE_SELECTORS
  )

  const wasOpenRef = useRef(isOpen)
  // `value` is in deps so the effect re-evaluates when the committed value
  // changes externally (session_state, form clear), not just on isOpen toggle.
  useEffect(() => {
    if (wasOpenRef.current && !isOpen) {
      if (skipCloseCommitRef.current) {
        skipCloseCommitRef.current = false
      } else {
        const segments = triggerRef.current?.querySelectorAll(
          '[role="spinbutton"]'
        )
        const placeholders = triggerRef.current?.querySelectorAll(
          '[role="spinbutton"][data-placeholder="true"]'
        )
        const isPartiallyTyped =
          segments &&
          placeholders &&
          placeholders.length > 0 &&
          placeholders.length < segments.length
        const allCleared =
          segments &&
          segments.length > 0 &&
          placeholders?.length === segments.length

        if (isPartiallyTyped || (allCleared && !allowEmptyCommit)) {
          // Incomplete segments, or a full clear when the default is
          // non-empty: revert display to the committed value. Empty-default
          // fields notify the parent so required can paint.
          setDisplayValue(value)
          hasEditedRef.current = false
          onCloseRef.current(true /* shouldClearError */)
        } else {
          const pending = allCleared ? null : displayValueRef.current
          if (
            shouldNotifySinglePending(
              pending,
              value,
              Boolean(allCleared),
              hasEditedRef.current,
              allowEmptyCommit
            )
          ) {
            hasEditedRef.current = false
            onChangeRef.current(pending)
          }
        }
      }
    }
    wasOpenRef.current = isOpen
  }, [isOpen, value, allowEmptyCommit])

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

  // In the sidebar, flip/shift are bounded to the viewport
  // (document.documentElement) rather than the sidebar's overflow:auto
  // clipping rect. Otherwise the calendar cannot flip up when the trigger
  // sits near the bottom and overflows the viewport instead.
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
        setIsOpen(false)
        setIsCalendarActive(false)
        // Synchronous form commit: outside-click dismiss can race form submit
        // (the close-commit effect fires after paint). Mirrors handleBlur.
        if (formCommit) {
          const segments = triggerRef.current?.querySelectorAll(
            '[role="spinbutton"]'
          )
          const placeholders = triggerRef.current?.querySelectorAll(
            '[role="spinbutton"][data-placeholder="true"]'
          )
          const isPartiallyTyped =
            segments &&
            placeholders &&
            placeholders.length > 0 &&
            placeholders.length < segments.length
          const isFullyCleared =
            segments &&
            segments.length > 0 &&
            placeholders?.length === segments.length
          if (isPartiallyTyped || (isFullyCleared && !allowEmptyCommit)) {
            // Will revert on next render — don't commit stale/invalid state.
            // Clear pending now so a concurrent form submit does not use it.
            hasEditedRef.current = false
            onCloseRef.current(true)
          } else {
            const pending = isFullyCleared ? null : displayValueRef.current
            if (
              shouldNotifySinglePending(
                pending,
                value,
                Boolean(isFullyCleared),
                hasEditedRef.current,
                allowEmptyCommit
              )
            ) {
              hasEditedRef.current = false
              formCommit(pending)
              skipCloseCommitRef.current = true
            }
          }
        }
      },
      floatingSetFn: setFloating,
      referenceSetFn: setReference,
      restoreFocusFn: restoreFocusToField,
      // Exclude the month/year picker so clicks and Escape inside it do not
      // dismiss the calendar.
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

  // Segment typing: buffer locally, sync calendar month, show validation
  // errors in real-time — but do NOT commit to widget state.
  const handleFieldChange = useCallback(
    (date: CalendarDate | null): void => {
      displayValueRef.current = date
      setDisplayValue(date)
      hasEditedRef.current = true
      onEdit(date ? [calendarDateToIso(date)] : [])
      onValidate(date)
      if (date) {
        onFocusChange(date)
      }
    },
    [onEdit, onFocusChange, onValidate]
  )

  // Selecting a date commits immediately and closes the popover.
  const handleCalendarChange = useCallback(
    (date: CalendarDate): void => {
      setDisplayValue(date)
      hasEditedRef.current = false
      onChange(date)
      skipCloseCommitRef.current = true
      setIsOpen(false)
      restoreFocusToField()
      setIsCalendarActive(false)
    },
    [onChange, restoreFocusToField]
  )

  // Opens the passive preview when focus enters a date segment. Focus on the
  // clear or calendar button is ignored so those controls do not reopen it.
  const handleFocus = useCallback(
    (e: FocusEvent<HTMLDivElement>): void => {
      if (isRestoringFocusRef.current) return
      if (clearButtonRef.current?.contains(e.target)) return
      if (calendarButtonRef.current?.contains(e.target)) return
      if (!disabled) setIsOpen(true)
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
      if (!isRestoringFocusRef.current && !disabled) setIsOpen(true)
    },
    [disabled]
  )

  const handleClear = useCallback((): void => {
    setDisplayValue(null)
    hasEditedRef.current = false
    onChange(null)
  }, [onChange])

  // Toggle the active calendar dialog (React Aria DatePicker pattern: popup
  // state lives on this button, not the roleless field wrapper).
  const handleCalendarButtonClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>): void => {
      e.preventDefault()
      e.stopPropagation()
      if (disabled) return
      if (isOpen && isCalendarActive) {
        setIsOpen(false)
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
      if (!isOpen) setIsOpen(true)
      setIsCalendarActive(true)
    },
    [disabled, isOpen, isCalendarActive, restoreFocusToField]
  )

  // Custom paste: DateField's built-in paste uses the locale-derived segment
  // order (en-US), which is out of sync with our reordered segments.
  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLDivElement>): void => {
      if (disabled) return
      const text = e.clipboardData.getData("text").trim()
      const target = e.target as HTMLElement
      const segmentType =
        target.getAttribute("role") === "spinbutton"
          ? target.getAttribute("data-type")
          : null

      const parsed = parseDateFieldPaste(text, format, { segmentType })
      if (!parsed) return
      e.preventDefault()

      if (parsed.kind === "date") {
        setDisplayValue(parsed.date)
        hasEditedRef.current = false
        onChange(parsed.date)
        return
      }

      if (parsed.kind !== "partial") return // TS narrow; allowRangePaste is unset in single mode

      if (!isValidSegmentValue(parsed.segmentType, parsed.value)) return

      const base = displayValue ?? minDate
      const newDate = applyPartialSegmentToDate(base, parsed)
      if (!newDate) return
      setDisplayValue(newDate)
      hasEditedRef.current = false
      onChange(newDate)
    },
    [disabled, format, onChange, displayValue, minDate]
  )

  // Passive preview stays open on Tab to the calendar button; closes on leave.
  // Alt+ArrowDown opens the active calendar.
  const handleFieldKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>): void => {
      if (e.altKey && e.key === "ArrowDown") {
        e.preventDefault()
        activeOriginRef.current = e.target as HTMLElement
        if (!isOpen) setIsOpen(true)
        setIsCalendarActive(true)
        return
      }

      if (e.key !== "Tab" || !isOpen) return

      const closePreview = (): void => {
        setIsOpen(false)
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
    [isOpen]
  )

  // In active mode: Tab cycles focus within the calendar (focus trap).
  // In passive mode: Tab closes the popover and returns focus to the field.
  // Scoped to popoverRef only — portaled month/year pickers self-dismiss on
  // Tab (stopPropagation + restore trigger focus in CalendarPopoverHeader).
  const handleCalendarKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>): void => {
      if (e.key !== "Tab") return
      e.preventDefault()

      if (!isCalendarActiveRef.current) {
        setIsOpen(false)
        restoreFocusToField()
        return
      }

      // Active mode: cycle through focusable elements within the popover
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
          setIsOpen(false)
          setIsCalendarActive(false)
        } else {
          // null / inside popover: next-frame Tab or outside click closes.
          return
        }
      }
      const segments = triggerRef.current?.querySelectorAll(
        '[role="spinbutton"]'
      )
      const placeholders = triggerRef.current?.querySelectorAll(
        '[role="spinbutton"][data-placeholder="true"]'
      )
      const isFullyCleared =
        !!segments &&
        segments.length > 0 &&
        placeholders?.length === segments.length
      if (segments && placeholders) {
        const isPartiallyTyped =
          placeholders.length > 0 && placeholders.length < segments.length
        if (isPartiallyTyped) {
          hasEditedRef.current = false
          onCloseRef.current(true)
          return
        }
        if (isFullyCleared && !allowEmptyCommit) {
          hasEditedRef.current = false
          onCloseRef.current(true)
          return
        }
      }
      const pending = isFullyCleared ? null : displayValueRef.current
      if (
        !shouldNotifySinglePending(
          pending,
          value,
          isFullyCleared,
          hasEditedRef.current,
          allowEmptyCommit
        )
      ) {
        return
      }
      hasEditedRef.current = false
      if (closedByBlur) {
        // This blur closed the popover. Skip the close-effect commit so an
        // optional empty-default field does not write twice.
        skipCloseCommitRef.current = true
      }
      if (formCommit) {
        formCommit(pending)
      } else {
        onChangeRef.current(pending)
      }
    },
    [formCommit, isOpen, value, allowEmptyCommit, popoverInteractionRef]
  )

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
        onPaste={handlePaste}
        onKeyDown={handleFieldKeyDown}
      >
        <StyledDateFieldsScroller data-testid="stDateInputFieldsScroller">
          <I18nProvider locale="en-US">
            <StyledDateField>
              <DateField
                // Remount on form clear because React Aria retains incomplete
                // segment text when the controlled value has not changed.
                key={formResetKey}
                aria-label={label}
                aria-describedby={error ? errorId : undefined}
                isInvalid={!!error}
                // Keep invalid state tied to Streamlit's error, not native
                // constraint validation. Required is exposed on the field
                // group that contains the focused segments, not via RAC
                // `isRequired` (which would mark empty as invalid).
                validationBehavior="aria"
                value={displayValue}
                onChange={handleFieldChange}
                minValue={minDate}
                maxValue={maxDate}
                shouldForceLeadingZeros
                isDisabled={disabled}
              >
                <ReorderedSegments format={format} required={required} />
              </DateField>
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
          {clearable && !isNullOrUndefined(displayValue) && (
            <StyledClearButton
              ref={clearButtonRef}
              type="button"
              onClick={handleClear}
              aria-label="Clear date"
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
            aria-label="Choose date"
            aria-haspopup="dialog"
            aria-expanded={isCalendarActive}
            aria-controls={isCalendarActive ? popoverId : undefined}
            data-testid="stDateInputCalendarButton"
            disabled={disabled}
            onMouseDown={e => e.preventDefault()}
          >
            <Icon content={CalendarToday} size="base" />
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
            {/* Calendar locale is the visitor's locale (not the field's
                fixed en-US). safeLocale guards against malformed tags. */}
            <I18nProvider locale={safeLocale}>
              <StyledCalendarRoot
                aria-label="Choose date"
                value={displayValue}
                onChange={handleCalendarChange}
                minValue={minDate}
                maxValue={maxDate}
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

export default memo(SingleDateInput)
