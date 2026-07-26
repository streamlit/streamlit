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
  ChangeEvent,
  ClipboardEvent,
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
  I18nProvider,
  RangeCalendarStateContext,
} from "react-aria-components"

import Icon from "~lib/components/shared/Icon/Icon"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown/StreamlitMarkdown"
import Tooltip, { Placement } from "~lib/components/shared/Tooltip/Tooltip"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { useFloatingOverlay } from "~lib/hooks/useFloatingOverlay"
import { useOverlayDismissal } from "~lib/hooks/useOverlayDismissal"
import { convertRemToPx } from "~lib/theme/utils"

import { CalendarPopoverHeader } from "./CalendarPopoverHeader"
import {
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
  StyledCalendarPopover,
  StyledClearButton,
  StyledDateField,
  StyledDateFieldContainer,
  StyledDateInputWrapper,
  StyledErrorIconContainer,
  StyledQuickSelectRow,
  StyledQuickSelectSelect,
  StyledRangeCalendarRoot,
  StyledRangeSeparator,
  StyledVisuallyHidden,
} from "./styled-components"
import { getSafeLocale } from "./weekInfo"

export interface RangeDateInputProps {
  /** 0, 1 (partial — anchor selected, no end yet), or 2 elements. */
  startValue: CalendarDate | null
  endValue: CalendarDate | null
  /** Called with the full committed set of dates (0-2 elements, in
   * start/end order) — `DateInput.tsx` owns turning this into ISO strings
   * and validating/writing to `WidgetStateManager`, mirroring
   * `SingleDateInput`'s `onChange` contract. */
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
  /** See `SingleDateInputProps.focusedValue`'s docstring — always a
   * concrete date, never null/undefined. */
  focusedValue: CalendarDate
  onFocusChange: (value: CalendarDate) => void
  onClose: () => void
}

/**
 * Watches `RangeCalendarStateContext`'s `anchorDate` (the date clicked to
 * begin a new range selection, exposed by `useRangeCalendarState` — see the
 * migration plan's partial-range parity item) and fires `onAnchorSelect`
 * exactly once per null→non-null transition (the first click of a new
 * selection). `RangeCalendar`'s own controlled `value`/`onChange` only fires
 * once a *complete* range is chosen (the second click) — there's no
 * built-in signal for "the user picked exactly one date so far" the way
 * BaseWeb's `Datepicker` immediately committed a one-element array after
 * the first click. Must be a child of `RangeCalendar` to read the context.
 *
 * Also seeds `anchorDate` on mount when the widget already has a partial
 * value (a start date with no end date yet — e.g.
 * `st.date_input("...", [single_date])`, or mid-interaction after the first
 * click closed and reopened the popover). Without this, `RangeCalendar`'s
 * `value` prop is `null` for a partial selection (it can only represent a
 * complete `{start, end}` — see `calendarValue` below), so it has no way to
 * know a start date was already chosen; the next click would start a
 * *brand-new* selection instead of completing the existing one, unlike
 * BaseWeb's `Datepicker`, which always completed a pending partial range.
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
  // Seeding only ever happens once per mount (this component remounts each
  // time the popover opens, since it's only rendered while isOpen — see the
  // parent's {isOpen && (...)} block) — otherwise clearing the calendar's
  // own anchorDate mid-selection (e.g. after completing a range) would keep
  // re-seeding the stale startValue on every subsequent render.
  const hasSeededRef = useRef(false)

  // Single combined effect (rather than a separate seed-on-mount effect)
  // so there's no render where the just-seeded anchorDate is read as a
  // "new" transition and redundantly re-committed via onAnchorSelect —
  // seeding and transition-watching both key off the same anchorDate
  // dependency, in a defined order.
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
  onClose,
}: RangeDateInputProps): ReactElement {
  const theme = useEmotionTheme()
  const id = useId()
  const errorId = `${id}-error`
  const triggerRef = useRef<HTMLDivElement | null>(null)
  const safeLocale = useMemo(() => getSafeLocale(locale), [locale])
  const quickSelectPresets = useMemo(() => getQuickSelectPresets(), [])

  // Popover open/close is owned locally here — DateInput.tsx doesn't need
  // to track it — mirroring SingleDateInput's use of useDatePickerState's
  // isOpen/setOpen. Unlike single mode, range mode can't route this
  // through a react-stately state hook: useDateRangePickerState's value
  // prop is typed RangeValue<T> | null (both endpoints or neither), so it
  // structurally can't represent a partial one-date selection, which this
  // widget must support (both as a Python-provided initial value, e.g.
  // st.date_input("...", [single_date]), and mid-interaction after the
  // anchor click — see AnchorDateWatcher above). Composing DateField/
  // RangeCalendar directly with our own value/onChange wiring avoids that
  // mismatch entirely.
  const [isOpen, setIsOpenState] = useState(false)

  const wasOpenRef = useRef(isOpen)
  useEffect(() => {
    if (wasOpenRef.current && !isOpen) {
      onClose()
    }
    wasOpenRef.current = isOpen
  }, [isOpen, onClose])

  const { refs, floatingStyles } = useFloatingOverlay({
    open: isOpen,
    placement: "bottom-start",
    offsetPx: convertRemToPx(theme.spacing.twoXS),
    flipOptions: isInSidebar ? false : undefined,
  })

  const { setFloatingRef, setReferenceRef } = useOverlayDismissal({
    isOpen,
    onClose: () => setIsOpenState(false),
    floatingSetFn: refs.setFloating,
    referenceSetFn: refs.setReference,
    restoreFocusFn: () => triggerRef.current?.focus(),
  })

  const setTriggerRef = useCallback(
    (node: HTMLDivElement | null): void => {
      triggerRef.current = node
      setReferenceRef(node)
    },
    [setReferenceRef]
  )

  const handleFocus = useCallback((): void => {
    if (!disabled) setIsOpenState(true)
  }, [disabled, setIsOpenState])

  const handleStartFieldChange = useCallback(
    (date: CalendarDate | null): void => {
      // `[start=null, end=X]` isn't representable in the (start,)|(start,end)|()
      // wire contract — compact() would otherwise silently promote `endValue`
      // into the start slot (`[endValue]`), corrupting the range. Clearing the
      // start field while an end date is set clears the whole range instead;
      // typing a fresh start date afterwards starts a brand-new one-element
      // range, same as the initial anchor-click flow.
      onChange(
        date === null && endValue !== null ? [] : compact([date, endValue])
      )
    },
    [onChange, endValue]
  )

  const handleEndFieldChange = useCallback(
    (date: CalendarDate | null): void => {
      // No ambiguity here: `compact([startValue, null])` is `[startValue]`,
      // a valid one-element "start only" state per the wire contract.
      onChange(compact([startValue, date]))
    },
    [onChange, startValue]
  )

  // Fully committed range value for the calendar grid — only non-null once
  // both endpoints are chosen, matching react-aria's own
  // useDateRangePicker's `calendarProps.value` derivation.
  const calendarValue = useMemo(
    () =>
      startValue && endValue ? { start: startValue, end: endValue } : null,
    [startValue, endValue]
  )

  // Second click of a new range selection: RangeCalendar's own onChange
  // fires with the complete, order-normalized {start, end}.
  const handleCalendarChange = useCallback(
    (range: { start: CalendarDate; end: CalendarDate }): void => {
      onChange([range.start, range.end])
      setIsOpenState(false)
    },
    [onChange, setIsOpenState]
  )

  // First click of a new range selection — see AnchorDateWatcher's
  // docstring. Matches BaseWeb's immediate one-element commit.
  const handleAnchorSelect = useCallback(
    (date: CalendarDate): void => {
      onChange([date])
    },
    [onChange]
  )

  const handleClear = useCallback((): void => {
    onChange([])
  }, [onChange])

  const handleQuickSelect = useCallback(
    (e: ChangeEvent<HTMLSelectElement>): void => {
      const preset = quickSelectPresets.find(p => p.id === e.target.value)
      e.target.value = ""
      if (!preset) return
      onChange([preset.start, preset.end])
    },
    [quickSelectPresets, onChange]
  )

  /**
   * Intercepts paste directly, same rationale as SingleDateInput's
   * handlePaste — the manually reordered segments desync from DateField's
   * built-in locale-derived paste parsing. Determines which of the two
   * fields (start/end) was the paste target via `closest`, since both
   * fields share this one paste handler on their common wrapper.
   */
  const makeHandlePaste = useCallback(
    (
      currentValue: CalendarDate | null,
      onFieldChange: (date: CalendarDate | null) => void
    ) =>
      (e: ClipboardEvent<HTMLDivElement>): void => {
        if (disabled) return
        const text = e.clipboardData.getData("text").trim()

        const fullDate = parsePastedDate(text, format)
        if (fullDate) {
          e.preventDefault()
          onFieldChange(fullDate)
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
        onFieldChange(base.set({ [partial.segmentType]: partial.value }))
      },
    [disabled, format, minDate]
  )

  const handleStartPaste = useMemo(
    () => makeHandlePaste(startValue, handleStartFieldChange),
    [makeHandlePaste, startValue, handleStartFieldChange]
  )
  const handleEndPaste = useMemo(
    () => makeHandlePaste(endValue, handleEndFieldChange),
    [makeHandlePaste, endValue, handleEndFieldChange]
  )

  const hasValue = startValue !== null || endValue !== null

  return (
    <StyledDateFieldContainer>
      <StyledDateInputWrapper
        ref={setTriggerRef}
        data-testid="stDateInputField"
        data-disabled={disabled || undefined}
        data-has-error={error ? "" : undefined}
        onFocus={handleFocus}
      >
        <I18nProvider locale="en-US">
          <StyledDateField>
            <div onPaste={handleStartPaste}>
              <DateField
                aria-label={`${label} start date`}
                aria-describedby={error ? errorId : undefined}
                isInvalid={!!error}
                value={startValue}
                onChange={handleStartFieldChange}
                minValue={minDate}
                maxValue={maxDate}
                shouldForceLeadingZeros
                isDisabled={disabled}
              >
                <ReorderedDateSegments format={format} />
              </DateField>
            </div>
          </StyledDateField>
          <StyledRangeSeparator aria-hidden="true">–</StyledRangeSeparator>
          <StyledDateField>
            <div onPaste={handleEndPaste}>
              <DateField
                aria-label={`${label} end date`}
                aria-describedby={error ? errorId : undefined}
                isInvalid={!!error}
                value={endValue}
                onChange={handleEndFieldChange}
                minValue={minDate}
                maxValue={maxDate}
                shouldForceLeadingZeros
                isDisabled={disabled}
              >
                <ReorderedDateSegments format={format} />
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
            {`Error: ${error}`}
          </StyledVisuallyHidden>
        )}
      </StyledDateInputWrapper>
      {isOpen && (
        <FloatingPortal>
          <StyledCalendarPopover
            ref={setFloatingRef}
            style={floatingStyles}
            data-testid="stDateInputCalendar"
          >
            <I18nProvider locale={safeLocale}>
              <StyledRangeCalendarRoot
                aria-label="Choose date"
                value={calendarValue}
                onChange={handleCalendarChange}
                minValue={minDate}
                maxValue={maxDate}
                focusedValue={focusedValue}
                onFocusChange={onFocusChange}
              >
                <AnchorDateWatcher
                  seedAnchor={endValue === null ? startValue : null}
                  onAnchorSelect={handleAnchorSelect}
                />
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
                    {date => <StyledCalendarCell date={date} $isRangeMode />}
                  </CalendarGridBody>
                </StyledCalendarGrid>
              </StyledRangeCalendarRoot>
            </I18nProvider>
            {enableQuickSelect && (
              <StyledQuickSelectRow>
                <StyledQuickSelectSelect
                  aria-label="Quick select a date range"
                  value=""
                  onChange={handleQuickSelect}
                >
                  <option value="" disabled hidden>
                    None
                  </option>
                  {quickSelectPresets.map(preset => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </StyledQuickSelectSelect>
              </StyledQuickSelectRow>
            )}
          </StyledCalendarPopover>
        </FloatingPortal>
      )}
    </StyledDateFieldContainer>
  )
}

export default memo(RangeDateInput)
