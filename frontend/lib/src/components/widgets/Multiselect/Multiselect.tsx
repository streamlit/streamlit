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
  useLayoutEffect,
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

import {
  MultiSelect as MultiSelectProto,
  streamlit,
} from "@streamlit/protobuf"

import IsSidebarContext from "~lib/components/core/IsSidebarContext"
import InlineTagGroup from "~lib/components/shared/Tag/InlineTagGroup"
import { WidgetLabel } from "~lib/components/widgets/BaseWidget/WidgetLabel"
import { WidgetLabelHelpIcon } from "~lib/components/widgets/BaseWidget/WidgetLabelHelpIcon"
import {
  useBasicWidgetState,
  ValueWithSource,
} from "~lib/hooks/useBasicWidgetState"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { useExecuteWhenChanged } from "~lib/hooks/useExecuteWhenChanged"
import { useFloatingOverlay } from "~lib/hooks/useFloatingOverlay"
import {
  MULTISELECT_CREATABLE_ID,
  MULTISELECT_SELECT_ALL_ID,
  MULTISELECT_SELECT_MATCHES_ID,
  useMultiselectFiltering,
} from "~lib/hooks/useMultiselectFiltering"
import { convertRemToPx } from "~lib/theme/utils"
import { getSelectFilterMode } from "~lib/util/fuzzyFilterSelectOptions"
import { isMobile } from "~lib/util/isMobile"
import {
  getSelectPlaceholder,
  labelVisibilityProtoValueToEnum,
} from "~lib/util/utils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import {
  StyledClearButton,
  StyledEmptyState,
  StyledGroup,
  StyledInput,
  StyledItemHighlight,
  StyledListBox,
  StyledListBoxItem,
  StyledOpenButton,
  StyledPopover,
  StyledRightControls,
} from "./styled-components"

export interface Props {
  disabled: boolean
  element: MultiSelectProto
  widgetMgr: WidgetStateManager
  fragmentId?: string
}

type MultiselectValue = string[]

const getStateFromWidgetMgr = (
  widgetMgr: WidgetStateManager,
  element: MultiSelectProto
): MultiselectValue | undefined => widgetMgr.getStringArrayValue(element)

const getDefaultStateFromProto = (
  element: MultiSelectProto
): MultiselectValue => element.default.map(i => element.options[i]) ?? []

const getCurrStateFromProto = (element: MultiSelectProto): MultiselectValue =>
  element.rawValues ?? []

const updateWidgetMgrState = (
  element: MultiSelectProto,
  widgetMgr: WidgetStateManager,
  valueWithSource: ValueWithSource<MultiselectValue>,
  fragmentId: string | undefined
): void => {
  widgetMgr.setStringArrayValue(
    element,
    valueWithSource.value,
    { fromUi: valueWithSource.fromUi },
    fragmentId
  )
}

/**
 * Null-render component mounted inside <ComboBox> to expose RAC's internal
 * open/close methods via refs. Identical pattern to Selectbox's DropdownController.
 */
const DropdownController = memo<{
  openRef: React.MutableRefObject<(() => void) | null>
  closeRef: React.MutableRefObject<(() => void) | null>
}>(({ openRef, closeRef }) => {
  const state = useContext(ComboBoxStateContext)
  // useLayoutEffect runs synchronously before paint, ensuring openRef.current
  // is set before any browser event (click/pointer) can fire after a commit.
  // useEffect would leave a window between paint and effect where the ref is
  // null — Playwright's fast click dispatch can land in that window.
  useLayoutEffect(() => {
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

const Multiselect: FC<Props> = props => {
  const { element, widgetMgr, fragmentId } = props

  const theme = useEmotionTheme()
  const isInSidebar = useContext(IsSidebarContext)

  // Floating UI for scroll-tracked popover positioning (same pattern as Selectbox).
  const { refs, floatingStyles } = useFloatingOverlay({
    open: true,
    placement: "bottom-start",
    offsetPx: convertRemToPx(theme.spacing.twoXS),
    flipOptions: isInSidebar ? false : undefined,
    matchTriggerWidth: true,
  })

  // ── Query-param binding ──────────────────────────────────────────────────
  const queryParamBinding = element.queryParamKey
    ? {
        paramKey: element.queryParamKey,
        valueType: "string_array_value" as const,
        clearable: true,
        urlFormat: "repeated" as const,
      }
    : undefined

  // ── Widget state ─────────────────────────────────────────────────────────
  const [value, setValueWithSource] = useBasicWidgetState<
    MultiselectValue,
    MultiSelectProto
  >({
    getStateFromWidgetMgr,
    getDefaultStateFromProto,
    getCurrStateFromProto,
    updateWidgetMgrState,
    element,
    widgetMgr,
    fragmentId,
    formClearBehavior: "resetValueOnly",
    queryParamBinding,
  })

  // ── Local UI state ───────────────────────────────────────────────────────
  // Display text in the ComboBox input. We clear it after each selection.
  const [inputValue, setInputValue] = useState("")

  // True while the user is actively typing.
  const [filterActive, setFilterActive] = useState(false)

  // Always-current mirrors for use inside stale RAC closures.
  const valueRef = useRef(value)
  valueRef.current = value

  const inputValueRef = useRef(inputValue)
  inputValueRef.current = inputValue

  const filterActiveRef = useRef(filterActive)
  filterActiveRef.current = filterActive

  // Tracks whether the dropdown is currently open.
  const isOpenRef = useRef(false)

  // Set in handleSelectionChange so that handleInputChange can ignore the
  // automatic onInputChange("apple") that RAC fires right after selection.
  const justSelectedRef = useRef(false)

  // Ref that holds the filtered match values when "Select X matches" is shown.
  // Updated synchronously from useMultiselectFiltering result.
  const selectMatchesValuesRef = useRef<string[]>([])

  // Refs to imperatively open / close the RAC dropdown.
  const openDropdownRef = useRef<(() => void) | null>(null)
  const closeDropdownRef = useRef<(() => void) | null>(null)

  // Scroll preservation for the tag container.
  const tagContainerRef = useRef<HTMLDivElement>(null)
  const scrollTopRef = useRef(0)

  // ── Sync value when backend pushes an update ─────────────────────────────
  // (form clear, session state, etc.) — `value` is already updated by
  // useBasicWidgetState; here we just reset the local filter input.
  useExecuteWhenChanged(() => {
    setInputValue("")
    setFilterActive(false)
  }, [value])

  // ── Derived state ────────────────────────────────────────────────────────
  const { options } = element
  const acceptNewOptions = element.acceptNewOptions ?? false
  const maxSelections = element.maxSelections ?? 0
  const overMaxSelections = maxSelections > 0 && value.length >= maxSelections

  const isFilterNone =
    getSelectFilterMode(element.filterMode) ===
    streamlit.SelectWidgetFilterMode.FILTER_MODE_NONE

  // On mobile with a short option list and no creatable mode, hide the
  // on-screen keyboard by making the input readOnly.
  const inputReadOnly =
    isFilterNone || (isMobile() && !acceptNewOptions && options.length <= 10)

  const { placeholder: resolvedPlaceholder, shouldDisable } =
    getSelectPlaceholder(element.placeholder, options, acceptNewOptions, true)
  const disabled = props.disabled || shouldDisable

  const showPlaceholder = value.length === 0 && inputValue === ""

  // Dynamic "no results" message adapts to maxSelections state.
  const noResultsMsg = useMemo(() => {
    if (maxSelections > 0 && value.length === maxSelections) {
      const word = maxSelections !== 1 ? "options" : "option"
      return `You can only select up to ${maxSelections} ${word}. Remove an option first.`
    }
    return "No results"
  }, [maxSelections, value.length])

  // Max height of the tag container (cuts at ~4.5 rows to hint scroll).
  const tagContainerMaxHeight = useMemo(() => {
    const rowHeight = `calc(${theme.sizes.elementHighlightHeight} + ${theme.sizes.tagMarginInsideBorder})`
    return `calc(4.5 * ${rowHeight} + ${theme.sizes.tagMarginInsideBorder})`
  }, [theme.sizes.elementHighlightHeight, theme.sizes.tagMarginInsideBorder])

  // ── Filtering ─────────────────────────────────────────────────────────────
  const { displayOptions, selectMatchesValues } = useMultiselectFiltering({
    options,
    inputValue,
    selectedValues: value,
    filterActive,
    filterMode: element.filterMode,
    acceptNewOptions,
  })

  // Sync match values to ref for use inside the selection callback.
  selectMatchesValuesRef.current = selectMatchesValues

  // When at the maxSelections limit, return an empty list so that the ListBox
  // renders its empty state (the noResultsMsg).
  const displayOptionsWithDisabled = useMemo(() => {
    if (overMaxSelections) return []
    return displayOptions
  }, [displayOptions, overMaxSelections])

  // ── Scroll preservation ───────────────────────────────────────────────────
  // Runs on every render to restore scrollTop before the browser paints,
  // counteracting any state updates that reset the scroll position.
  useLayoutEffect(() => {
    if (tagContainerRef.current) {
      tagContainerRef.current.scrollTop = scrollTopRef.current
    }
  })

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- safe: read during scroll event, layout already done
    scrollTopRef.current = e.currentTarget.scrollTop
  }, [])

  // ── Selection handling ────────────────────────────────────────────────────
  const handleSelectionChange = useCallback(
    (key: Key | null): void => {
      // Discard deferred RAC callbacks that fire after the dropdown has closed.
      if (!isOpenRef.current) return
      if (key === null) return

      const keyStr = String(key)

      // Mark that we just made a selection so handleInputChange can ignore
      // RAC's automatic onInputChange(label) callback.
      justSelectedRef.current = true
      setInputValue("")
      setFilterActive(false)

      const currentValue = valueRef.current

      if (keyStr === MULTISELECT_SELECT_ALL_ID) {
        const unselected = options.filter(o => !currentValue.includes(o))
        const toAdd =
          maxSelections > 0
            ? unselected.slice(0, maxSelections - currentValue.length)
            : unselected
        setValueWithSource({
          value: [...currentValue, ...toAdd],
          fromUi: true,
        })
        void Promise.resolve().then(() => openDropdownRef.current?.())
        return
      }

      if (keyStr === MULTISELECT_SELECT_MATCHES_ID) {
        const matches = selectMatchesValuesRef.current.filter(
          m => !currentValue.includes(m)
        )
        const toAdd =
          maxSelections > 0
            ? matches.slice(0, maxSelections - currentValue.length)
            : matches
        setValueWithSource({
          value: [...currentValue, ...toAdd],
          fromUi: true,
        })
        void Promise.resolve().then(() => openDropdownRef.current?.())
        return
      }

      if (keyStr === MULTISELECT_CREATABLE_ID) {
        const newOption = inputValueRef.current.trim()
        if (!newOption) return
        if (maxSelections > 0 && currentValue.length >= maxSelections) return
        if (currentValue.includes(newOption)) return
        setValueWithSource({
          value: [...currentValue, newOption],
          fromUi: true,
        })
        void Promise.resolve().then(() => openDropdownRef.current?.())
        return
      }

      // Regular option selection — enforce maxSelections.
      if (maxSelections > 0 && currentValue.length >= maxSelections) return

      // Find the option by ID to get its string value.
      const opt = displayOptions.find(o => o.id === keyStr)
      if (!opt || opt.isSelectAll) return

      setValueWithSource({
        value: [...currentValue, opt.value],
        fromUi: true,
      })

      // Keep dropdown open for multi-selection.
      void Promise.resolve().then(() => openDropdownRef.current?.())
    },
    [displayOptions, maxSelections, options, setValueWithSource]
  )

  // ── Input change handling ─────────────────────────────────────────────────
  const handleInputChange = useCallback((text: string): void => {
    // Ignore RAC's automatic onInputChange(label) fired right after selection.
    if (justSelectedRef.current) {
      justSelectedRef.current = false
      return
    }
    setInputValue(text)
    if (text !== "") {
      setFilterActive(true)
      openDropdownRef.current?.()
    } else {
      setFilterActive(false)
    }
  }, [])

  const handleOpenChange = useCallback((open: boolean): void => {
    isOpenRef.current = open
  }, [])

  // ── Tag removal ───────────────────────────────────────────────────────────
  const removeTag = useCallback(
    (item: string): void => {
      setValueWithSource({
        value: valueRef.current.filter(v => v !== item),
        fromUi: true,
      })
    },
    [setValueWithSource]
  )

  // ── Clear all ─────────────────────────────────────────────────────────────
  const handleClearAll = useCallback((): void => {
    setValueWithSource({ value: [], fromUi: true })
    closeDropdownRef.current?.()
  }, [setValueWithSource])

  // ── Pointer / keyboard interaction ────────────────────────────────────────
  const handleInputPointerDown = useCallback((): void => {
    if (disabled) return
    openDropdownRef.current?.()
  }, [disabled])

  // Also open on click so that the dropdown reliably opens regardless of whether
  // the browser dispatches pointerdown before or after focus events.
  const handleInputClick = useCallback((): void => {
    if (disabled) return
    openDropdownRef.current?.()
  }, [disabled])

  // True when the widget has a proto default (mirrors st.selectbox clearable logic).
  const hasDefault = element.default.length > 0

  /**
   * Capture-phase keydown — fires before RAC's handler:
   * - Opens the dropdown on ArrowUp / ArrowDown when closed.
   * - For FILTER_MODE_NONE (which also sets readOnly), additional safety:
   *   block character keys in case the browser ignores readOnly in some edge cases.
   * - Clears all selections on Escape when the dropdown is closed and the widget
   *   has no default (i.e. is clearable), matching st.selectbox ESC semantics.
   */
  const handleInputKeyDownCapture = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>): void => {
      if (disabled) return
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
      if (
        (e.key === "ArrowDown" || e.key === "ArrowUp") &&
        !isOpenRef.current
      ) {
        openDropdownRef.current?.()
      }
      if (
        e.key === "Escape" &&
        !isOpenRef.current &&
        !hasDefault &&
        valueRef.current.length > 0
      ) {
        setValueWithSource({ value: [], fromUi: true })
      }
    },
    [disabled, hasDefault, isFilterNone, setValueWithSource]
  )

  // ── Keyboard Enter to add creatable item ──────────────────────────────────
  //
  // We handle this directly here (not via handleSelectionChange) because RAC's
  // ComboBox fires onOpenChange(false) during its own Enter keydown handler,
  // which runs in the bubble phase BEFORE this callback. By the time we reach
  // this handler, isOpenRef.current is already false — we must bypass that guard.
  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>): void => {
      if (e.key !== "Enter") return
      const creatableOpt = displayOptions.find(
        o => o.id === MULTISELECT_CREATABLE_ID
      )
      if (!creatableOpt) return

      const newOption = inputValueRef.current.trim()
      if (!newOption) return
      if (maxSelections > 0 && valueRef.current.length >= maxSelections) return
      if (valueRef.current.includes(newOption)) return

      setValueWithSource({
        value: [...valueRef.current, newOption],
        fromUi: true,
      })
      setInputValue("")
      setFilterActive(false)
      // Reopen the dropdown after adding so the user can continue selecting.
      void Promise.resolve().then(() => openDropdownRef.current?.())
    },
    [displayOptions, maxSelections, setValueWithSource]
  )

  // ── Render ────────────────────────────────────────────────────────────────
  const labelVisibility = labelVisibilityProtoValueToEnum(
    element.labelVisibility?.value
  )

  const filterInput = (
    <StyledInput
      placeholder={showPlaceholder ? resolvedPlaceholder : undefined}
      readOnly={inputReadOnly ? true : undefined}
      onPointerDown={handleInputPointerDown}
      onClick={handleInputClick}
      onKeyDownCapture={handleInputKeyDownCapture}
      onKeyDown={handleInputKeyDown}
      onPaste={isFilterNone ? e => e.preventDefault() : undefined}
      onCompositionStart={isFilterNone ? e => e.preventDefault() : undefined}
      $placeholderColor={disabled ? theme.colors.fadedText40 : undefined}
    />
  )

  return (
    <div className="stMultiSelect" data-testid="stMultiSelect">
      <WidgetLabel
        label={element.label}
        disabled={disabled}
        labelVisibility={labelVisibility}
      >
        {element.help && (
          <WidgetLabelHelpIcon content={element.help} label={element.label} />
        )}
      </WidgetLabel>
      <I18nProvider locale="en-US">
        <ComboBox
          // We manage multi-selection manually; selectedKey is always null
          // so RAC never "commits" a single value to the input.
          selectedKey={null}
          inputValue={inputValue}
          onSelectionChange={handleSelectionChange}
          onInputChange={handleInputChange}
          onOpenChange={handleOpenChange}
          isDisabled={disabled}
          allowsCustomValue={acceptNewOptions}
          allowsEmptyCollection
          menuTrigger="manual"
          // Disable RAC's built-in client-side filtering. We do our own
          // filtering in useMultiselectFiltering so pseudo-items like
          // "Select all" / "Select X matches" are never inadvertently
          // stripped out by RAC's filter pass.
          defaultFilter={() => true}
          aria-label={element.label ?? "Multiselect"}
        >
          <DropdownController
            openRef={openDropdownRef}
            closeRef={closeDropdownRef}
          />
          <StyledGroup ref={refs.setReference}>
            <InlineTagGroup
              items={value}
              onRemove={removeTag}
              disabled={disabled}
              containerRef={tagContainerRef}
              onScroll={handleScroll}
              inputElement={filterInput}
              maxHeight={tagContainerMaxHeight}
            />
            <StyledRightControls>
              {value.length > 0 && !disabled && (
                <StyledClearButton
                  aria-label="Clear all"
                  slot={null}
                  onPress={handleClearAll}
                >
                  <Cancel size={theme.iconSizes.md} aria-hidden="true" />
                </StyledClearButton>
              )}
              <StyledOpenButton
                title="open"
                aria-label="Open"
                type="button"
                $disabled={disabled}
                disabled={disabled}
                onClick={() => {
                  if (!disabled) openDropdownRef.current?.()
                }}
              >
                <KeyboardArrowDown
                  size={theme.iconSizes.lg}
                  aria-hidden="true"
                />
              </StyledOpenButton>
            </StyledRightControls>
          </StyledGroup>
          <StyledPopover
            ref={refs.setFloating}
            data-testid="stMultiSelectPopover"
            placement="bottom left"
            isNonModal
            $isInSidebar={isInSidebar}
            offset={0}
            style={floatingStyles}
          >
            {/*
             * Passing `items` to StyledListBox disables RAC's built-in
             * client-side filtering (which would strip out pseudo-items like
             * "Select all" / "Select X matches" because their textValue doesn't
             * match the typed pattern). We manage all filtering ourselves in
             * useMultiselectFiltering.
             */}
            <StyledListBox
              items={displayOptionsWithDisabled}
              aria-label={element.label ?? "Multiselect options"}
              renderEmptyState={() => (
                <StyledEmptyState>{noResultsMsg}</StyledEmptyState>
              )}
            >
              {(rawOpt: unknown) => {
                // `styled(ListBox)` loses the generic parameter; cast back to
                // the actual element type so we can access typed properties.
                type Opt = (typeof displayOptionsWithDisabled)[number]
                const opt = rawOpt as Opt
                return (
                  <StyledListBoxItem
                    key={opt.id}
                    id={opt.id}
                    textValue={opt.label}
                    isDisabled={
                      (opt as Opt & { isDisabled?: boolean }).isDisabled ??
                      false
                    }
                    $isCreatable={opt.isCreatable}
                    $isSelectAll={
                      opt.isSelectAll ||
                      opt.id === MULTISELECT_SELECT_MATCHES_ID
                    }
                  >
                    <StyledItemHighlight data-item-hl="">
                      {opt.label}
                    </StyledItemHighlight>
                  </StyledListBoxItem>
                )
              }}
            </StyledListBox>
          </StyledPopover>
        </ComboBox>
      </I18nProvider>
    </div>
  )
}

export default memo(Multiselect)
