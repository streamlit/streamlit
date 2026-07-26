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

  // Range mode manages its own popover state since useDateRangePickerState
  // can't represent partial one-date selections.
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
    excludeSelectors: ['[data-testid="stDateInputHeaderPickerPopover"]'],
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

  // First click of a new range selection — see AnchorDateWatcher's docstring.
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
    (presetId: string): void => {
      const preset = quickSelectPresets.find(p => p.id === presetId)
      if (!preset) return
      onChange([preset.start, preset.end])
      setIsQuickSelectOpen(false)
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
          <StyledDateField $isRange>
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
                value={endValue}
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
