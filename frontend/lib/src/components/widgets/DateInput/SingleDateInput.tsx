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
  isValidSegmentValue,
  parsePartialSegmentPaste,
  parsePastedDate,
} from "./dateInputUtils"
import { ReorderedDateSegments } from "./ReorderedDateSegments"
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
  StyledVisuallyHidden,
} from "./styled-components"
import { getSafeLocale } from "./weekInfo"

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
  /** Called when close requires parent-level revert logic (segments left in
   * placeholder state after an edit). Parent resets to default value. */
  onClose: (hasPlaceholderSegments: boolean) => void
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
  const triggerRef = useRef<HTMLDivElement | null>(null)
  const clearButtonRef = useRef<HTMLButtonElement | null>(null)
  const safeLocale = useMemo(() => getSafeLocale(locale), [locale])
  // Guards against `handleFocus` reopening the popover it's in the middle
  // of closing — see `focusLastFieldSegment` below.
  const isRestoringFocusRef = useRef(false)
  // When an action (calendar click, paste, clear) already committed the value
  // via onChange, the close-detection effect should skip its own commit to
  // avoid a redundant write + backend rerun.
  const skipCloseCommitRef = useRef(false)

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
  useEffect(() => {
    if (wasOpenRef.current && !isOpen) {
      if (skipCloseCommitRef.current) {
        skipCloseCommitRef.current = false
      } else {
        const pending = displayValueRef.current
        const hasPlaceholders =
          triggerRef.current?.querySelector('[data-placeholder="true"]') !==
          null

        if (hasPlaceholders && !datesEqual(pending, value)) {
          // User left segments incomplete — revert display to the committed
          // value directly. We can't go through the parent round-trip because
          // the widget state might already be at default (segment edits were
          // buffered), making the parent's revert a no-op.
          setDisplayValue(value)
          onCloseRef.current(true /* hasPlaceholderSegments */)
        } else if (!datesEqual(pending, value)) {
          onChangeRef.current(pending)
        }
      }
    }
    wasOpenRef.current = isOpen
  }, [isOpen, value])

  // In the sidebar, flip/shift are bounded to the viewport
  // (document.documentElement) rather than the sidebar's overflow:auto
  // clipping rect. Otherwise the calendar cannot flip up when the trigger
  // sits near the bottom and overflows the viewport instead (issue #16181).
  // Matches the pattern established in Selectbox (PR #16199).
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

  // Restores focus to the last date segment when the popover closes.
  // isRestoringFocusRef prevents handleFocus from reopening the popover
  // in response to this programmatic focus. Reset via rAF to guarantee
  // the synthetic focus event has been processed before re-enabling.
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
    onClose: () => setIsOpen(false),
    floatingSetFn: refs.setFloating,
    referenceSetFn: refs.setReference,
    restoreFocusFn: focusLastFieldSegment,
    // Exclude the month/year picker popover so Escape closes it first,
    // not the whole calendar.
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
      focusLastFieldSegment()
    },
    [onChange, focusLastFieldSegment]
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

  // Tab from edge segments closes the popover and lets focus leave the
  // widget naturally (Ant Design pattern: calendar is a visual aid for
  // pointer users; keyboard users type dates directly in the segments).
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
        setIsOpen(false)
      }
    },
    [isOpen]
  )

  // If focus lands in the calendar (mouse click on a header control),
  // Tab closes the popover and returns focus to the field rather than
  // letting it escape into the page behind the overlay.
  const handleCalendarKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>): void => {
      if (e.key !== "Tab") return
      e.preventDefault()
      setIsOpen(false)
      focusLastFieldSegment()
    },
    [focusLastFieldSegment]
  )

  // Synchronous commit on blur for form-submit races: clicking a form's
  // Submit button causes blur before effects fire, so the pending value
  // must be written to WidgetStateManager synchronously.
  const handleBlur = useCallback(
    (e: FocusEvent<HTMLDivElement>): void => {
      if (e.currentTarget.contains(e.relatedTarget)) return
      if (!formCommit) return
      const hasPlaceholders =
        triggerRef.current?.querySelector('[data-placeholder="true"]') !== null
      if (hasPlaceholders) return
      const pending = displayValueRef.current
      if (!datesEqual(pending, value)) {
        formCommit(pending)
      }
    },
    [formCommit, value]
  )

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
              <ReorderedDateSegments format={format} />
            </DateField>
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
        {clearable && !isNullOrUndefined(displayValue) && (
          <StyledClearButton
            ref={clearButtonRef}
            type="button"
            onClick={handleClear}
            aria-label="Clear date"
            data-testid="stDateInputClearButton"
            // Removed from tab order: keyboard users clear via
            // Backspace/Delete in segments. Matches TimeInput's pattern.
            tabIndex={-1}
            onMouseDown={e => e.preventDefault()}
            $pushRight={!error}
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
