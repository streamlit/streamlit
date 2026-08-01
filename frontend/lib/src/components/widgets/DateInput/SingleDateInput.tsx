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
  KeyboardEvent,
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

import { ErrorOutline } from "@emotion-icons/material-outlined"
import { Cancel } from "@emotion-icons/material-rounded"
import { FloatingPortal } from "@floating-ui/react"
import { CalendarDate } from "@internationalized/date"
import {
  CalendarGridBody,
  CalendarGridHeader,
  DateField,
  DateFieldStateContext,
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
  isValidSegmentValue,
  parsePartialSegmentPaste,
  parsePastedDate,
  reorderSegments,
} from "./dateInputUtils"
import {
  StyledCalendarCell,
  StyledCalendarGrid,
  StyledCalendarHeaderCell,
  StyledCalendarPopover,
  StyledCalendarRoot,
  StyledClearButton,
  StyledDateField,
  StyledDateFieldContainer,
  StyledDateFieldInput,
  StyledDateInputWrapper,
  StyledDateSegment,
  StyledErrorIconContainer,
  StyledVisuallyHidden,
} from "./styled-components"
import { getSafeLocale } from "./weekInfo"

/**
 * Focusable descendants of the calendar popover, in DOM order: header
 * buttons (prev/next, month/year pickers) and exactly one grid cell with
 * `tabIndex=0` (React Aria's roving-tabindex pattern).
 */
function getFocusableCalendarElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button, [role="spinbutton"], [role="button"], [tabindex]'
    )
  ).filter(el => el.tabIndex >= 0 && !(el as HTMLButtonElement).disabled)
}

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
  focusedValue: CalendarDate | null
  onFocusChange: (value: CalendarDate) => void
  /** Called when popover closes (outside click, Escape, or date selection).
   * Parent uses this to revert to default if the field was left empty or
   * partially cleared. The boolean argument indicates whether any segment
   * was in placeholder state at the time of close. */
  onClose: (hasPlaceholderSegments: boolean) => void
}

/** Renders segments reordered to match `format` instead of the locale-derived
 * order. Must be a child of `DateField` to read `DateFieldStateContext`. */
function ReorderedDateSegments({
  format,
}: {
  format: string
}): ReactElement | null {
  const state = useContext(DateFieldStateContext)
  if (!state) return null

  const segments = reorderSegments(state.segments, format)

  return (
    <StyledDateFieldInput>
      {segments.map((segment, i) => (
        // Index is safe here: `segments` is a fixed-length, fixed-order
        // array derived from `format` (which doesn't change across
        // re-renders of a given DateInput instance), so there's no
        // reordering/insertion for React to misreconcile. A stable key is
        // needed only to disambiguate the (otherwise identical) literal
        // separator segments, since `segment.type` alone repeats for those.
        // eslint-disable-next-line @eslint-react/no-array-index-key
        <StyledDateSegment key={`${segment.type}-${i}`} segment={segment} />
      ))}
    </StyledDateFieldInput>
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
  label,
  error,
  locale,
  isInSidebar,
  focusedValue,
  onFocusChange,
  onClose,
}: SingleDateInputProps): ReactElement {
  const theme = useEmotionTheme()
  const id = useId()
  const errorId = `${id}-error`
  const triggerRef = useRef<HTMLDivElement | null>(null)
  const safeLocale = useMemo(() => getSafeLocale(locale), [locale])
  // Guards against `handleFocus` reopening the popover it's in the middle
  // of closing — see `focusLastFieldSegment` below.
  const isRestoringFocusRef = useRef(false)

  // Stable ref for onClose so the close-detection effect doesn't re-run
  // every time the parent's handleClose callback identity changes.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  // Only isOpen is local state; value/onChange are fully controlled by the parent.
  const [isOpen, setIsOpen] = useState(false)

  const wasOpenRef = useRef(isOpen)
  useEffect(() => {
    if (wasOpenRef.current && !isOpen) {
      const hasPlaceholders =
        triggerRef.current?.querySelector('[data-placeholder="true"]') !== null
      onCloseRef.current(hasPlaceholders)
    }
    wasOpenRef.current = isOpen
  }, [isOpen])

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
  })

  const setTriggerRef = useCallback(
    (node: HTMLDivElement | null): void => {
      triggerRef.current = node
      setReferenceRef(node)
    },
    [setReferenceRef]
  )

  // Selecting a date closes the popover and restores focus to the field.
  const handleCalendarChange = useCallback(
    (date: CalendarDate): void => {
      onChange(date)
      setIsOpen(false)
      focusLastFieldSegment()
    },
    [onChange, focusLastFieldSegment]
  )

  // Wired to onClickCapture: clicking an already-focused segment doesn't
  // re-fire onFocus. Capture phase needed because RAC stops propagation.
  const handleFocus = useCallback((): void => {
    if (isRestoringFocusRef.current) return
    if (!disabled) setIsOpen(true)
  }, [disabled])

  const handleClear = useCallback((): void => {
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

      const base = value ?? minDate
      onChange(base.set({ [partial.segmentType]: partial.value }))
    },
    [disabled, format, onChange, value, minDate]
  )

  // Tab from the last segment moves focus into the calendar popover.
  // Without this, FloatingPortal puts the calendar outside DOM order so
  // Tab would skip over it entirely.
  const handleFieldKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>): void => {
      if (e.key !== "Tab" || e.shiftKey || !isOpen) return
      const wrapper = triggerRef.current
      const calendar = refs.floating.current
      if (!wrapper || !calendar) return

      const segments = wrapper.querySelectorAll<HTMLElement>(
        '[role="spinbutton"]'
      )
      const lastSegment = segments[segments.length - 1]
      if (e.target !== lastSegment) return

      const focusedCell = calendar.querySelector<HTMLElement>(
        '[role="button"][tabindex="0"]'
      )
      if (!focusedCell) return
      e.preventDefault()
      focusedCell.focus()
    },
    [isOpen, refs.floating]
  )

  // Tab trap: forward-Tab on last element closes popover, Shift+Tab on
  // first wraps to the grid cell.
  const handleCalendarKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>): void => {
      if (e.key !== "Tab") return
      const calendar = refs.floating.current
      if (!calendar) return

      const focusable = getFocusableCalendarElements(calendar)
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (!e.shiftKey && e.target === last) {
        e.preventDefault()
        setIsOpen(false)
        focusLastFieldSegment()
      } else if (e.shiftKey && e.target === first) {
        e.preventDefault()
        last.focus()
      }
    },
    [refs.floating, focusLastFieldSegment]
  )

  return (
    <StyledDateFieldContainer>
      <StyledDateInputWrapper
        ref={setTriggerRef}
        data-testid="stDateInputField"
        data-disabled={disabled || undefined}
        data-has-error={error ? "" : undefined}
        onFocus={handleFocus}
        onClickCapture={handleFocus}
        onPaste={handlePaste}
        onKeyDown={handleFieldKeyDown}
      >
        <I18nProvider locale="en-US">
          <StyledDateField>
            <DateField
              aria-label={label}
              aria-describedby={error ? errorId : undefined}
              isInvalid={!!error}
              value={value}
              onChange={onChange}
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
        {clearable && !isNullOrUndefined(value) && (
          <StyledClearButton
            type="button"
            onClick={handleClear}
            aria-label="Clear date"
            data-testid="stDateInputClearButton"
            // Removed from tab order: keyboard users clear via
            // Backspace/Delete in segments. Matches TimeInput's pattern.
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
            {/* Calendar locale is the visitor's locale (not the field's
                fixed en-US). safeLocale guards against malformed tags. */}
            <I18nProvider locale={safeLocale}>
              <StyledCalendarRoot
                aria-label="Choose date"
                value={value}
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
