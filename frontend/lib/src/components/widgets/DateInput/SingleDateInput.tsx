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
import { CalendarDate } from "@internationalized/date"
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

import { CalendarPopoverHeader } from "./CalendarPopoverHeader"
import {
  datesEqual,
  getSafeLocale,
  isValidSegmentValue,
  parsePartialSegmentPaste,
  parsePastedDate,
} from "./dateInputUtils"
import { ReorderedSegments } from "./ReorderedSegments"
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
} from "./styled-components"

interface SingleDateInputProps {
  value: CalendarDate | null
  onChange: (value: CalendarDate | null) => void
  minDate: CalendarDate
  maxDate: CalendarDate | undefined
  format: string
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
  /** Validates a date and updates the parent's error state without
   * committing the value to widget state. Used for real-time error
   * feedback during segment editing. */
  onValidate: (date: CalendarDate | null) => void
  /** Called when close requires parent-level cleanup (segments left in
   * placeholder state after an edit). Parent clears the validation error;
   * the display revert is handled locally. */
  onClose: (shouldClearError: boolean) => void
  /** When inside a form, writes the pending value to WidgetStateManager
   * synchronously on blur so a concurrent form submit reads the correct
   * value. Undefined when not in a form. */
  formCommit?: (value: CalendarDate | null) => void
  /** Incremented when the parent form is cleared. Signals this component to
   * reset its local displayValue to the parent's value prop (which may not
   * have changed if segment edits were never committed). */
  formResetKey: number
}

function SingleDateInput({
  value,
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
  const safeLocale = useMemo(() => getSafeLocale(locale), [locale])
  // Guards against `handleFocus` reopening the popover it's in the middle
  // of closing — see `restoreFocusToField` below.
  const isRestoringFocusRef = useRef(false)
  // When an action (calendar click, paste, clear) already committed the value
  // via onChange, the close-detection effect should skip its own commit to
  // avoid a redundant write + backend rerun.
  const skipCloseCommitRef = useRef(false)

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
  // React docs. Always accept the parent's value — during editing the parent
  // doesn't change (we buffer locally), so this only fires on real external
  // updates.
  const [prevValue, setPrevValue] = useState(value)
  if (prevValue !== value) {
    setPrevValue(value)
    setDisplayValue(value)
  }

  // Form clear: displayValue may have diverged (uncommitted typing) while
  // the widget state stayed at default. The value prop won't change in that
  // case, so watch the resetKey separately.
  const [prevResetKey, setPrevResetKey] = useState(formResetKey)
  if (prevResetKey !== formResetKey) {
    setPrevResetKey(formResetKey)
    setDisplayValue(value)
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

        if (isPartiallyTyped || (allCleared && !clearable)) {
          // User left segments incomplete, or fully cleared a non-clearable
          // widget — revert display to the committed value directly. We can't
          // go through the parent round-trip because the widget state might
          // already be at default (segment edits were buffered), making the
          // parent's revert a no-op.
          setDisplayValue(value)
          onCloseRef.current(true /* shouldClearError */)
        } else {
          const pending = allCleared ? null : displayValueRef.current
          if (!datesEqual(pending, value)) {
            onChangeRef.current(pending)
          }
        }
      }
    }
    wasOpenRef.current = isOpen
  }, [isOpen, value, clearable])

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

  const { refs, floatingStyles } = useFloatingOverlay(overlayOptions)

  // Restores focus to the date field after the calendar closes.
  // In active mode: returns to the segment that was focused before
  // Alt+ArrowDown. In passive mode: returns to the last segment.
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
          if (isPartiallyTyped || (isFullyCleared && !clearable)) {
            // Will revert on next render — don't commit stale/invalid state.
          } else {
            const pending = isFullyCleared ? null : displayValueRef.current
            if (!datesEqual(pending, value)) {
              formCommit(pending)
            }
          }
        }
      },
      floatingSetFn: refs.setFloating,
      referenceSetFn: refs.setReference,
      restoreFocusFn: restoreFocusToField,
      // Exclude the month/year picker popover so Escape closes it first,
      // not the whole calendar.
      excludeSelectors: [".stDateInputHeaderPickerPopover"],
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
      setDisplayValue(date)
      onValidate(date)
      if (date) {
        onFocusChange(date)
      }
    },
    [onFocusChange, onValidate]
  )

  // Selecting a date commits immediately and closes the popover.
  const handleCalendarChange = useCallback(
    (date: CalendarDate): void => {
      setDisplayValue(date)
      onChange(date)
      skipCloseCommitRef.current = true
      setIsOpen(false)
      restoreFocusToField()
      setIsCalendarActive(false)
    },
    [onChange, restoreFocusToField]
  )

  // Wired to onFocus and onClickCapture: clicking an already-focused segment
  // doesn't re-fire onFocus. Capture phase needed because RAC stops propagation.
  const handleFocus = useCallback((): void => {
    if (isRestoringFocusRef.current) return
    if (!disabled) setIsOpen(true)
  }, [disabled])

  // Capture-phase fires before the clear button's own handler; without this
  // gate, clearing a value would immediately reopen the popover.
  const handleClickCapture = useCallback(
    (e: MouseEvent<HTMLDivElement>): void => {
      if (clearButtonRef.current?.contains(e.target as Node)) return
      // Pointer-only: active mode enters via rAF, so handleFocus can't reset
      // it without breaking Tab cycling inside the calendar.
      setIsCalendarActive(false)
      handleFocus()
    },
    [handleFocus]
  )

  const handleClear = useCallback((): void => {
    setDisplayValue(null)
    onChange(null)
  }, [onChange])

  // Custom paste: DateField's built-in paste uses the locale-derived segment
  // order (en-US), which is out of sync with our reordered segments.
  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLDivElement>): void => {
      if (disabled) return
      const text = e.clipboardData.getData("text").trim()

      const fullDate = parsePastedDate(text, format)
      if (fullDate) {
        e.preventDefault()
        setDisplayValue(fullDate)
        onChange(fullDate)
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

      const base = displayValue ?? minDate
      const newDate = base.set({ [partial.segmentType]: partial.value })
      if (newDate[partial.segmentType] !== partial.value) return
      setDisplayValue(newDate)
      onChange(newDate)
    },
    [disabled, format, onChange, displayValue, minDate]
  )

  // Alt+ArrowDown enters active calendar mode; Tab from edge segments
  // closes the passive popover and lets focus leave the widget naturally.
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
      if (e.currentTarget.contains(e.relatedTarget)) return
      if (isCalendarActiveRef.current) return
      const segments = triggerRef.current?.querySelectorAll(
        '[role="spinbutton"]'
      )
      const placeholders = triggerRef.current?.querySelectorAll(
        '[role="spinbutton"][data-placeholder="true"]'
      )
      if (segments && placeholders) {
        const isPartiallyTyped =
          placeholders.length > 0 && placeholders.length < segments.length
        if (isPartiallyTyped) return
        const isFullyCleared = placeholders.length === segments.length
        if (isFullyCleared && !clearable) return
      }
      const pending = displayValueRef.current
      if (datesEqual(pending, value)) return
      onChangeRef.current(pending)
      formCommit?.(pending)
    },
    [formCommit, value, clearable]
  )

  return (
    <StyledDateFieldContainer>
      <StyledDateInputWrapper
        ref={setTriggerRef}
        aria-keyshortcuts="Alt+ArrowDown"
        aria-haspopup="dialog"
        aria-expanded={isCalendarActive}
        aria-controls={isCalendarActive ? popoverId : undefined}
        data-testid="stDateInputField"
        data-disabled={disabled || undefined}
        data-has-error={error ? "" : undefined}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onClickCapture={handleClickCapture}
        onPaste={handlePaste}
        onKeyDown={handleFieldKeyDown}
      >
        <I18nProvider locale="en-US">
          <StyledDateField>
            <DateField
              aria-label={label}
              aria-describedby={error ? errorId : undefined}
              isInvalid={!!error}
              value={displayValue}
              onChange={handleFieldChange}
              minValue={minDate}
              maxValue={maxDate}
              shouldForceLeadingZeros
              isDisabled={disabled}
            >
              <ReorderedSegments format={format} />
            </DateField>
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
