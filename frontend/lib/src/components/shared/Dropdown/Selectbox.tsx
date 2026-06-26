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
import { Cancel } from "@emotion-icons/material-rounded"
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
import { useFloatingOverlay } from "~lib/hooks/useFloatingOverlay"
import { convertRemToPx } from "~lib/theme/utils"
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

type ComboOption = {
  id: string
  label: string
  value: string
  isCreatable?: boolean
}

const CREATABLE_ID = "__creatable__"

/**
 * Null-render component mounted inside <ComboBox> to expose RAC's internal
 * open/close methods via refs. Required because ComboBox v1.x has no controlled
 * isOpen prop; we use menuTrigger="manual" and open explicitly on pointer/key
 * events to prevent auto-open on Tab-focus (which caused spurious reopens after
 * Streamlit reruns).
 */
const DropdownController = memo<{
  openRef: React.MutableRefObject<(() => void) | null>
  closeRef: React.MutableRefObject<(() => void) | null>
}>(({ openRef, closeRef }) => {
  const state = useContext(ComboBoxStateContext)
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
  return null
})
DropdownController.displayName = "DropdownController"

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
  const { refs, floatingStyles } = useFloatingOverlay({
    open: true,
    placement: "bottom-start",
    offsetPx: convertRemToPx(theme.spacing.twoXS),
    flipOptions: isInSidebar ? false : undefined,
    matchTriggerWidth: true,
  })

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

  // Set by handleSelectionChange when RAC commits a new selection (arrow-nav +
  // Enter). Checked by handleInputKeyDown to avoid double-committing.
  const racHandledEnterRef = useRef(false)

  // Tracks whether the dropdown is open. RAC can fire deferred onSelectionChange
  // callbacks after the dropdown closes; those are discarded via this ref.
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

  const displayOptions = useMemo<ComboOption[]>(
    () =>
      creatableItem ? [...filteredOptions, creatableItem] : filteredOptions,
    [filteredOptions, creatableItem]
  )

  // Controlled selectedKey so RAC always knows the committed item and doesn't
  // revert the input to "" on blur before handleBlur can restore it.
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
  // Don't use `readOnly` for FILTER_MODE_NONE: it disables RAC's internal
  // keyboard navigation (Arrow keys, Enter). Block character input via
  // onKeyDown/onPaste instead.
  const inputReadOnly =
    isMobile() && options.length <= 10 && !acceptNewOptions && !isFilterNone

  /**
   * Commit a selection: update local state and notify the parent.
   * Does NOT close the dropdown — callers on the manual paths (keydown,
   * clear button) close explicitly; RAC-triggered paths (option click,
   * arrow-nav + Enter) let RAC close the dropdown naturally after
   * onSelectionChange returns. Calling state.close() inside
   * onSelectionChange causes RAC to fire onInputChange with the old
   * committed label, overwriting our setInputValue update.
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
      // Discard callbacks when the dropdown is closed. RAC fires
      // onSelectionChange(currentKey) on close and via deferred pointerup
      // listeners — both arrive after the real selection is already handled.
      // Genuine selections always fire BEFORE onOpenChange(false), so this
      // guard correctly lets them through.
      if (!isOpenRef.current) return

      // Mark that RAC committed a new selection so handleInputKeyDown can skip
      // its auto-select and avoid double-committing (arrow-nav + Enter path).
      if (key !== null) {
        const currentKey =
          selectOptions.find(o => o.value === valueRef.current)?.id ?? null
        if (String(key) !== String(currentKey ?? "")) {
          racHandledEnterRef.current = true
        }
      }

      if (key === null) {
        // RAC fires null when the typed text no longer matches the committed
        // item. Only revert display text when the user isn't actively typing.
        if (!filterActiveRef.current) {
          setInputValue(valueRef.current ?? "")
          setFilterActive(false)
        }
        return
      }

      const keyStr = String(key)
      const found = selectOptions.find(o => o.id === keyStr)
      // Read inputValue via ref for creatable items to avoid a stale closure.
      const selected =
        keyStr === CREATABLE_ID
          ? inputValueRef.current
          : (found?.value ?? null)

      commitSelection(selected)
    },
    [commitSelection, selectOptions]
  )

  const handleOpenChange = useCallback((open: boolean): void => {
    isOpenRef.current = open
  }, [])

  const handleInputChange = useCallback((text: string): void => {
    setInputValue(text)
    // RAC calls onInputChange(committedLabel) when the dropdown closes to
    // revert the input — don't treat that automatic revert as user filtering.
    if (text !== (valueRef.current ?? "")) {
      setFilterActive(true)
      openDropdownRef.current?.()
    } else {
      setFilterActive(false)
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
   * - Clears the value on Escape when clearable.
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
      }
      if (
        (e.key === "ArrowDown" || e.key === "ArrowUp") &&
        !isOpenRef.current
      ) {
        openDropdownRef.current?.()
      }
      if (
        e.key === "Escape" &&
        clearable &&
        !isNullOrUndefined(valueRef.current)
      ) {
        e.preventDefault()
        commitSelection(null)
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

      if (racHandledEnterRef.current) {
        racHandledEnterRef.current = false
        return
      }

      if (creatableItem) {
        commitSelection(inputValue)
        closeDropdownRef.current?.()
        return
      }

      if (!wasOpenBeforeEnterRef.current) return

      if (displayOptions.length > 0) {
        const exactMatch = displayOptions.find(
          o => !o.isCreatable && o.value === inputValue
        )
        const target =
          exactMatch ??
          (!displayOptions[0].isCreatable ? displayOptions[0] : null)
        if (target) {
          commitSelection(target.value)
          closeDropdownRef.current?.()
        }
      }
    },
    [commitSelection, creatableItem, displayOptions, inputValue]
  )

  const handleClearValue = useCallback((): void => {
    commitSelection(null)
    closeDropdownRef.current?.()
  }, [commitSelection])

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
          menuTrigger="manual"
          aria-label={label ?? "Selectbox"}
        >
          <DropdownController
            openRef={openDropdownRef}
            closeRef={closeDropdownRef}
          />
          <StyledGroup ref={refs.setReference}>
            <StyledInput
              placeholder={resolvedPlaceholder}
              readOnly={inputReadOnly}
              onPointerDown={handleInputPointerDown}
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
            ref={refs.setFloating}
            data-testid="stSelectboxVirtualDropdown"
            placement="bottom left"
            isNonModal
            $isInSidebar={isInSidebar}
            offset={0}
            style={floatingStyles}
          >
            <StyledListBox
              aria-label={label ?? "Selectbox options"}
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
