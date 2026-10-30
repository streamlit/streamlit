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
  type FC,
  memo,
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
  ErrorOutline,
  KeyboardArrowDown,
} from "@emotion-icons/material-outlined"
import { Cancel } from "@emotion-icons/material-rounded"
import {
  ComboBox,
  ComboBoxStateContext,
  I18nProvider,
  type Key,
  ListLayout,
  Virtualizer,
} from "react-aria-components"

import { streamlit } from "@streamlit/protobuf"

import IsSidebarContext from "~lib/components/core/IsSidebarContext"
import Icon from "~lib/components/shared/Icon/Icon"
import Tooltip, { Placement } from "~lib/components/shared/Tooltip/Tooltip"
import { WidgetLabel } from "~lib/components/widgets/BaseWidget/WidgetLabel"
import { WidgetLabelHelpIcon } from "~lib/components/widgets/BaseWidget/WidgetLabelHelpIcon"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { useExecuteWhenChanged } from "~lib/hooks/useExecuteWhenChanged"
import {
  SHIFT_VIEWPORT_PADDING,
  useFloatingOverlay,
} from "~lib/hooks/useFloatingOverlay"
import { convertRemToPx } from "~lib/theme/utils"
import {
  filterSelectOptions,
  getSelectFilterMode,
} from "~lib/util/fuzzyFilterSelectOptions"
import { isMobile } from "~lib/util/isMobile"
import {
  getSelectPlaceholder,
  isNullOrUndefined,
  type LabelVisibilityOptions,
} from "~lib/util/utils"

import {
  StyledClearButton,
  StyledEmptyState,
  StyledErrorIcon,
  StyledGroup,
  StyledInput,
  StyledItemHighlight,
  StyledListBox,
  StyledListBoxItem,
  StyledOpenButton,
  StyledPopover,
  StyledVisuallyHidden,
} from "./Selectbox.styled"
import { useSyncComboBoxEnterTargetFocus } from "./useSyncComboBoxEnterTargetFocus"

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
  /** Shows the `(required)` label marker and sets `aria-required`. */
  required?: boolean
  /**
   * Validation message. When set, shows the invalid-input chrome and
   * announces the message to assistive tech.
   */
  error?: string | null
}

type ComboOption = {
  id: string
  label: string
  value: string
  isCreatable?: boolean
}

const CREATABLE_ID = "__creatable__"

/** Max options without Virtualizer; short lists so setFocusedKey can land. */
const SELECTBOX_MAX_UNVIRTUALIZED_OPTIONS = 25

/** Live ComboBox state pointer for capture-phase key handlers outside RAC. */
type ComboBoxStateHandle = NonNullable<
  React.ContextType<typeof ComboBoxStateContext>
>

/**
 * Pass-through filter for RAC's <ComboBox defaultFilter>. Streamlit's own
 * `filterSelectOptions` runs upstream and produces `displayOptions`, so RAC
 * must not re-filter — otherwise its built-in "contains" strategy would drop
 * fuzzy matches like "ape" -> "Apple". See issue #16003.
 *
 * Defined at module scope so the prop is referentially stable across renders.
 */
const PASS_THROUGH_FILTER = (): boolean => true

/**
 * If `after` is `before` with extra characters inserted (at any position),
 * return just those inserted characters; otherwise return null.
 *
 * Used to detect the user typing over an untouched committed label so the
 * first keystroke starts a fresh search instead of appending behind the
 * committed label. Works from the reported input text alone, so it is
 * independent of caret position and browser-specific focus/selection behavior.
 */
export const getInsertedText = (
  before: string,
  after: string
): string | null => {
  const maxPrefix = Math.min(before.length, after.length)
  let prefix = 0
  while (prefix < maxPrefix && before[prefix] === after[prefix]) {
    prefix++
  }
  const maxSuffix = Math.min(before.length - prefix, after.length - prefix)
  let suffix = 0
  while (
    suffix < maxSuffix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) {
    suffix++
  }
  // A pure insertion removes none of `before`'s characters.
  if (before.slice(prefix, before.length - suffix) !== "") {
    return null
  }
  return after.slice(prefix, after.length - suffix)
}

/**
 * Null-render component mounted inside <ComboBox> to expose React Aria's
 * internal open/close methods and to keep focusedKey on the Enter target for
 * aria-activedescendant while typing (#16841).
 */
const DropdownController = memo<{
  openRef: React.MutableRefObject<(() => void) | null>
  closeRef: React.MutableRefObject<(() => void) | null>
  stateRef: React.MutableRefObject<ComboBoxStateHandle | null>
  enterTargetKey: Key | null
}>(({ openRef, closeRef, stateRef, enterTargetKey }) => {
  const state = useContext(ComboBoxStateContext)

  // Sync read for keydown. Do not clear in effect cleanup — focus updates
  // recreate `state` and would null this during capture-phase ArrowDown.
  stateRef.current = state ?? null

  useEffect(() => {
    if (state) {
      openRef.current = () => state.open(null, "manual")
      closeRef.current = () => state.close()
    }
    return () => {
      openRef.current = null
      closeRef.current = null
    }
  }, [state, openRef, closeRef])

  useSyncComboBoxEnterTargetFocus(enterTargetKey)

  return null
})
DropdownController.displayName = "DropdownController"

/**
 * Render a single option row for the virtualized ListBox collection.
 *
 * The item is received untyped because emotion's `styled(ListBox)` erases
 * React Aria's generic item type, so we assert it back to `ComboOption`.
 * Defined at module scope for a stable identity across renders.
 */
const renderOption = (item: unknown): ReactElement => {
  const option = item as ComboOption
  return (
    <StyledListBoxItem
      id={option.id}
      textValue={option.label}
      $isCreatable={option.isCreatable}
    >
      <StyledItemHighlight data-item-hl="">{option.label}</StyledItemHighlight>
    </StyledListBoxItem>
  )
}

/**
 * Swallow paste and IME composition events so FILTER_MODE_NONE inputs stay
 * non-editable, mirroring the character blocking in onKeyDownCapture. Paste
 * cancellation is honored by browsers; compositionstart cancellation is
 * best-effort (some browsers ignore preventDefault on it), so IME text may
 * still slip in — but it is never committed as a selection.
 */
const preventInputEvent = (e: React.SyntheticEvent): void => {
  e.preventDefault()
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
  clearable = false,
  acceptNewOptions,
  filterMode: filterModeProp,
  required = false,
  error,
}) => {
  const theme = useEmotionTheme()
  const isInSidebar = useContext(IsSidebarContext)
  const id = useId()
  const errorId = `${id}-error`
  const hasError = Boolean(error)

  // Floating UI provides scroll-tracking via autoUpdate. Unlike Popover and
  // MenuButton, we cannot replace RAC's <Popover> with FloatingPortal because
  // ComboBox's collection system requires ListBoxItems to be inside RAC's own
  // Popover to discover them and assign role="option". Instead, Floating UI's
  // position is applied via the style prop and CSS !important overrides
  // neutralize RAC's imperative style writes (see Selectbox.styled.ts).
  //
  // open is always true because whileElementsMounted already gates autoUpdate
  // on both refs being mounted — the actual ComboBox open state is irrelevant
  // here since the floating element only exists in the DOM when RAC's Popover
  // renders it (i.e. when the dropdown is open).
  //
  // In the sidebar, flip/shift are bounded by the viewport
  // (document.documentElement) rather than the sidebar's `overflow: auto`
  // clipping rect. Otherwise the dropdown cannot flip up when the trigger sits
  // near the bottom of the sidebar and it overflows the viewport instead (issue
  // #16181). This mirrors the sidebar handling in elements/Popover/Popover.tsx.
  // `document.documentElement` is used rather than `document.body` because
  // Streamlit's `.stApp` uses `position: absolute; inset: 0`, leaving
  // document.body sized 0x0, so a body boundary would always report overflow
  // and re-introduce the same clipping.
  //
  // Unlike Popover.tsx, no `size` middleware is needed here: the option list is
  // already height-capped by CSS (`min(maxDropdownHeight, 70vh)` with internal
  // scroll in Selectbox.styled.ts), so the dropdown cannot overflow the way
  // arbitrary Popover content can.
  const overlayOptions = useMemo(() => {
    const base = {
      open: true,
      placement: "bottom-start" as const,
      offsetPx: convertRemToPx(theme.spacing.twoXS),
      matchTriggerWidth: true,
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
  }, [theme.spacing.twoXS, isInSidebar])

  const { floatingStyles, setFloating, setReference } =
    useFloatingOverlay(overlayOptions)

  // Locally committed value (last value sent to Streamlit). Re-synced from
  // propValue when the backend pushes an update (form-clear, session state, etc.).
  const [value, setValue] = useState<string | null | undefined>(propValue)

  // Display text in the ComboBox input. Diverges from `value` while the user types.
  const [inputValue, setInputValue] = useState(propValue ?? "")

  // True only while the user is actively filtering. Resets on commit, blur,
  // or prop update. When false, the full option list is shown.
  const [filterActive, setFilterActive] = useState(false)

  // Wired to RAC's open/close by DropdownController. menuTrigger="manual"
  // prevents auto-open on Tab-focus (which caused spurious reopens after reruns).
  const openDropdownRef = useRef<(() => void) | null>(null)
  const closeDropdownRef = useRef<(() => void) | null>(null)
  const comboBoxStateRef = useRef<ComboBoxStateHandle | null>(null)

  // Always-current mirrors of state values, for use inside stale RAC closures
  // that capture their dependencies at registration time.
  const filterActiveRef = useRef(filterActive)
  filterActiveRef.current = filterActive

  const valueRef = useRef(value)
  valueRef.current = value

  // Also prevents a queued no-op setInputValue from being replayed by React's
  // fiber after a form-reset, overwriting the reset's own state update.
  const inputValueRef = useRef(inputValue)
  inputValueRef.current = inputValue

  // Set when RAC onChange commits during Enter; bubble handler skips fallthrough.
  const racHandledEnterRef = useRef(false)

  // True only for the current Enter keydown (capture → RAC → bubble).
  const enterKeyInProgressRef = useRef(false)

  // Tracks whether the dropdown is open. RAC can fire deferred ComboBox
  // onChange callbacks after the dropdown closes; those are discarded via
  // this ref.
  const isOpenRef = useRef(false)

  // Records isOpenRef at the moment Enter is pressed (capture phase) before
  // RAC's handler may close the dropdown, so the bubble-phase handler can
  // reliably determine whether the dropdown was open when Enter fired.
  const wasOpenBeforeEnterRef = useRef(false)

  useExecuteWhenChanged(() => {
    setValue(propValue)
    setInputValue(propValue ?? "")
    setFilterActive(false)
  }, [propValue])

  const filterMode = useMemo(
    () => getSelectFilterMode(filterModeProp),
    [filterModeProp]
  )

  const selectOptions = useMemo<ComboOption[]>(
    () => options.map((opt, i) => ({ id: String(i), label: opt, value: opt })),
    [options]
  )

  const filteredOptions = useMemo((): ComboOption[] => {
    if (!filterActive || !inputValue) return selectOptions
    return filterSelectOptions(
      selectOptions,
      inputValue,
      filterMode
    ) as ComboOption[]
  }, [selectOptions, inputValue, filterMode, filterActive])

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

  // Leading Add keeps best-ranked matches visible in a short dropdown.
  const displayOptions = useMemo<ComboOption[]>(
    () =>
      creatableItem ? [creatableItem, ...filteredOptions] : filteredOptions,
    [filteredOptions, creatableItem]
  )

  const displayOptionsRef = useRef(displayOptions)
  displayOptionsRef.current = displayOptions

  // Enter / activedescendant target: Add row, exact match, or first match.
  const enterTargetId = useMemo((): string | null => {
    if (creatableItem) return CREATABLE_ID
    const exactMatch = displayOptions.find(
      o => o.isCreatable !== true && o.value === inputValue
    )
    if (exactMatch) return exactMatch.id
    const first = displayOptions.find(o => o.isCreatable !== true)
    return first?.id ?? null
  }, [creatableItem, displayOptions, inputValue])

  const enterTargetIdRef = useRef(enterTargetId)
  enterTargetIdRef.current = enterTargetId

  const virtualizerLayoutOptions = useMemo(
    () => ({
      rowSize: convertRemToPx(theme.sizes.dropdownItemHeight),
    }),
    [theme.sizes.dropdownItemHeight]
  )

  // Controlled ComboBox `value` (selected option id) so RAC always knows the
  // committed item and doesn't revert the input to "" on blur before
  // handleBlur can restore it.
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
  // Don't use `readOnly` for FILTER_MODE_NONE: it disables React Aria's internal
  // keyboard navigation (Arrow keys, Enter) and makes Chromium close the
  // ComboBox during the pointer-event lifecycle. Instead, suppress the mobile
  // software keyboard with inputMode="none" (see the input below) and block
  // character input via onKeyDown/onPaste.
  const inputReadOnly =
    isMobile() && options.length <= 10 && !acceptNewOptions && !isFilterNone

  /**
   * Commit a selection: update local state and notify the parent.
   * Does NOT close the dropdown — callers on the manual paths (keydown,
   * clear button) close explicitly; RAC-triggered paths (option click,
   * arrow-nav + Enter) let RAC close the dropdown naturally after RAC's
   * onChange returns. Calling state.close() inside RAC's onChange causes
   * RAC to fire onInputChange with the old committed label, overwriting
   * our setInputValue update.
   */
  const commitSelection = useCallback(
    (newValue: string | null): void => {
      setValue(newValue)
      setInputValue(newValue ?? "")
      setFilterActive(false)
      if (newValue !== valueRef.current) {
        onChange(newValue)
      }
    },
    [onChange]
  )

  const handleSelectionChange = useCallback(
    (key: Key | null): void => {
      // Discard callbacks when the dropdown is closed. RAC fires its
      // onChange(currentKey) on close and via deferred pointerup
      // listeners — both arrive after the real selection is already handled.
      // Genuine selections always fire BEFORE onOpenChange(false), so this
      // guard correctly lets them through.
      if (!isOpenRef.current) return

      if (key === null) {
        // RAC fires null when the typed text no longer matches the committed
        // item. Only revert display text when the user isn't actively typing.
        if (!filterActiveRef.current) {
          setInputValue(valueRef.current ?? "")
          setFilterActive(false)
        }
        return
      }

      // Ignore stale focusedKey left over after filtering.
      const collection = comboBoxStateRef.current?.collection
      if (collection && !collection.getItem(key)) {
        return
      }

      // Only mark during Enter so open/filter onChange cannot stick the flag.
      if (enterKeyInProgressRef.current) {
        racHandledEnterRef.current = true
      }

      const keyStr = String(key)
      const found = selectOptions.find(o => o.id === keyStr)
      const selected =
        keyStr === CREATABLE_ID
          ? inputValueRef.current
          : (found?.value ?? null)

      commitSelection(selected)
      // CREATABLE_ID is outside localSelectedKey; RAC will not auto-close.
      if (keyStr === CREATABLE_ID) {
        closeDropdownRef.current?.()
      }
    },
    [commitSelection, selectOptions]
  )

  const handleOpenChange = useCallback((open: boolean): void => {
    isOpenRef.current = open
  }, [])

  const handleInputChange = useCallback((text: string): void => {
    const committed = valueRef.current ?? ""

    // Typing over an untouched committed label starts a fresh search: replace
    // the label with just the newly typed characters instead of editing it in
    // place. The ComboBox keeps the committed label in the input with the caret
    // at the end, so without this the first keystroke would append behind it
    // (e.g. "Banana" + "c" -> "Bananac") and match nothing.
    let nextText = text
    if (!filterActiveRef.current && committed !== "") {
      const inserted = getInsertedText(committed, text)
      // An empty insertion means no new characters were typed (e.g. RAC
      // reporting the unchanged committed label on close/revert), which must
      // not clear the input.
      if (inserted !== null && inserted !== "") {
        nextText = inserted
      }
    }

    setInputValue(nextText)
    // Decide filtering from the raw reported text, not from nextText: when the
    // fresh-search diff yields a query equal to the committed label (e.g.
    // committed "a", typing "a"), filtering must still activate. RAC reports
    // text === committed when it reverts the input on close — that is the only
    // case treated as a non-edit.
    const isEdit = text !== committed
    setFilterActive(isEdit)
    // Update the ref synchronously, not just via setFilterActive, which
    // refreshes it only on the next render. Otherwise a second keystroke before
    // that render reads a stale `false` and re-strips the growing query (e.g.
    // "ab" back to "b").
    filterActiveRef.current = isEdit
    if (isEdit) {
      openDropdownRef.current?.()
    }
  }, [])

  const handleBlur = useCallback((): void => {
    // Restore display text to the committed value. Guard with inputValueRef to
    // avoid queueing a no-op setInputValue that React would replay after a
    // subsequent form-reset, overwriting the reset's own state update.
    const target = valueRef.current ?? ""
    if (inputValueRef.current !== target) {
      setInputValue(target)
    }
    setFilterActive(false)
  }, [])

  // Open on pointer-click. With menuTrigger="manual", opening on pointerDown
  // (before focus) avoids a timing gap where focus arrives first with no open action.
  const handleInputPointerDown = useCallback((): void => {
    if (selectDisabled) return
    openDropdownRef.current?.()
  }, [selectDisabled])

  /**
   * Capture-phase keydown — fires before RAC's handler:
   * - Records wasOpenBeforeEnterRef so the bubble-phase handler can check
   *   whether the dropdown was open before RAC may have closed it.
   * - Opens the dropdown on ArrowUp/Down when closed.
   * - Blocks character input for FILTER_MODE_NONE (can't use readOnly — see above).
   * - On Escape while filtering, discards the typed query and restores the
   *   committed label.
   * - On Escape when not filtering and clearable, clears the committed value.
   */
  const handleInputKeyDownCapture = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>): void => {
      if (selectDisabled) return
      if (
        isFilterNone &&
        (e.key.length === 1 || e.key === "Backspace" || e.key === "Delete") &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        e.preventDefault()
        return
      }
      if (e.key === "Enter") {
        wasOpenBeforeEnterRef.current = isOpenRef.current
        enterKeyInProgressRef.current = true
      }
      if (
        (e.key === "ArrowDown" || e.key === "ArrowUp") &&
        !isOpenRef.current
      ) {
        openDropdownRef.current?.()
      }
      // React Aria clears focusedKey on each keystroke. Until sync restores it,
      // ArrowDown would land on the leading "Add" row, so jump to the first match.
      if (e.key === "ArrowDown" && isOpenRef.current) {
        const state = comboBoxStateRef.current
        const focused = state?.selectionManager.focusedKey
        if (state && isNullOrUndefined(focused)) {
          const options = displayOptionsRef.current
          if (options[0]?.isCreatable === true) {
            const firstMatch = options.find(o => o.isCreatable !== true)
            if (firstMatch) {
              e.preventDefault()
              e.stopPropagation()
              state.selectionManager.setFocusedKey(firstMatch.id)
              return
            }
          }
        }
      }
      // Clear isOpenRef before close() so handleSelectionChange drops RAC's
      // commitValue callback; do not stopPropagation (dialog FocusScope).
      if (e.key === "Tab" && isOpenRef.current) {
        isOpenRef.current = false
        closeDropdownRef.current?.()
      }
      if (e.key === "Escape") {
        // Escape while filtering restores the committed label (see #16004).
        // Handle this before the clear-on-Escape branch below, or Escape
        // would wipe the committed value on a clearable selectbox.
        if (filterActiveRef.current) {
          e.preventDefault()
          const committed = valueRef.current ?? ""
          setInputValue(committed)
          inputValueRef.current = committed
          setFilterActive(false)
          filterActiveRef.current = false
          closeDropdownRef.current?.()
          return
        }
        if (clearable && !isNullOrUndefined(valueRef.current)) {
          e.preventDefault()
          commitSelection(null)
        }
      }
    },
    [clearable, commitSelection, isFilterNone, selectDisabled]
  )

  /**
   * Bubble-phase keydown — fires after RAC's handler:
   * - If RAC already committed a selection via arrow-nav + Enter
   *   (racHandledEnterRef is set), skip and clear the flag.
   * - If the creatable item is shown, commit the typed value.
   * - Otherwise, if the dropdown was open, auto-select: prefer an exact text
   *   match, otherwise take the first non-creatable visible option.
   */
  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>): void => {
      if (e.key !== "Enter") return

      enterKeyInProgressRef.current = false

      if (racHandledEnterRef.current) {
        racHandledEnterRef.current = false
        return
      }

      // Read refs so an Enter in the same tick as the last keystroke uses the
      // filtered list.
      const targetId = enterTargetIdRef.current
      const options = displayOptionsRef.current
      const target = targetId ? options.find(o => o.id === targetId) : null
      if (target?.isCreatable === true) {
        commitSelection(inputValueRef.current)
        closeDropdownRef.current?.()
        return
      }

      if (!wasOpenBeforeEnterRef.current) return

      if (target) {
        commitSelection(target.value)
        closeDropdownRef.current?.()
      }
    },
    [commitSelection]
  )

  const handleClearValue = useCallback((): void => {
    commitSelection(null)
    closeDropdownRef.current?.()
  }, [commitSelection])

  const listBox = (
    <StyledListBox
      aria-label={label ?? "Selectbox options"}
      items={displayOptions}
      renderEmptyState={() => <StyledEmptyState>No results</StyledEmptyState>}
    >
      {renderOption}
    </StyledListBox>
  )

  return (
    <div className="stSelectbox" data-testid="stSelectbox">
      <WidgetLabel
        label={label}
        labelVisibility={labelVisibility}
        disabled={selectDisabled}
        required={required}
      >
        {help && <WidgetLabelHelpIcon content={help} label={label} />}
      </WidgetLabel>
      <I18nProvider locale="en-US">
        <ComboBox
          value={localSelectedKey}
          inputValue={inputValue}
          onChange={handleSelectionChange}
          onInputChange={handleInputChange}
          onOpenChange={handleOpenChange}
          isDisabled={selectDisabled}
          allowsCustomValue={acceptNewOptions}
          allowsEmptyCollection
          onBlur={handleBlur}
          menuTrigger="manual"
          aria-label={label ?? "Selectbox"}
          // The caller owns validation. validationBehavior="aria" keeps React
          // Aria out of native constraint validation, so isRequired and
          // isInvalid only set ARIA state on the input and data-invalid on the
          // group (styled in StyledGroup).
          isRequired={required}
          isInvalid={hasError}
          validationBehavior="aria"
          aria-describedby={hasError ? errorId : undefined}
          // Streamlit owns the filtering (fuzzy / contains / prefix / none),
          // and passes the already-filtered list to <StyledListBox items=...>.
          // Without this pass-through, RAC applies its own "contains" filter on
          // top, dropping fuzzy matches whose query is not a contiguous
          // substring (e.g. "ape" would not match "Apple"). See issue #16003.
          defaultFilter={PASS_THROUGH_FILTER}
        >
          <DropdownController
            openRef={openDropdownRef}
            closeRef={closeDropdownRef}
            stateRef={comboBoxStateRef}
            enterTargetKey={enterTargetId}
          />
          <StyledGroup ref={setReference}>
            <StyledInput
              placeholder={resolvedPlaceholder}
              readOnly={inputReadOnly}
              // inputMode="none" suppresses the mobile software keyboard while
              // keeping the input focusable (unlike readOnly — see above).
              // $typingDisabled hides the caret and shows a pointer cursor.
              inputMode={isFilterNone ? "none" : undefined}
              $typingDisabled={isFilterNone}
              onPointerDown={handleInputPointerDown}
              onKeyDownCapture={handleInputKeyDownCapture}
              onKeyDown={handleInputKeyDown}
              onPaste={isFilterNone ? preventInputEvent : undefined}
              onCompositionStart={isFilterNone ? preventInputEvent : undefined}
              $placeholderColor={
                selectDisabled ? theme.colors.fadedText40 : undefined
              }
            />
            {hasError && (
              <StyledErrorIcon data-testid="stSelectboxErrorIcon">
                <Tooltip content={error} placement={Placement.TOP_RIGHT} error>
                  <Icon content={ErrorOutline} size="base" />
                </Tooltip>
              </StyledErrorIcon>
            )}
            {clearable && !isNullOrUndefined(value) && (
              <StyledClearButton
                aria-label="Clear value"
                slot={null}
                isDisabled={selectDisabled}
                onPress={handleClearValue}
              >
                <Cancel size={theme.iconSizes.base} aria-hidden="true" />
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
            ref={setFloating}
            data-testid="stSelectboxVirtualDropdown"
            placement="bottom left"
            isNonModal
            $isInSidebar={isInSidebar}
            offset={0}
            style={floatingStyles}
          >
            {displayOptions.length > SELECTBOX_MAX_UNVIRTUALIZED_OPTIONS ? (
              <Virtualizer
                layout={ListLayout}
                layoutOptions={virtualizerLayoutOptions}
              >
                {listBox}
              </Virtualizer>
            ) : (
              listBox
            )}
          </StyledPopover>
        </ComboBox>
      </I18nProvider>
      {hasError && (
        // The error message is shown visually in a tooltip on hover. The
        // tooltip trigger isn't focusable, so we also expose the message to
        // assistive tech via a visually hidden, aria-describedby-linked alert.
        <StyledVisuallyHidden id={errorId} role="alert">
          {error}
        </StyledVisuallyHidden>
      )}
    </div>
  )
}

export default memo(Selectbox)
