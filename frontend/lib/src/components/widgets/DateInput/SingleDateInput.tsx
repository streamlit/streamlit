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
import { useDatePickerState } from "react-stately"

import Icon from "~lib/components/shared/Icon/Icon"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown/StreamlitMarkdown"
import Tooltip, { Placement } from "~lib/components/shared/Tooltip/Tooltip"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { useFloatingOverlay } from "~lib/hooks/useFloatingOverlay"
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
import { RACFirstDayOfWeek } from "./useFirstDayOfWeek"
import { getSafeLocale } from "./weekInfo"

export interface SingleDateInputProps {
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
  firstDayOfWeek: RACFirstDayOfWeek
  isInSidebar: boolean
  /** Lifted calendar-visible-month state, owned by `DateInput.tsx` — see the
   * migration plan's future-extensibility note on a possible single/range toggle. */
  focusedValue: CalendarDate | null
  onFocusChange: (value: CalendarDate) => void
  /** Called whenever the popover transitions from open to closed, for any
   * reason (outside click, Escape, or date selection). `DateInput.tsx` uses
   * this to revert to the default value if the field was left empty,
   * matching the old `handleClose`. */
  onClose: () => void
}

/**
 * Tabbable descendants of the calendar popover, in DOM order: the
 * prev/next nav buttons and month/year `Select` triggers all render as
 * native `<button>`s, and exactly one grid cell has `tabIndex=0` at a time
 * (React Aria's roving-tabindex pattern) — every other cell is `-1` and
 * excluded here.
 */
function getFocusableCalendarElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button, [role="spinbutton"], [role="button"], [tabindex]'
    )
  ).filter(el => el.tabIndex >= 0 && !(el as HTMLButtonElement).disabled)
}

/**
 * Renders `state.segments` reordered to match `format` instead of the
 * locale-derived order React Aria would otherwise use — the Phase 0 spike's
 * chosen strategy (manual reordering via `useDateFieldState`, not
 * locale-substitution). Must be a child of `DateField` to read
 * `DateFieldStateContext`.
 */
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
  firstDayOfWeek,
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

  // useDatePickerState is used in fully controlled mode — value/onChange are
  // always the parent's, so the hook acts purely as a field/calendar
  // coordinator (state.setValue) rather than a second source of truth. Only
  // isOpen/setOpen are owned locally by the hook, since DateInput.tsx
  // doesn't need to track open/close state itself. See the migration plan's
  // state-management parity checklist.
  const state = useDatePickerState({
    value,
    onChange,
    minValue: minDate,
    maxValue: maxDate,
  })

  const wasOpenRef = useRef(state.isOpen)
  useEffect(() => {
    if (wasOpenRef.current && !state.isOpen) {
      onClose()
    }
    wasOpenRef.current = state.isOpen
  }, [state.isOpen, onClose])

  const { refs, floatingStyles } = useFloatingOverlay({
    open: state.isOpen,
    placement: "bottom-start",
    offsetPx: convertRemToPx(theme.spacing.twoXS),
    flipOptions: isInSidebar ? false : undefined,
  })

  // `triggerRef` is `StyledDateInputWrapper`, a plain (non-focusable) div —
  // calling `.focus()` on it directly is a no-op, so closing the popover
  // while focus is inside it (e.g. via Escape or selecting a date with
  // Enter — see `restoreFocusFn` below and `handleCalendarChange`) would
  // otherwise drop focus to `<body>` once the popover's DOM (and whatever
  // grid cell was focused) unmounts. Focus the last segment instead,
  // mirroring where `handleFieldKeyDown`'s forward-Tab entry came from.
  //
  // The `isRestoringFocusRef` guard exists because that same segment sits
  // inside `StyledDateInputWrapper`, whose `onFocus` (`handleFocus` below)
  // reopens the popover on *any* focus — including this programmatic one —
  // which would otherwise immediately undo the very close this runs after.
  // `.focus()` dispatches its `focus`/bubbling `onFocus` synchronously, so
  // the ref is safe to clear right after the call returns.
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
    isRestoringFocusRef.current = false
  }, [])

  const { setFloatingRef, setReferenceRef } = useOverlayDismissal({
    isOpen: state.isOpen,
    onClose: () => state.setOpen(false),
    floatingSetFn: refs.setFloating,
    referenceSetFn: refs.setReference,
    restoreFocusFn: focusLastFieldSegment,
    // Escape while the month/year dropdown (`CalendarPopoverHeader`) is
    // open should close just that dropdown, not the whole calendar
    // popover — without this, this hook's document-capture-phase Escape
    // listener always wins the race against that dropdown's own (bubble-
    // phase) Escape handling on its nested Select popover. (Outside-*click*
    // dismissal for that same dropdown doesn't need a matching exclusion
    // here: `HeaderPickerSelect` handles it directly via its own
    // `useOverlayDismissal` instance, scoped to just its own trigger/panel.)
    excludeSelectors: ['[data-testid="stDateInputHeaderPickerPopover"]'],
  })

  const setTriggerRef = useCallback(
    (node: HTMLDivElement | null): void => {
      triggerRef.current = node
      setReferenceRef(node)
    },
    [setReferenceRef]
  )

  // Selecting a date from the calendar grid closes the popover (matching
  // BaseWeb's single-date behavior); typing/pasting into the field does
  // not. Also restores focus to the field — without this, selecting via
  // Enter on a focused grid cell (see the popover's Tab-trap below) would
  // drop focus to `<body>` the same way an unguarded Escape did.
  const handleCalendarChange = useCallback(
    (date: CalendarDate): void => {
      state.setValue(date)
      state.setOpen(false)
      focusLastFieldSegment()
    },
    [state, focusLastFieldSegment]
  )

  // Also wired to `onClickCapture` (not just `onFocus`): clicking a segment
  // that's already focused — e.g. right after Escape/selection restores
  // focus there, see `focusLastFieldSegment` — doesn't fire a new `focus`
  // event, so `onFocus` alone would leave the popover closed despite the
  // click. Must be the *capture*-phase click, not bubble-phase `onClick`:
  // React Aria's segment press handling calls `stopPropagation()` on its
  // own click, which would otherwise swallow it before it bubbles back up
  // to this wrapper.
  const handleFocus = useCallback((): void => {
    if (isRestoringFocusRef.current) return
    if (!disabled) state.setOpen(true)
  }, [disabled, state])

  const handleClear = useCallback((): void => {
    state.setValue(null)
  }, [state])

  /**
   * Intercepts paste directly rather than relying on `DateField`'s built-in
   * paste handling, which parses clipboard text using the locale-derived
   * segment order from the field's `I18nProvider` — out of sync with the
   * manually reordered segments rendered here. See the migration plan's
   * paste-handling parity item and `TimeInput.tsx`'s `handlePaste` precedent.
   */
  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLDivElement>): void => {
      if (disabled) return
      const text = e.clipboardData.getData("text").trim()

      const fullDate = parsePastedDate(text, format)
      if (fullDate) {
        e.preventDefault()
        state.setValue(fullDate)
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
      state.setValue(base.set({ [partial.segmentType]: partial.value }))
    },
    [disabled, format, state, value, minDate]
  )

  /**
   * Tab from the field's last segment jumps straight into the open
   * calendar's currently-focused date cell, so arrow keys/Enter work on it
   * immediately — matching the old BaseWeb `Datepicker` (where ArrowDown
   * from its plain-text input did the same). Segments themselves keep
   * their native spinbutton arrow-key semantics (increment/decrement), so
   * this can only be triggered via Tab, not arrow keys, unlike BaseWeb's
   * un-segmented input. The popover renders in a `FloatingPortal` (outside
   * the field's DOM position), so without this, Tab would otherwise skip
   * over it entirely and land on whatever's next on the page.
   */
  const handleFieldKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>): void => {
      if (e.key !== "Tab" || e.shiftKey || !state.isOpen) return
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
    [state.isOpen, refs.floating]
  )

  /**
   * Full focus trap while the popover is open: Tab/Shift+Tab cycle among
   * the popover's own focusable elements (prev/next nav, month/year
   * selects, the one tabbable grid cell) and wrap at both ends instead of
   * escaping to the rest of the page. `handleFieldKeyDown` is the only way
   * in (Tab from the field's last segment); the only ways out are
   * selecting a date or Escape (both already close the popover and, for
   * Escape, restore focus to the field via `useOverlayDismissal`) — Tab no
   * longer returns focus to the field directly, since a trap means you
   * can't tab *out* of it at all.
   */
  const handleCalendarKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>): void => {
      if (e.key !== "Tab") return
      const calendar = refs.floating.current
      if (!calendar) return

      const focusable = getFocusableCalendarElements(calendar)
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (e.shiftKey && e.target === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && e.target === last) {
        e.preventDefault()
        first.focus()
      }
    },
    [refs.floating]
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
              value={state.value}
              onChange={state.setValue}
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
            {`Error: ${error}`}
          </StyledVisuallyHidden>
        )}
      </StyledDateInputWrapper>
      {state.isOpen && (
        <FloatingPortal>
          <StyledCalendarPopover
            ref={setFloatingRef}
            style={floatingStyles}
            data-testid="stDateInputCalendar"
            onKeyDown={handleCalendarKeyDown}
          >
            {/* Scoped separately from the typed field's fixed en-US
                I18nProvider — calendar month/weekday text follows the
                visitor's locale, matching the old useIntlLocale-driven
                BaseWeb behavior. `safeLocale` guards against I18nProvider
                throwing on a malformed locale string (see getSafeLocale). */}
            <I18nProvider locale={safeLocale}>
              <StyledCalendarRoot
                aria-label="Calendar."
                value={value}
                onChange={handleCalendarChange}
                minValue={minDate}
                maxValue={maxDate}
                firstDayOfWeek={firstDayOfWeek}
                focusedValue={focusedValue ?? undefined}
                onFocusChange={onFocusChange}
              >
                <CalendarPopoverHeader />
                <StyledCalendarGrid weekdayStyle="short">
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
