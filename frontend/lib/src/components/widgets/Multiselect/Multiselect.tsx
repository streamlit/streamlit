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
import { WidgetLabel } from "~lib/components/widgets/BaseWidget/WidgetLabel"
import { WidgetLabelHelpIcon } from "~lib/components/widgets/BaseWidget/WidgetLabelHelpIcon"
import {
  useBasicWidgetState,
  ValueWithSource,
} from "~lib/hooks/useBasicWidgetState"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { useFloatingOverlay } from "~lib/hooks/useFloatingOverlay"
import {
  CREATABLE_ID,
  type MultiselectOption,
  SELECT_ALL_ID,
  SELECT_MATCHES_ID,
  useMultiselectFiltering,
} from "~lib/hooks/useMultiselectFiltering"
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
  widgetMgr.setStringArrayValue(
    element,
    valueWithSource.value,
    { fromUi: valueWithSource.fromUi },
    fragmentId
  )
}

/**
 * Null-render component mounted inside <ComboBox> to expose RAC's internal
 * open/close methods and focusedKey via refs. Same pattern as the Selectbox widget.
 */
const DropdownController = memo<{
  openRef: React.MutableRefObject<(() => void) | null>
  closeRef: React.MutableRefObject<(() => void) | null>
  focusedKeyRef: React.MutableRefObject<Key | null>
}>(({ openRef, closeRef, focusedKeyRef }) => {
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
  // Read synchronously — an effect would leave a stale-read window for keydown handlers
  focusedKeyRef.current = state?.selectionManager.focusedKey ?? null
  return null
})
DropdownController.displayName = "DropdownController"

const TagRemoveButton = memo<{
  value: string
  onRemove: (value: string) => void
}>(({ value, onRemove }) => (
  <StyledTagRemoveButton
    aria-label={`Remove ${value}`}
    tabIndex={-1}
    onClick={e => {
      e.stopPropagation()
      onRemove(value)
    }}
  >
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
  </StyledTagRemoveButton>
))
TagRemoveButton.displayName = "TagRemoveButton"

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
  const tagsContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollTopRef = useRef(0)

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

  const isOpenRef = useRef(false)
  const openDropdownRef = useRef<(() => void) | null>(null)
  const closeDropdownRef = useRef<(() => void) | null>(null)
  const focusedKeyRef = useRef<Key | null>(null)

  const { refs, floatingStyles } = useFloatingOverlay({
    open: true,
    placement: "bottom-start",
    offsetPx: convertRemToPx(theme.spacing.twoXS),
    flipOptions: isInSidebar ? false : undefined,
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
  const isClearable = element.default.length === 0

  // Max height: cut through 5th tag row
  const maxHeight = useMemo(() => {
    const rowHeight = `calc(${theme.sizes.elementHighlightHeight} + ${theme.sizes.tagMarginInsideBorder})`
    return `calc(4.5 * ${rowHeight} + ${theme.sizes.tagMarginInsideBorder} + 2 * ${theme.sizes.borderWidth})`
  }, [
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

  const noResultsMsg = useMemo(() => {
    if (element.maxSelections === 0) return "No results"
    if (value.length >= element.maxSelections) {
      const option = element.maxSelections !== 1 ? "options" : "option"
      return `You can only select up to ${element.maxSelections} ${option}. Remove an option first.`
    }
    return "No results"
  }, [element.maxSelections, value.length])

  // Preserve scroll position when tags are added/removed
  useLayoutEffect(() => {
    if (tagsContainerRef.current) {
      tagsContainerRef.current.scrollTop = scrollTopRef.current
    }
  }, [value])

  const handleTagsScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Safe: layout already computed during scroll event
    scrollTopRef.current = e.currentTarget.scrollTop
  }, [])

  const handleChange = useCallback(
    (keys: Key[]): void => {
      const selectedKeys = keys.map(String)

      // Check for bulk action keys
      const bulkActionKey = selectedKeys.find(
        k => k === SELECT_ALL_ID || k === SELECT_MATCHES_ID
      )

      if (bulkActionKey) {
        // Bulk select: add all currently displayed (non-special) options
        const optionsToAdd = displayOptions
          .filter(o => !o.isBulkAction && !o.isCreatable)
          .map(o => o.value)

        let newValue: string[]
        if (element.maxSelections > 0) {
          const remainingSlots = element.maxSelections - value.length
          newValue = [...value, ...optionsToAdd.slice(0, remainingSlots)]
        } else {
          newValue = [...value, ...optionsToAdd]
        }

        setValueWithSource({ value: newValue, fromUi: true })
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
        setValueWithSource({ value: newValue, fromUi: true })
        setInputValue("")
        return
      }

      // Normal toggle: compute the diff
      // selectedKeys from RAC contains the full new selection set (option IDs)
      // We need to map IDs back to values
      const newValues = selectedKeys
        .map(id => {
          const opt = displayOptions.find(o => o.id === id)
          return opt?.value
        })
        .filter(
          (v): v is string =>
            v !== undefined &&
            v !== SELECT_ALL_ID &&
            v !== SELECT_MATCHES_ID &&
            v !== CREATABLE_ID
        )

      // Merge with existing values that aren't in the current display
      // (already-selected items not shown in the filtered list)
      const displayedValues = new Set(displayOptions.map(o => o.value))
      const preservedValues = value.filter(v => !displayedValues.has(v))
      const finalValue = [...preservedValues, ...newValues]

      if (
        element.maxSelections > 0 &&
        finalValue.length > element.maxSelections
      ) {
        return
      }

      setValueWithSource({ value: finalValue, fromUi: true })
      setInputValue("")
    },
    [displayOptions, element.maxSelections, setValueWithSource, value]
  )

  const handleInputChange = useCallback((text: string): void => {
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

  const handleRemoveTag = useCallback(
    (tagValue: string): void => {
      const newValue = value.filter(v => v !== tagValue)
      setValueWithSource({ value: newValue, fromUi: true })
    },
    [setValueWithSource, value]
  )

  const handleClearAll = useCallback((): void => {
    setValueWithSource({ value: [], fromUi: true })
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
        if (!isOpenRef.current && isClearable && value.length > 0) {
          e.preventDefault()
          e.stopPropagation()
          setValueWithSource({ value: [], fromUi: true })
          return
        }
      }

      // Creatable Enter: commit typed text as a new option.
      // If the user arrowed to a real option (focusedKey is a regular item),
      // let RAC handle the selection via onChange instead.
      if (e.key === "Enter" && (element.acceptNewOptions ?? false)) {
        const currentInput = inputValueRef.current
        if (currentInput) {
          const focused = focusedKeyRef.current
          const isRealOptionFocused =
            notNullOrUndefined(focused) &&
            String(focused) !== CREATABLE_ID &&
            String(focused) !== SELECT_ALL_ID &&
            String(focused) !== SELECT_MATCHES_ID

          if (!isRealOptionFocused) {
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
              setValueWithSource({ value: newValue, fromUi: true })
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
        const newValue = value.slice(0, -1)
        setValueWithSource({ value: newValue, fromUi: true })
      }
    },
    [
      disabled,
      element.acceptNewOptions,
      element.maxSelections,
      element.options,
      isClearable,
      isFilterNone,
      setValueWithSource,
      value,
    ]
  )

  // Compute selectedKeys for the ListBox — map selected values to option IDs
  const selectedKeys = useMemo((): Set<Key> => {
    const keys = new Set<Key>()
    for (const v of value) {
      const idx = element.options.indexOf(v)
      if (idx !== -1) {
        keys.add(String(idx))
      }
    }
    return keys
  }, [value, element.options])

  const selectedKeysArray = useMemo(() => [...selectedKeys], [selectedKeys])

  // Only use readOnly for mobile small-list case. Never for isFilterNone —
  // readOnly breaks RAC keyboard navigation (Arrow/Enter). isFilterNone uses
  // inputMode="none" + character blocking in the capture handler instead.
  const inputReadOnly =
    !isFilterNone &&
    isMobile() &&
    element.options.length <= 10 &&
    !(element.acceptNewOptions ?? false)

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
            closeRef={closeDropdownRef}
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
            >
              {value.map(v => (
                <StyledTag key={v} $disabled={disabled} data-tag="">
                  <StyledTagText title={v}>{v}</StyledTagText>
                  {!disabled && (
                    <TagRemoveButton value={v} onRemove={handleRemoveTag} />
                  )}
                </StyledTag>
              ))}
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
            style={floatingStyles}
          >
            <Virtualizer
              layout={ListLayout}
              layoutOptions={virtualizerLayoutOptions}
            >
              <StyledListBox
                aria-label={element.label ?? "Multiselect options"}
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
