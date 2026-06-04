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
  FC,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { KeyboardArrowDown } from "@emotion-icons/material-outlined"
import {
  ComboBox,
  ComboBoxStateContext,
  I18nProvider,
  type Key,
} from "react-aria-components"

import { streamlit } from "@streamlit/protobuf"

import IsSidebarContext from "~lib/components/core/IsSidebarContext"
import { WidgetLabel } from "~lib/components/widgets/BaseWidget/WidgetLabel"
import { WidgetLabelHelpIcon } from "~lib/components/widgets/BaseWidget/WidgetLabelHelpIcon"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { useExecuteWhenChanged } from "~lib/hooks/useExecuteWhenChanged"
import {
  filterSelectOptions,
  getSelectFilterMode,
} from "~lib/util/fuzzyFilterSelectOptions"
import { isMobile } from "~lib/util/isMobile"
import {
  getSelectPlaceholder,
  isNullOrUndefined,
  LabelVisibilityOptions,
} from "~lib/util/utils"

import {
  StyledClearButton,
  StyledGroup,
  StyledInput,
  StyledItemHighlight,
  StyledListBox,
  StyledListBoxItem,
  StyledOpenButton,
  StyledPopover,
} from "./Selectbox.styled"

export interface Props {
  value: string | null | undefined
  onChange: (value: string | null) => void
  disabled: boolean
  options: string[]
  label?: string | null
  labelVisibility?: LabelVisibilityOptions
  help?: string
  placeholder: string
  clearable?: boolean
  acceptNewOptions: boolean
  filterMode?: streamlit.SelectWidgetFilterMode | null
}

/** Shape of every item in the `items` array passed to `ComboBox`. */
type ComboOption = {
  id: string
  label: string
  value: string
  isCreatable?: boolean
}

const CREATABLE_ID = "__creatable__"

/**
 * Null-render component that wires RAC's internal ComboBox close method into
 * a ref. Must be rendered inside a `<ComboBox>` so it can read
 * `ComboBoxStateContext`. Call `closeRef.current?.()` from event handlers to
 * close the dropdown without blurring the input.
 */
const DropdownCloser: FC<{
  closeRef: React.MutableRefObject<(() => void) | null>
}> = ({ closeRef }) => {
  const state = useContext(ComboBoxStateContext)
  // Keep closeRef current on every render; state.close is stable.
  useEffect(() => {
    if (state) closeRef.current = () => state.close()
  }, [state, closeRef])
  return null
}

const Selectbox: FC<Props> = ({
  disabled,
  value: propValue,
  onChange,
  options,
  label,
  labelVisibility,
  help,
  placeholder,
  clearable,
  acceptNewOptions,
  filterMode: filterModeProp,
}) => {
  const theme = useEmotionTheme()
  const isInSidebar = useContext(IsSidebarContext)

  /**
   * Committed string value (the last value sent to Streamlit). Kept as state
   * so handlers always see the current committed value without needing
   * `propValue` in their closure deps. Re-synced by `useExecuteWhenChanged`
   * when the backend pushes a new `propValue` (e.g. form-clear reset).
   */
  const [value, setValue] = useState<string | null | undefined>(propValue)

  /**
   * Display text in the ComboBox input. Matches the committed label when at
   * rest; diverges while the user is typing to filter.
   */
  const [inputValue, setInputValue] = useState(propValue ?? "")

  /**
   * `filterActive` is true only while the user is actively typing to search.
   * It resets when a selection is committed, on blur, or on external prop
   * update. When false the full option list is shown regardless of inputValue
   * — matching the "click to open, see full list" behaviour.
   */
  const [filterActive, setFilterActive] = useState(false)

  /**
   * Ref wired to RAC's internal ComboBox close method by `DropdownCloser`
   * (rendered inside the `<ComboBox>` tree). Our custom Enter-commit path
   * uses this to close the dropdown explicitly, since we commit by updating
   * React state rather than via RAC's own selection mechanism (which is what
   * normally triggers the close).
   */
  const closeDropdownRef = useRef<(() => void) | null>(null)

  /**
   * Always-current ref for `filterActive`. Updated every render so that stale
   * event-handler closures (e.g. a `handleSelectionChange` captured by RAC)
   * read the correct filter state and don't revert user input during typing.
   */
  const filterActiveRef = useRef(filterActive)
  filterActiveRef.current = filterActive

  /**
   * Always-current ref for `value`. Updated on every render so that stale
   * event-handler closures (e.g. a `handleBlur` captured by RAC before a form
   * reset) read the correct committed value instead of a stale one.
   */
  const valueRef = useRef(value)
  valueRef.current = value

  /**
   * Always-current ref for `inputValue`. Used by `handleBlur` to check the
   * CURRENT display text without capturing a stale closure value. This
   * prevents React from queuing a `setInputValue` update when `handleBlur`
   * fires with an already-correct `inputValue`, which would otherwise be
   * replayed by React's fiber queue after a phase update changes the state.
   */
  const inputValueRef = useRef(inputValue)
  inputValueRef.current = inputValue

  /**
   * Guards against double-committing when RAC's `onSelectionChange` and our
   * `onKeyDown` both fire for the same Enter keypress (arrow-nav + Enter path).
   * RAC's `onSelectionChange` runs first and sets this flag when it commits a
   * genuinely new selection. Our `onKeyDown` checks and clears it to skip.
   * Covers both regular items and the creatable "Add:" item.
   */
  const racHandledEnterRef = useRef(false)

  /**
   * Tracks whether the ComboBox dropdown is currently open. RAC fires
   * `onSelectionChange` for deferred press events (originating from a
   * previous option click) AFTER the dropdown has already closed — for
   * example when a global `document.pointerup` listener fires inside a
   * subsequent `act()` call after a form reset. We discard any
   * `onSelectionChange` that arrives when the dropdown is closed because
   * `handleBlur` / `handleInputChange` already handle input restoration.
   */
  const isOpenRef = useRef(false)

  /**
   * Captures whether the dropdown was open at the exact moment the user
   * pressed Enter, BEFORE RAC's internal keydown handler runs (which may
   * close the dropdown). Set in the capture-phase keydown handler so that
   * the bubble-phase `handleInputKeyDown` can reliably know if the user
   * pressed Enter while the dropdown was open.
   */
  const wasOpenBeforeEnterRef = useRef(false)

  // Sync committed value and display text from backend (form-clear, session
  // state push, etc.). Both are reset together since they always travel as a
  // pair — the committed label IS the display text when the field is at rest.
  useExecuteWhenChanged(() => {
    setValue(propValue)
    setInputValue(propValue ?? "")
    setFilterActive(false)
  }, [propValue])

  const filterMode = useMemo(
    () => getSelectFilterMode(filterModeProp),
    [filterModeProp]
  )

  /** Stable `{id, label, value}` list — id is the option index as a string. */
  const selectOptions = useMemo<ComboOption[]>(
    () => options.map((opt, i) => ({ id: String(i), label: opt, value: opt })),
    [options]
  )

  /**
   * Only apply filtering when the user is actively typing (`filterActive`).
   * When the dropdown first opens (without typing) all items are shown.
   */
  const filteredOptions = useMemo((): ComboOption[] => {
    if (!filterActive || !inputValue) return selectOptions
    return filterSelectOptions(
      selectOptions,
      inputValue,
      filterMode
    ) as ComboOption[]
  }, [selectOptions, inputValue, filterMode, filterActive])

  /** Appended when `acceptNewOptions` is true, user is filtering, and no exact match exists. */
  const creatableItem = useMemo((): ComboOption | null => {
    if (!acceptNewOptions || !filterActive || !inputValue) return null
    const exactMatch = selectOptions.some(o => o.label === inputValue)
    return exactMatch
      ? null
      : {
          id: CREATABLE_ID,
          label: `Add: ${inputValue}`,
          value: inputValue,
          isCreatable: true,
        }
  }, [acceptNewOptions, filterActive, inputValue, selectOptions])

  /** Items passed to the ComboBox — pre-filtered so RAC's built-in filter is bypassed. */
  const displayOptions = useMemo<ComboOption[]>(
    () =>
      creatableItem ? [...filteredOptions, creatableItem] : filteredOptions,
    [filteredOptions, creatableItem]
  )

  /**
   * Selected key derived from committed `value` — passed as a controlled prop
   * so RAC always knows which item is "committed". Without this, RAC reverts
   * the input to "" on blur (because no selection was made via user interaction),
   * overwriting our handleBlur correction.
   */
  const localSelectedKey = useMemo<string | null>(() => {
    if (isNullOrUndefined(value)) return null
    const found = selectOptions.find(o => o.value === value)
    return found?.id ?? null
  }, [value, selectOptions])

  const { placeholder: resolvedPlaceholder, shouldDisable } = useMemo(
    () => getSelectPlaceholder(placeholder, options, acceptNewOptions, false),
    [placeholder, options, acceptNewOptions]
  )

  const selectDisabled = disabled || shouldDisable

  const isFilterNone =
    filterMode === streamlit.SelectWidgetFilterMode.FILTER_MODE_NONE
  // Note: we do NOT use `readOnly` for isFilterNone. Setting `readOnly` on the
  // native <input> prevents React Aria's ComboBox from opening the dropdown on
  // click/focus (menuTrigger="focus" relies on the focus event flowing normally).
  // Instead, character input is blocked via onKeyDown/onPaste below.
  const inputReadOnly = isMobile() && options.length <= 10 && !acceptNewOptions

  const handleSelectionChange = useCallback(
    (key: Key | null): void => {
      // Ignore all selection callbacks when the dropdown is closed.
      // RAC fires `onSelectionChange(currentKey)` (for the controlled
      // `selectedKey`) whenever the dropdown closes, and also fires deferred
      // press events via a global document.pointerup listener that can arrive
      // inside a subsequent act() after a form reset. `onSelectionChange` always
      // fires BEFORE `onOpenChange(false)` for legitimate selections, so guarding
      // on `isOpenRef` correctly passes real selections through while discarding
      // all spurious post-close callbacks.
      if (!isOpenRef.current) return

      // Set the flag when RAC commits a genuinely NEW selection (covers both
      // regular items and the creatable "Add:" item) so that our bubble-phase
      // onKeyDown can skip the auto-select to avoid double-committing.
      if (key !== null) {
        const currentCommittedKey =
          selectOptions.find(o => o.value === valueRef.current)?.id ?? null
        if (String(key) !== String(currentCommittedKey ?? "")) {
          racHandledEnterRef.current = true
        }
      }

      if (key === null) {
        // RAC fires null when the input no longer matches any committed item
        // (e.g. the selected item was filtered out). Only revert the display
        // when the user is NOT actively typing — blur already restores the
        // display when typing ends without a selection.
        if (!filterActiveRef.current) {
          setInputValue(valueRef.current ?? "")
          setFilterActive(false)
        }
        return
      }

      const keyStr = String(key)
      const found = selectOptions.find(o => o.id === keyStr)
      // For creatable items, read the CURRENT input text via ref rather than
      // capturing `inputValue` from the closure — avoids a stale read and
      // keeps `inputValue` out of this callback's dependency array.
      const selected =
        keyStr === CREATABLE_ID
          ? inputValueRef.current
          : (found?.value ?? null)

      setValue(selected)
      setInputValue(selected ?? "")
      setFilterActive(false)
      // Only notify the parent when the value actually changed.
      if (selected !== valueRef.current) {
        onChange(selected)
      }
    },
    [onChange, selectOptions]
  )

  const handleOpenChange = useCallback((open: boolean): void => {
    isOpenRef.current = open
  }, [])

  const handleInputChange = useCallback((text: string): void => {
    setInputValue(text)
    // RAC calls `onInputChange(committedLabel)` when the dropdown closes to
    // revert the input to the last committed selection. We must NOT treat
    // that automatic revert as the user actively typing to filter results.
    const committedLabel = isNullOrUndefined(valueRef.current)
      ? ""
      : valueRef.current
    if (text !== committedLabel) {
      setFilterActive(true)
    } else {
      setFilterActive(false)
    }
  }, [])

  const handleBlur = useCallback((): void => {
    // Restore display text to the locally committed value.
    // IMPORTANT: only call setInputValue when the display text actually needs
    // to change. Calling setInputValue with the same value as current state
    // appears to be a no-op but React keeps the update in its fiber queue. If
    // a subsequent phase update (e.g. from useExecuteWhenChanged on form reset)
    // changes inputValue, React replays the fiber queue including this queued
    // update, which overrides the phase update. Guarding with inputValueRef
    // prevents any state update from being queued when unnecessary.
    const target = valueRef.current ?? ""
    if (inputValueRef.current !== target) {
      setInputValue(target)
    }
    setFilterActive(false)
  }, [])

  /**
   * Capture-phase keydown handler — fires BEFORE React Aria's internal
   * handler. Its only job is to record whether the dropdown was open at
   * the instant Enter was pressed, so that the bubble-phase handler can
   * still check "was the dropdown open?" even though RAC may have already
   * closed it by the time the bubble phase fires.
   *
   * For FILTER_MODE_NONE, this also blocks character input (since filtering
   * is disabled but we can't use `readOnly` — see note above on inputReadOnly).
   */
  const handleInputKeyDownCapture = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>): void => {
      // Block character input for filter_mode=None (prevents typing without readOnly).
      if (
        isFilterNone &&
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        e.preventDefault()
        return
      }
      if (e.key === "Enter") {
        wasOpenBeforeEnterRef.current = isOpenRef.current
      }
      // Escape on a clearable selectbox with a committed value: clear the value.
      if (e.key === "Escape" && clearable && !isNullOrUndefined(value)) {
        e.preventDefault()
        setValue(null)
        setInputValue("")
        setFilterActive(false)
        onChange(null)
      }
    },
    [clearable, isFilterNone, onChange, value]
  )

  /**
   * On Enter: commit a custom value if the creatable item is shown, or
   * auto-select the first visible option when RAC hasn't already committed
   * one via keyboard navigation.
   *
   * RAC fires `onSelectionChange` BEFORE our `onKeyDown` fires (via
   * mergeProps chain ordering). When the user arrow-nav'd to an item and
   * pressed Enter, `racHandledEnterRef` is set by `handleSelectionChange`
   * before we reach this handler. When no item was keyboard-focused, RAC
   * either fires `onSelectionChange(currentKey)` (re-commits same value,
   * which doesn't set the flag) or fires nothing — so we handle it here.
   *
   * Handler order (Enter with focused listbox item):
   *   1. `handleSelectionChange` → sets racHandledEnterRef, closes dropdown
   *   2. `handleInputKeyDown` → sees racHandledEnterRef → returns early
   *
   * Handler order (Enter without focused listbox item):
   *   1. `handleSelectionChange` → re-commits same key (flag stays false)
   *   2. `handleInputKeyDown` → handles auto-select or creatable commit
   */
  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>): void => {
      if (e.key !== "Enter") return

      // RAC already committed a new selection for this Enter (arrow-nav path).
      if (racHandledEnterRef.current) {
        racHandledEnterRef.current = false
        return
      }

      if (creatableItem) {
        // User typed a value and pressed Enter — always commit (the creatable
        // option is by definition visible because the user typed it). This path
        // does NOT require wasOpenBeforeEnterRef: if filterActive is true and
        // creatableItem exists, the intent to create is unambiguous.
        const selected = inputValue
        setValue(selected)
        setInputValue(selected)
        setFilterActive(false)
        closeDropdownRef.current?.()
        if (selected !== valueRef.current) {
          onChange(selected)
        }
        return
      }

      // For the auto-select path, only act when the dropdown was open. This
      // prevents accidentally selecting on Enter when the dropdown is closed.
      if (!wasOpenBeforeEnterRef.current) return

      // Dropdown was open but no item was keyboard-focused (or RAC only
      // re-committed the current selection). Auto-select: prefer an exact
      // match on the typed input, otherwise take the first visible option.
      if (displayOptions.length > 0) {
        const exactMatch = displayOptions.find(
          o => !o.isCreatable && o.value === inputValue
        )
        const target =
          exactMatch ??
          (!displayOptions[0].isCreatable ? displayOptions[0] : null)
        if (target) {
          setValue(target.value)
          setInputValue(target.value)
          setFilterActive(false)
          closeDropdownRef.current?.()
          if (target.value !== valueRef.current) {
            onChange(target.value)
          }
        }
      }
    },
    [creatableItem, displayOptions, inputValue, onChange]
  )

  /** Called by the clear button — always clears the committed value. */
  const handleClearValue = useCallback((): void => {
    setValue(null)
    setInputValue("")
    setFilterActive(false)
    closeDropdownRef.current?.()
    onChange(null)
  }, [onChange])

  return (
    <div className="stSelectbox" data-testid="stSelectbox">
      <WidgetLabel
        label={label}
        labelVisibility={labelVisibility}
        disabled={selectDisabled}
      >
        {help && <WidgetLabelHelpIcon content={help} label={label} />}
      </WidgetLabel>
      <I18nProvider locale="en-US">
        <ComboBox
          selectedKey={localSelectedKey}
          inputValue={inputValue}
          onSelectionChange={handleSelectionChange}
          onInputChange={handleInputChange}
          onOpenChange={handleOpenChange}
          isDisabled={selectDisabled}
          allowsCustomValue={acceptNewOptions}
          allowsEmptyCollection
          onBlur={handleBlur}
          menuTrigger="focus"
          aria-label={label ?? undefined}
        >
          <DropdownCloser closeRef={closeDropdownRef} />
          <StyledGroup>
            <StyledInput
              placeholder={resolvedPlaceholder}
              readOnly={inputReadOnly}
              onKeyDownCapture={handleInputKeyDownCapture}
              onKeyDown={handleInputKeyDown}
              onPaste={isFilterNone ? e => e.preventDefault() : undefined}
              onCompositionStart={
                isFilterNone ? e => e.preventDefault() : undefined
              }
              $placeholderColor={
                selectDisabled ? theme.colors.fadedText40 : undefined
              }
            />
            {clearable && !isNullOrUndefined(value) && (
              <StyledClearButton
                aria-label="Clear value"
                slot={null}
                onPress={handleClearValue}
              >
                ×
              </StyledClearButton>
            )}
            <StyledOpenButton aria-label="Open">
              <KeyboardArrowDown
                size={theme.iconSizes.lg}
                aria-hidden="true"
              />
            </StyledOpenButton>
          </StyledGroup>
          <StyledPopover
            data-testid="stSelectboxVirtualDropdown"
            placement="bottom left"
            isNonModal
            shouldFlip={!isInSidebar}
            $isInSidebar={isInSidebar}
            offset={0}
          >
            <StyledListBox
              aria-label={label ?? ""}
              renderEmptyState={() => <span>No results</span>}
            >
              {displayOptions.map(opt => (
                <StyledListBoxItem
                  key={opt.id}
                  id={opt.id}
                  textValue={opt.label}
                  $isCreatable={opt.isCreatable}
                >
                  <StyledItemHighlight data-item-hl="">
                    {opt.label}
                  </StyledItemHighlight>
                </StyledListBoxItem>
              ))}
            </StyledListBox>
          </StyledPopover>
        </ComboBox>
      </I18nProvider>
    </div>
  )
}

export default memo(Selectbox)
