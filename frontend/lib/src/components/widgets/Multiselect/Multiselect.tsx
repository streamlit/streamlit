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
  type ReactElement,
  useCallback,
  useContext,
  useEffect,
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
  ListLayout,
  Virtualizer,
} from "react-aria-components"

import {
  MultiSelect as MultiSelectProto,
  streamlit,
} from "@streamlit/protobuf"
import { notNullOrUndefined } from "@streamlit/utils"

import IsSidebarContext from "~lib/components/core/IsSidebarContext"
import { useResolvedWrap } from "~lib/components/shared/BaseButton/useResolvedWrap"
import { WidgetLabel } from "~lib/components/widgets/BaseWidget/WidgetLabel"
import { WidgetLabelHelpIcon } from "~lib/components/widgets/BaseWidget/WidgetLabelHelpIcon"
import {
  useBasicWidgetState,
  ValueWithSource,
} from "~lib/hooks/useBasicWidgetState"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { useExecuteWhenChanged } from "~lib/hooks/useExecuteWhenChanged"
import {
  SHIFT_VIEWPORT_PADDING,
  useFloatingOverlay,
} from "~lib/hooks/useFloatingOverlay"
import { useHorizontalScrollOverflow } from "~lib/hooks/useHorizontalScrollOverflow"
import {
  CREATABLE_ID,
  type MultiselectOption,
  SELECT_ALL_ID,
  SELECT_MATCHES_ID,
  useMultiselectFiltering,
} from "~lib/hooks/useMultiselectFiltering"
import { useScrollbarGutterSize } from "~lib/hooks/useScrollbarGutterSize"
import { convertRemToPx } from "~lib/theme/utils"
import { isMobile } from "~lib/util/isMobile"
import {
  getSelectPlaceholder,
  labelVisibilityProtoValueToEnum,
} from "~lib/util/utils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import {
  StyledClearButton,
  StyledEmptyState,
  StyledFilterInput,
  StyledItemHighlight,
  StyledListBox,
  StyledListBoxItem,
  StyledOpenButton,
  StyledPopover,
  StyledTag,
  StyledTagGroup,
  StyledTagRemoveButton,
  StyledTagsContainer,
  StyledTagText,
  StyledTrigger,
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
): MultiselectValue | undefined => {
  return widgetMgr.getStringArrayValue(element)
}

const getDefaultStateFromProto = (
  element: MultiSelectProto
): MultiselectValue => {
  return element.default.map(i => element.options[i])
}

const getCurrStateFromProto = (
  element: MultiSelectProto
): MultiselectValue => {
  return element.rawValues ?? []
}

const updateWidgetMgrState = (
  element: MultiSelectProto,
  widgetMgr: WidgetStateManager,
  valueWithSource: ValueWithSource<MultiselectValue>,
  fragmentId: string | undefined
): void => {
  widgetMgr.setStringArrayValue(element.id, valueWithSource.value, {
    formId: element.formId,
    fragmentId,
    fromUser: valueWithSource.fromUser,
  })
}

/**
 * Null-render component mounted inside <ComboBox> to expose RAC's internal
 * open/close methods and focusedKey via refs. Same pattern as the Selectbox widget.
 */
const DropdownController = memo<{
  openRef: React.MutableRefObject<
    ((focusStrategy?: "first" | "last" | null) => void) | null
  >
  focusedKeyRef: React.MutableRefObject<Key | null>
}>(({ openRef, focusedKeyRef }) => {
  const state = useContext(ComboBoxStateContext)
  useEffect(() => {
    if (state) {
      openRef.current = (focusStrategy = null) =>
        state.open(focusStrategy, "manual")
    }
    return () => {
      openRef.current = null
    }
  }, [state, openRef])
  // Read synchronously — an effect would leave a stale-read window for keydown handlers
  focusedKeyRef.current = state?.selectionManager.focusedKey ?? null
  return null
})
DropdownController.displayName = "DropdownController"

const TagRemoveIcon: FC = () => (
  <svg
    aria-hidden="true"
    height="0.5em"
    width="0.5em"
    viewBox="0 0 10 10"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M9 1L5 5M1 9L5 5M5 5L1 1M5 5L9 9"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="2"
    />
  </svg>
)

/** Render a single option. Cast required: styled(ListBox) erases the generic item type. */
const renderOption = (item: unknown): ReactElement => {
  const option = item as MultiselectOption
  return (
    <StyledListBoxItem
      id={option.id}
      textValue={option.label}
      $isCreatable={option.isCreatable}
      $isBulkAction={option.isBulkAction}
    >
      <StyledItemHighlight data-item-hl="">{option.label}</StyledItemHighlight>
    </StyledListBoxItem>
  )
}

/**
 * Pass-through filter for RAC's <ComboBox defaultFilter>. Our own
 * `filterSelectOptions` runs upstream in useMultiselectFiltering, so RAC
 * must not re-filter — otherwise its built-in "contains" strategy drops
 * fuzzy matches and pseudo-options like "Select X matches". See #16003.
 */
const PASS_THROUGH_FILTER = (): boolean => true

const preventInputEvent = (e: React.SyntheticEvent): void => {
  e.preventDefault()
}

const Multiselect: FC<Props> = props => {
  const { element, widgetMgr, fragmentId } = props

  const theme = useEmotionTheme()
  const isInSidebar = useContext(IsSidebarContext)
  const scrollbarGutterSize = useScrollbarGutterSize()
  const tagsContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollTopRef = useRef(0)
  const scrollLeftRef = useRef(0)
  const scrollLockRef = useRef(false)
  const focusedTagIndexRef = useRef(0)

  const queryParamBinding = element.queryParamKey
    ? {
        paramKey: element.queryParamKey,
        valueType: "string_array_value" as const,
        clearable: true,
        urlFormat: "repeated" as const,
      }
    : undefined

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

  // Local filter state — filterActive is derived from inputValue to avoid sync issues
  const [inputValue, setInputValue] = useState("")
  const filterActive = inputValue !== ""
  const filterActiveRef = useRef(false)
  filterActiveRef.current = filterActive
  const inputValueRef = useRef("")
  inputValueRef.current = inputValue

  // Clear stale filter when value changes externally (rerun, session state, etc.)
  useExecuteWhenChanged(() => setInputValue(""), [value])

  const isOpenRef = useRef(false)
  const openDropdownRef = useRef<
    ((focusStrategy?: "first" | "last" | null) => void) | null
  >(null)
  const focusedKeyRef = useRef<Key | null>(null)

  // In the sidebar, flip/shift are bounded by the viewport so the dropdown can
  // flip up when near the bottom, rather than overflowing (see #16181).
  const sidebarBoundary = isInSidebar
    ? { boundary: document.documentElement }
    : undefined

  const { refs, floatingStyles } = useFloatingOverlay({
    open: true,
    placement: "bottom-start",
    offsetPx: convertRemToPx(theme.spacing.twoXS),
    flipOptions: sidebarBoundary,
    shiftOptions: sidebarBoundary && {
      ...sidebarBoundary,
      padding: SHIFT_VIEWPORT_PADDING,
    },
    matchTriggerWidth: true,
  })

  const { displayOptions, resolvedFilterMode } = useMultiselectFiltering({
    options: element.options,
    selectedValues: value,
    inputValue,
    filterActive,
    filterMode: element.filterMode,
    acceptNewOptions: element.acceptNewOptions ?? false,
    maxSelections: element.maxSelections,
  })

  const displayOptionsRef = useRef(displayOptions)
  displayOptionsRef.current = displayOptions
  const valueRef = useRef(value)
  valueRef.current = value

  const isFilterNone =
    resolvedFilterMode === streamlit.SelectWidgetFilterMode.FILTER_MODE_NONE

  const { placeholder, shouldDisable: placeholderDisable } = useMemo(
    () =>
      getSelectPlaceholder(
        element.placeholder,
        element.options,
        element.acceptNewOptions ?? false,
        true
      ),
    [element.placeholder, element.options, element.acceptNewOptions]
  )

  const disabled = props.disabled || placeholderDisable

  // Resolve the tri-state wrap proto field: true = chips wrap onto multiple
  // rows (grows vertically), false = chips stay in a single, horizontally
  // scrollable row.
  const wrap = useResolvedWrap(element.wrap)
  const { canScrollLeft, canScrollRight } = useHorizontalScrollOverflow({
    elementRef: tagsContainerRef,
    enabled: !wrap,
    layoutKey: value,
  })

  // Max height. When wrapping, cut through the 5th tag row so the control can
  // grow and scroll vertically. When not wrapping, pin the control to a single
  // row height so it stays aligned regardless of the selection count.
  const maxHeight = useMemo(() => {
    if (!wrap) {
      return theme.sizes.minElementHeight
    }
    const rowHeight = `calc(${theme.sizes.elementHighlightHeight} + ${theme.sizes.tagMarginInsideBorder})`
    return `calc(4.5 * ${rowHeight} + ${theme.sizes.tagMarginInsideBorder} + 2 * ${theme.sizes.borderWidth})`
  }, [
    wrap,
    theme.sizes.minElementHeight,
    theme.sizes.elementHighlightHeight,
    theme.sizes.tagMarginInsideBorder,
    theme.sizes.borderWidth,
  ])

  const virtualizerLayoutOptions = useMemo(
    () => ({
      rowSize: convertRemToPx(theme.sizes.dropdownItemHeight),
    }),
    [theme.sizes.dropdownItemHeight]
  )

  // maxSelections === 0 means "no limit"
  const noResultsMsg = useMemo(() => {
    if (element.maxSelections === 0) return "No results"
    if (value.length >= element.maxSelections) {
      const option = element.maxSelections !== 1 ? "options" : "option"
      return `You can only select up to ${element.maxSelections} ${option}. Remove an option first.`
    }
    return "No results"
  }, [element.maxSelections, value.length])

  // Tracks the previous selection count to distinguish additions from removals.
  const prevValueLengthRef = useRef(value.length)

  // Preserve scroll position when tags are removed via UI interaction, and
  // reveal the newest chip + input when a tag is added in single-row mode.
  useLayoutEffect(() => {
    const prevLength = prevValueLengthRef.current
    prevValueLengthRef.current = value.length
    const container = tagsContainerRef.current
    if (!container) return

    if (scrollLockRef.current) {
      const savedTop = scrollTopRef.current
      const savedLeft = scrollLeftRef.current
      scrollLockRef.current = false
      requestAnimationFrame(() => {
        container.scrollTop = savedTop
        container.scrollLeft = savedLeft
        scrollTopRef.current = savedTop
        scrollLeftRef.current = savedLeft
      })
      return
    }

    // A selection was added while chips are in a single row: scroll to the end
    // so the newest chip and the input stay visible.
    if (!wrap && value.length > prevLength) {
      requestAnimationFrame(() => {
        // eslint-disable-next-line streamlit-custom/no-force-reflow-access
        container.scrollLeft = container.scrollWidth
        // eslint-disable-next-line streamlit-custom/no-force-reflow-access
        scrollLeftRef.current = container.scrollLeft
      })
    }
  }, [value, wrap])

  const handleTagsScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (scrollLockRef.current) return
    const target = e.currentTarget
    // eslint-disable-next-line streamlit-custom/no-force-reflow-access
    scrollTopRef.current = target.scrollTop
    // eslint-disable-next-line streamlit-custom/no-force-reflow-access
    scrollLeftRef.current = target.scrollLeft
  }, [])

  const handleChange = useCallback(
    (keys: Key[]): void => {
      if (!isOpenRef.current) return

      const selectedKeys = keys.map(String)

      // Check for bulk action keys
      const bulkActionKey = selectedKeys.find(
        k => k === SELECT_ALL_ID || k === SELECT_MATCHES_ID
      )

      if (bulkActionKey) {
        // Bulk select: add all currently displayed (non-special) options
        const options = displayOptionsRef.current
        const optionsToAdd = options
          .filter(o => !o.isBulkAction && !o.isCreatable)
          .map(o => o.value)

        let newValue: string[]
        if (element.maxSelections > 0) {
          const remainingSlots = element.maxSelections - value.length
          newValue = [...value, ...optionsToAdd.slice(0, remainingSlots)]
        } else {
          newValue = [...value, ...optionsToAdd]
        }

        setValueWithSource({ value: newValue, fromUser: true })
        setInputValue("")
        return
      }

      // Check for creatable key — use ref to avoid stale closure
      if (selectedKeys.includes(CREATABLE_ID)) {
        if (
          element.maxSelections > 0 &&
          value.length >= element.maxSelections
        ) {
          return
        }
        if (value.includes(inputValueRef.current)) {
          setInputValue("")
          return
        }
        const newValue = [...value, inputValueRef.current]
        setValueWithSource({ value: newValue, fromUser: true })
        setInputValue("")
        return
      }

      // Normal toggle: compute the diff
      // selectedKeys from RAC contains the full new selection set (option IDs)
      // We need to map IDs back to values. Bulk-action and creatable keys are
      // already handled by early returns above, so only filter undefined here.
      const optionById = new Map(
        displayOptionsRef.current
          .filter(o => !o.isBulkAction && !o.isCreatable)
          .map(o => [o.id, o.value])
      )
      const newValues = selectedKeys
        .map(id => optionById.get(id))
        .filter((v): v is string => v !== undefined)

      // Merge with existing values that aren't in the current display
      // (already-selected items not shown in the filtered list)
      const displayedValues = new Set(optionById.values())
      const preservedValues = value.filter(v => !displayedValues.has(v))
      const finalValue = [...preservedValues, ...newValues]

      if (
        element.maxSelections > 0 &&
        finalValue.length > element.maxSelections
      ) {
        return
      }

      setValueWithSource({ value: finalValue, fromUser: true })
      setInputValue("")
    },
    [element.maxSelections, setValueWithSource, value]
  )

  const handleInputChange = useCallback((text: string): void => {
    // RAC can echo the previous filter text via onInputChange when the menu
    // closes. Unlike the single-select Selectbox (which displays a committed
    // label when closed), the multiselect input should be empty when closed.
    // Ignore echoes entirely so they don't overwrite the clear from
    // handleOpenChange or trigger a reopen.
    if (text === inputValueRef.current) return

    setInputValue(text)
    if (text !== "" && !isOpenRef.current) {
      openDropdownRef.current?.()
    }
  }, [])

  const handleOpenChange = useCallback((open: boolean): void => {
    isOpenRef.current = open
    if (!open) {
      setInputValue("")
    }
  }, [])

  const handleTagGroupRemove = useCallback(
    (keys: Set<Key>): void => {
      scrollLockRef.current = true
      const container = tagsContainerRef.current
      if (container) {
        // eslint-disable-next-line streamlit-custom/no-force-reflow-access
        scrollTopRef.current = container.scrollTop
        // eslint-disable-next-line streamlit-custom/no-force-reflow-access
        scrollLeftRef.current = container.scrollLeft
      }
      const keysToRemove = new Set([...keys].map(String))
      const newValue = valueRef.current.filter(v => !keysToRemove.has(v))
      valueRef.current = newValue
      setValueWithSource({ value: newValue, fromUser: true })
    },
    [setValueWithSource]
  )

  const handleTagKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLSpanElement>): void => {
      const tag = e.currentTarget
      const container = tag.parentElement
      if (!container) return

      const tags = Array.from(
        container.querySelectorAll<HTMLElement>("[data-tag]")
      )
      const idx = tags.indexOf(tag)

      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault()
        const prev = tags[idx - 1]
        if (prev) {
          tag.tabIndex = -1
          prev.tabIndex = 0
          prev.focus()
          focusedTagIndexRef.current = idx - 1
        }
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault()
        const next = tags[idx + 1]
        if (next) {
          tag.tabIndex = -1
          next.tabIndex = 0
          next.focus()
          focusedTagIndexRef.current = idx + 1
        } else {
          tag.tabIndex = -1
          const first = tags[0]
          if (first) first.tabIndex = 0
          focusedTagIndexRef.current = 0
          inputRef.current?.focus()
        }
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault()
        const tagValue = value[idx]
        if (tagValue !== undefined) {
          const nextFocus = tags[idx + 1] ?? tags[idx - 1]
          handleTagGroupRemove(new Set([tagValue]))
          if (nextFocus && nextFocus !== tag) {
            // After removal, right neighbor slides to idx; left stays at idx-1
            focusedTagIndexRef.current =
              nextFocus === tags[idx + 1] ? idx : idx - 1
            nextFocus.tabIndex = 0
            nextFocus.focus({ preventScroll: true })
          } else {
            focusedTagIndexRef.current = 0
            inputRef.current?.focus({ preventScroll: true })
          }
        }
      } else if (e.key === "Home") {
        e.preventDefault()
        const first = tags[0]
        if (first && first !== tag) {
          tag.tabIndex = -1
          first.tabIndex = 0
          first.focus()
          focusedTagIndexRef.current = 0
        }
      } else if (e.key === "End") {
        e.preventDefault()
        const last = tags[tags.length - 1]
        if (last && last !== tag) {
          tag.tabIndex = -1
          last.tabIndex = 0
          last.focus()
          focusedTagIndexRef.current = tags.length - 1
        }
      } else if (e.key === " ") {
        e.preventDefault()
      }
    },
    [handleTagGroupRemove, value]
  )

  const handleTagPointerDown = useCallback(
    (e: React.PointerEvent<HTMLSpanElement>): void => {
      const clicked = e.currentTarget
      const container = clicked.parentElement
      if (!container) return
      const tags = container.querySelectorAll<HTMLElement>("[data-tag]")
      tags.forEach(t => {
        t.tabIndex = t === clicked ? 0 : -1
      })
      const idx = Number(clicked.dataset.tagIndex)
      focusedTagIndexRef.current = idx
    },
    []
  )

  const handleClearAll = useCallback((): void => {
    setValueWithSource({ value: [], fromUser: true })
  }, [setValueWithSource])

  const handleContainerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>): void => {
      if (disabled) return
      const target = e.target as HTMLElement
      // Ignore clicks on buttons and tags — only empty space triggers focus/open
      if (target.closest("button") || target.closest("[data-tag]")) return
      inputRef.current?.focus()
      openDropdownRef.current?.()
    },
    [disabled]
  )

  const handleInputPointerDown = useCallback((): void => {
    if (disabled) return
    openDropdownRef.current?.()
  }, [disabled])

  const handleInputKeyDownCapture = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>): void => {
      if (disabled) return

      // RAC binds Mod+A to "select all options" while the menu is open and
      // calls preventDefault(), which would keep the user from selecting the
      // typed filter text. stopPropagation (without preventDefault) keeps the
      // input's native select-all.
      if (
        e.key.toLowerCase() === "a" &&
        (e.ctrlKey || e.metaKey) &&
        !e.altKey &&
        !e.shiftKey
      ) {
        e.stopPropagation()
        return
      }

      // Block character input for FILTER_MODE_NONE, but allow Backspace
      // through when input is empty so the tag-removal handler can process it.
      if (isFilterNone && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const isTagRemoval =
          e.key === "Backspace" && !e.currentTarget.value && value.length > 0
        if (
          !isTagRemoval &&
          (e.key.length === 1 || e.key === "Backspace" || e.key === "Delete")
        ) {
          e.preventDefault()
          return
        }
      }

      if (
        (e.key === "ArrowDown" || e.key === "ArrowUp") &&
        !isOpenRef.current
      ) {
        openDropdownRef.current?.()
      }

      if (e.key === "Escape") {
        if (filterActiveRef.current) {
          // Layered: first Escape clears filter (keeps dropdown open),
          // RAC handles the next Escape to close the dropdown.
          e.preventDefault()
          e.stopPropagation()
          setInputValue("")
          return
        }
      }

      // Creatable Enter: commit typed text as a new option.
      // Only create when no item is focused or CREATABLE_ID is focused.
      // If focus is on a real option or bulk action, let RAC handle it.
      if (
        e.key === "Enter" &&
        !e.nativeEvent.isComposing &&
        (element.acceptNewOptions ?? false)
      ) {
        const currentInput = inputValueRef.current
        if (currentInput) {
          const focused = focusedKeyRef.current
          const shouldCreate =
            !notNullOrUndefined(focused) || String(focused) === CREATABLE_ID

          if (shouldCreate) {
            const alreadyExists =
              element.options.some(o => o === currentInput) ||
              value.includes(currentInput)
            if (!alreadyExists) {
              if (
                element.maxSelections > 0 &&
                value.length >= element.maxSelections
              ) {
                e.preventDefault()
                e.stopPropagation()
                return
              }
              e.preventDefault()
              e.stopPropagation()
              const newValue = [...value, currentInput]
              setValueWithSource({ value: newValue, fromUser: true })
              setInputValue("")
              return
            }
          }
        }
      }

      // Backspace on empty input removes last tag
      if (
        e.key === "Backspace" &&
        !e.currentTarget.value &&
        value.length > 0
      ) {
        e.preventDefault()
        scrollLockRef.current = true
        const container = tagsContainerRef.current
        if (container) {
          // eslint-disable-next-line streamlit-custom/no-force-reflow-access
          scrollTopRef.current = container.scrollTop
          // eslint-disable-next-line streamlit-custom/no-force-reflow-access
          scrollLeftRef.current = container.scrollLeft
        }
        const newValue = valueRef.current.slice(0, -1)
        valueRef.current = newValue
        setValueWithSource({ value: newValue, fromUser: true })
      }
    },
    [
      disabled,
      element.acceptNewOptions,
      element.maxSelections,
      element.options,
      isFilterNone,
      setValueWithSource,
      value,
    ]
  )

  // Map selected values to option IDs for the ComboBox selection prop
  const optionIndexMap = useMemo(
    () => new Map(element.options.map((opt, idx) => [opt, idx])),
    [element.options]
  )
  const selectedKeys = useMemo((): Set<Key> => {
    const keys = new Set<Key>()
    for (const v of value) {
      const idx = optionIndexMap.get(v)
      if (idx !== undefined) {
        keys.add(String(idx))
      }
    }
    return keys
  }, [value, optionIndexMap])

  const selectedKeysArray = useMemo(() => [...selectedKeys], [selectedKeys])

  // Only use readOnly for mobile small-list case. Never for isFilterNone —
  // readOnly breaks RAC keyboard navigation (Arrow/Enter). isFilterNone uses
  // inputMode="none" + character blocking in the capture handler instead.
  const inputReadOnly =
    !isFilterNone &&
    isMobile() &&
    element.options.length <= 10 &&
    !(element.acceptNewOptions ?? false)

  // Derive clamped tag index for render — don't mutate ref during render
  const clampedTagIndex = Math.min(
    focusedTagIndexRef.current,
    Math.max(0, value.length - 1)
  )

  return (
    <div className="stMultiSelect" data-testid="stMultiSelect">
      <WidgetLabel
        label={element.label}
        disabled={disabled}
        labelVisibility={labelVisibilityProtoValueToEnum(
          element.labelVisibility?.value
        )}
      >
        {element.help && (
          <WidgetLabelHelpIcon content={element.help} label={element.label} />
        )}
      </WidgetLabel>
      <I18nProvider locale="en-US">
        <ComboBox
          selectionMode="multiple"
          value={selectedKeysArray}
          inputValue={inputValue}
          onChange={handleChange}
          onInputChange={handleInputChange}
          onOpenChange={handleOpenChange}
          isDisabled={disabled}
          allowsCustomValue={element.acceptNewOptions ?? false}
          allowsEmptyCollection
          menuTrigger="manual"
          defaultFilter={PASS_THROUGH_FILTER}
          aria-label={element.label || "Multiselect"}
        >
          <DropdownController
            openRef={openDropdownRef}
            focusedKeyRef={focusedKeyRef}
          />
          <StyledTrigger
            ref={refs.setReference}
            $maxHeight={maxHeight}
            onClick={handleContainerClick}
          >
            <StyledTagsContainer
              ref={tagsContainerRef}
              onScroll={handleTagsScroll}
              data-testid="stMultiSelectTagsContainer"
              $wrap={wrap}
              data-can-scroll-start={canScrollLeft ? "" : undefined}
              data-can-scroll-end={canScrollRight ? "" : undefined}
            >
              {value.length > 0 && (
                <StyledTagGroup role="group" aria-label="Selected values">
                  {value.map((v, idx) => (
                    <StyledTag
                      key={v}
                      tabIndex={!disabled && idx === clampedTagIndex ? 0 : -1}
                      aria-label={v}
                      $disabled={disabled}
                      $wrap={wrap}
                      data-tag=""
                      data-tag-index={idx}
                      onKeyDown={disabled ? undefined : handleTagKeyDown}
                      onPointerDown={
                        disabled ? undefined : handleTagPointerDown
                      }
                    >
                      <StyledTagText title={v}>{v}</StyledTagText>
                      {!disabled && (
                        <StyledTagRemoveButton
                          aria-label={`Remove ${v}`}
                          tabIndex={-1}
                          onClick={e => {
                            e.stopPropagation()
                            handleTagGroupRemove(new Set([v]))
                            inputRef.current?.focus({ preventScroll: true })
                          }}
                        >
                          <TagRemoveIcon />
                        </StyledTagRemoveButton>
                      )}
                    </StyledTag>
                  ))}
                </StyledTagGroup>
              )}
              <StyledFilterInput
                ref={inputRef}
                placeholder={value.length === 0 ? placeholder : ""}
                readOnly={inputReadOnly}
                inputMode={isFilterNone ? "none" : undefined}
                $typingDisabled={isFilterNone}
                $hasValues={value.length > 0}
                onPointerDown={handleInputPointerDown}
                onKeyDownCapture={handleInputKeyDownCapture}
                onPaste={isFilterNone ? preventInputEvent : undefined}
                onCompositionStart={
                  isFilterNone ? preventInputEvent : undefined
                }
              />
            </StyledTagsContainer>
            {value.length > 0 && !disabled && (
              <StyledClearButton
                aria-label="Clear all"
                slot={null}
                onPress={handleClearAll}
              >
                <Cancel size={theme.iconSizes.base} aria-hidden="true" />
              </StyledClearButton>
            )}
            <StyledOpenButton
              aria-label="Open"
              excludeFromTabOrder
              onPress={() => openDropdownRef.current?.()}
            >
              <KeyboardArrowDown
                size={theme.iconSizes.lg}
                aria-hidden="true"
              />
            </StyledOpenButton>
          </StyledTrigger>
          <StyledPopover
            ref={refs.setFloating}
            data-testid="stMultiSelectDropdown"
            placement="bottom left"
            isNonModal
            $isInSidebar={isInSidebar}
            offset={0}
            style={
              {
                ...floatingStyles,
                "--scrollbar-gutter-size": `${scrollbarGutterSize}px`,
              } as React.CSSProperties
            }
          >
            <Virtualizer
              layout={ListLayout}
              layoutOptions={virtualizerLayoutOptions}
            >
              <StyledListBox
                aria-label={element.label || "Multiselect options"}
                items={displayOptions}
                renderEmptyState={() => (
                  <StyledEmptyState>{noResultsMsg}</StyledEmptyState>
                )}
              >
                {renderOption}
              </StyledListBox>
            </Virtualizer>
          </StyledPopover>
        </ComboBox>
      </I18nProvider>
    </div>
  )
}

export default memo(Multiselect)
