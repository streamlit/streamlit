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
  FocusEvent,
  KeyboardEvent,
  PointerEvent,
  ReactElement,
  RefObject,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { FloatingPortal } from "@floating-ui/react"
import { useComboBox, useHover, useListBox, useOption } from "react-aria"
import { Item, useComboBoxState } from "react-stately"
import type { ComboBoxState, Node } from "react-stately"

import { BackendOperationContext } from "~lib/components/core/BackendOperationContext"
import IsSidebarContext from "~lib/components/core/IsSidebarContext"
import { FLOATING_OVERLAY_PORTAL_ID } from "~lib/components/core/Portal/constants"
import { useDebouncedCallback } from "~lib/hooks/useDebouncedCallback"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import {
  SHIFT_VIEWPORT_PADDING,
  useFloatingOverlay,
} from "~lib/hooks/useFloatingOverlay"
import { convertRemToPx } from "~lib/theme/utils"
import { isNullOrUndefined } from "~lib/util/utils"

import {
  StyledSuggestionsHighlight,
  StyledSuggestionsItem,
  StyledSuggestionsList,
  StyledSuggestionsPopover,
} from "./styled-components"
import {
  type AutocompleteInputProps,
  preventFocusLoss,
} from "./TextInputControl"

const AUTOCOMPLETE_DEBOUNCE_MS = 300

function suggestionOptionId(key: React.Key): string {
  return `stTextInputSuggestion-${String(key)}`
}

/** RAC must not re-filter; the server already returned the visible list. */
const PASS_THROUGH_FILTER = (
  _textValue: string,
  _inputValue: string
): boolean => true

interface SuggestionItem {
  id: string
  name: string
}

export interface TextInputWithAutocompleteProps {
  inputRef: RefObject<HTMLInputElement | null>
  overlayReferenceRef: RefObject<HTMLDivElement | null>
  onRegisterSetReference: (
    setter: ((node: HTMLDivElement | null) => void) | null
  ) => void
  sourceId: string
  uiValue: string | null
  focused: boolean
  disabled: boolean
  label: string
  isComposing: boolean
  onSelectSuggestion: (value: string) => void
  onInputProps: (props: AutocompleteInputProps) => void
  onBusyChange: (busy: boolean) => void
  onStatusChange: (message: string | null) => void
}

function SuggestionOption({
  item,
  state,
  armed,
  onSelect,
}: {
  item: Node<SuggestionItem>
  state: ComboBoxState<SuggestionItem>
  armed: boolean
  onSelect: (key: React.Key) => void
}): ReactElement {
  const ref = useRef<HTMLLIElement>(null)
  // Hover must not arm a row; Streamlit owns `armedKey` for Enter/Tab.
  const { optionProps, isFocused, isDisabled } = useOption(
    { key: item.key, shouldFocusOnHover: false },
    state,
    ref
  )
  const { hoverProps, isHovered } = useHover({ isDisabled })

  const pointerTypeRef = useRef<string>("mouse")

  const handleOptionPointerDown = (
    event: PointerEvent<HTMLLIElement>
  ): void => {
    pointerTypeRef.current = event.pointerType
    // Keep focus on the input for mouse. Skip preventDefault for touch/pen
    // so overflowY:auto lists can still be scrolled.
    if (event.pointerType === "mouse") {
      preventFocusLoss(event)
    }
  }

  const handleOptionPointerUp = (event: PointerEvent<HTMLLIElement>): void => {
    // Firefox suppresses click after mousedown preventDefault; pointerup
    // still fires. Touch/pen wait for click so a scroll gesture does not
    // commit.
    if (event.pointerType === "mouse" && event.button === 0 && !isDisabled) {
      onSelect(item.key)
    }
  }

  return (
    <StyledSuggestionsItem
      {...optionProps}
      {...hoverProps}
      id={suggestionOptionId(item.key)}
      ref={ref}
      data-focused={isFocused || armed || undefined}
      data-hovered={isHovered || undefined}
      data-disabled={isDisabled || undefined}
      onPointerDown={handleOptionPointerDown}
      onPointerUp={handleOptionPointerUp}
      onClick={event => {
        optionProps.onClick?.(event)
        if (pointerTypeRef.current === "mouse" || isDisabled) {
          return
        }
        onSelect(item.key)
      }}
    >
      <StyledSuggestionsHighlight data-item-hl="">
        {item.rendered}
      </StyledSuggestionsHighlight>
    </StyledSuggestionsItem>
  )
}

/**
 * ComboBox + request-lifecycle sibling for `st.text_input` callable
 * autocomplete. Hooks live here so they are not conditional in TextInput.
 * The real `<input>` stays in TextInputControl.
 */
export function TextInputWithAutocomplete({
  inputRef,
  overlayReferenceRef,
  onRegisterSetReference,
  sourceId,
  uiValue,
  focused,
  disabled,
  label,
  isComposing,
  onSelectSuggestion,
  onInputProps,
  onBusyChange,
  onStatusChange,
}: TextInputWithAutocompleteProps): ReactElement | null {
  const theme = useEmotionTheme()
  const isInSidebar = useContext(IsSidebarContext)
  const { backendOperationClient } = useContext(BackendOperationContext)

  const listBoxRef = useRef<HTMLUListElement | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const generationRef = useRef(0)
  const dismissedRef = useRef(false)
  const skipNextUiValueFetchRef = useRef(false)
  const focusedRef = useRef(focused)
  focusedRef.current = focused
  const uiValueRef = useRef(uiValue)
  uiValueRef.current = uiValue
  const sourceIdRef = useRef(sourceId)
  sourceIdRef.current = sourceId
  const selectingRef = useRef(false)
  const disabledRef = useRef(disabled)
  disabledRef.current = disabled

  const [suggestions, setSuggestions] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [armedKey, setArmedKey] = useState<React.Key | null>(null)

  const items = useMemo<SuggestionItem[]>(() => {
    const seen = new Set<string>()
    const next: SuggestionItem[] = []
    for (const suggestion of suggestions) {
      if (seen.has(suggestion)) {
        continue
      }
      seen.add(suggestion)
      next.push({ id: suggestion, name: suggestion })
    }
    return next
  }, [suggestions])

  const itemsRef = useRef(items)
  itemsRef.current = items
  const armedKeyRef = useRef<React.Key | null>(null)
  armedKeyRef.current = armedKey

  const armKey = useCallback((key: React.Key): void => {
    armedKeyRef.current = key
    setArmedKey(key)
  }, [])

  const clearArmedKey = useCallback((): void => {
    armedKeyRef.current = null
    setArmedKey(null)
  }, [])

  useEffect(() => {
    // A stale armed row would make Enter/Tab accept a suggestion from a
    // previous query after the user keeps typing.
    clearArmedKey()
  }, [clearArmedKey, suggestions, uiValue])

  const handleSelectionChange = useCallback(
    (key: React.Key | null): void => {
      if (isNullOrUndefined(key) || selectingRef.current) {
        return
      }
      selectingRef.current = true
      skipNextUiValueFetchRef.current = true
      dismissedRef.current = true
      generationRef.current += 1
      setBusy(false)
      onBusyChange(false)
      setSuggestions([])
      clearArmedKey()
      onStatusChange(null)
      onSelectSuggestion(String(key))
      queueMicrotask(() => {
        selectingRef.current = false
      })
    },
    [clearArmedKey, onBusyChange, onSelectSuggestion, onStatusChange]
  )

  const state = useComboBoxState<SuggestionItem>({
    inputValue: uiValue ?? "",
    onInputChange: undefined,
    selectedKey: null,
    onSelectionChange: handleSelectionChange,
    items,
    children: item => (
      <Item key={item.id} textValue={item.name}>
        {item.name}
      </Item>
    ),
    allowsCustomValue: true,
    allowsEmptyCollection: true,
    defaultFilter: PASS_THROUGH_FILTER,
    menuTrigger: "manual",
    shouldCloseOnBlur: false,
  })

  const { inputProps, listBoxProps } = useComboBox(
    {
      inputRef,
      listBoxRef,
      popoverRef,
      label,
      "aria-label": label,
      allowsCustomValue: true,
      menuTrigger: "manual",
    },
    state
  )

  const { listBoxProps: resolvedListBoxProps } = useListBox(
    {
      ...listBoxProps,
      shouldFocusOnHover: false,
      autoFocus: false,
      "aria-label": `${label} suggestions`,
    },
    state,
    listBoxRef
  )

  const overlayOptions = useMemo(() => {
    const base = {
      open: focused && !disabled,
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
  }, [theme.spacing.twoXS, isInSidebar, focused, disabled])

  const { refs, floatingStyles, update } = useFloatingOverlay(overlayOptions)

  // Register Floating UI on the input root via callback ref, then call
  // `update()` in layout so the first paint has the correct position.
  useLayoutEffect(() => {
    onRegisterSetReference(refs.setReference)
    refs.setReference(overlayReferenceRef.current)
    return () => {
      refs.setReference(null)
      onRegisterSetReference(null)
    }
  }, [onRegisterSetReference, overlayReferenceRef, refs])

  useLayoutEffect(() => {
    refs.setReference(overlayReferenceRef.current)
    update()
  }, [overlayReferenceRef, refs, update, items.length, state.isOpen, focused])

  const comboInputPropsRef = useRef(inputProps)
  comboInputPropsRef.current = inputProps
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    const input = inputRef.current
    if (!input) {
      return undefined
    }

    const onKeyDown = (e: globalThis.KeyboardEvent): void => {
      // IME candidate navigation and composition Enter must not drive the list.
      // keyCode 229 is the standard composing-key signal on Android.
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      if (e.isComposing || e.keyCode === 229) {
        return
      }

      const comboState = stateRef.current
      const itemKeys = itemsRef.current.map(item => item.id)
      const currentArmed = armedKeyRef.current
      const listOpen =
        comboState.isOpen &&
        itemKeys.length > 0 &&
        focusedRef.current &&
        !disabledRef.current

      if (listOpen && e.key === "Escape") {
        // Swallow Esc only while the list is open so a later Esc can dismiss
        // st.dialog. Clearing suggestions is what lets that second Esc pass.
        e.preventDefault()
        e.stopPropagation()
        dismissedRef.current = true
        clearArmedKey()
        comboState.close()
        setSuggestions([])
        onStatusChange(null)
        return
      }

      if (listOpen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        e.preventDefault()
        e.stopPropagation()
        dismissedRef.current = false
        const currentIndex = isNullOrUndefined(currentArmed)
          ? -1
          : itemKeys.indexOf(String(currentArmed))
        const lastIndex = itemKeys.length - 1
        let nextIndex: number
        if (e.key === "ArrowDown") {
          nextIndex = Math.min(currentIndex + 1, lastIndex)
        } else if (currentIndex < 0) {
          nextIndex = lastIndex
        } else {
          nextIndex = Math.max(currentIndex - 1, 0)
        }
        armKey(itemKeys[nextIndex])
        return
      }

      if (listOpen && !isNullOrUndefined(currentArmed) && e.key === "Enter") {
        e.preventDefault()
        e.stopPropagation()
        handleSelectionChange(currentArmed)
        return
      }

      if (listOpen && !isNullOrUndefined(currentArmed) && e.key === "Tab") {
        handleSelectionChange(currentArmed)
      }
    }

    input.addEventListener("keydown", onKeyDown, true)
    return () => {
      input.removeEventListener("keydown", onKeyDown, true)
    }
  }, [armKey, clearArmedKey, handleSelectionChange, inputRef, onStatusChange])

  const handleKeyDownCapture = useCallback(
    (e: KeyboardEvent<HTMLInputElement>): void => {
      if (
        e.key.toLowerCase() === "a" &&
        (e.ctrlKey || e.metaKey) &&
        !e.altKey &&
        !e.shiftKey
      ) {
        e.stopPropagation()
      }
    },
    []
  )

  const handleComboFocus = useCallback((e: FocusEvent<HTMLInputElement>) => {
    comboInputPropsRef.current.onFocus?.(e)
  }, [])

  const handleComboBlur = useCallback((e: FocusEvent<HTMLInputElement>) => {
    comboInputPropsRef.current.onBlur?.(e)
  }, [])

  const ariaExpanded = state.isOpen && items.length > 0
  const ariaControls = inputProps["aria-controls"]
  const inputRole = inputProps.role ?? "combobox"
  const ariaActiveDescendant = isNullOrUndefined(armedKey)
    ? undefined
    : suggestionOptionId(armedKey)

  useLayoutEffect(() => {
    onInputProps({
      role: inputRole,
      "aria-expanded": ariaExpanded,
      "aria-activedescendant": ariaActiveDescendant,
      "aria-controls": ariaControls,
      "aria-autocomplete": "list",
      "aria-busy": busy || undefined,
      onKeyDownCapture: handleKeyDownCapture,
      onFocus: handleComboFocus,
      onBlur: handleComboBlur,
    })
  }, [
    ariaActiveDescendant,
    ariaControls,
    ariaExpanded,
    busy,
    handleComboBlur,
    handleComboFocus,
    handleKeyDownCapture,
    inputRole,
    onInputProps,
  ])

  useEffect(() => {
    return () => {
      onInputProps({})
      onBusyChange(false)
      onStatusChange(null)
    }
  }, [onBusyChange, onInputProps, onStatusChange])

  const applyBusy = useCallback(
    (nextBusy: boolean): void => {
      setBusy(nextBusy)
      onBusyChange(nextBusy)
    },
    [onBusyChange]
  )

  const fetchSuggestions = useCallback((): void => {
    if (!backendOperationClient || disabled || !focusedRef.current) {
      return
    }
    const text = uiValueRef.current ?? ""
    const requestSourceId = sourceIdRef.current
    const generation = ++generationRef.current
    applyBusy(true)
    onStatusChange("Loading suggestions")

    void (async () => {
      try {
        const result = await backendOperationClient.requestAutocomplete({
          sourceId: requestSourceId,
          text,
        })
        if (generation !== generationRef.current) {
          return
        }
        applyBusy(false)
        if (
          result.sourceId !== requestSourceId ||
          result.text !== (uiValueRef.current ?? "") ||
          !focusedRef.current ||
          disabled
        ) {
          setSuggestions([])
          onStatusChange(null)
          return
        }
        const next = result.suggestions ?? []
        setSuggestions(next)
        onStatusChange(
          next.length === 0 ? "No suggestions" : `${next.length} suggestions`
        )
      } catch {
        if (generation !== generationRef.current) {
          return
        }
        applyBusy(false)
        setSuggestions([])
        onStatusChange("No suggestions")
      }
    })()
  }, [applyBusy, backendOperationClient, disabled, onStatusChange])

  const { debouncedCallback: scheduleFetch, cancel: cancelFetch } =
    useDebouncedCallback(fetchSuggestions, AUTOCOMPLETE_DEBOUNCE_MS)

  useEffect(() => {
    if (!focused || disabled || !backendOperationClient) {
      generationRef.current += 1
      cancelFetch()
      applyBusy(false)
      setSuggestions([])
      onStatusChange(null)
      if (stateRef.current.isOpen) {
        stateRef.current.close()
      }
      return
    }
    if (isComposing) {
      // Drop in-flight results so a lookup started before composition cannot
      // open the list mid-IME. Arrow/Enter during composition are ignored
      // separately in the capture key handler.
      generationRef.current += 1
      cancelFetch()
      applyBusy(false)
      setSuggestions([])
      onStatusChange(null)
      if (stateRef.current.isOpen) {
        stateRef.current.close()
      }
      return
    }
    if (skipNextUiValueFetchRef.current) {
      skipNextUiValueFetchRef.current = false
      return
    }
    dismissedRef.current = false
    scheduleFetch()
  }, [
    applyBusy,
    backendOperationClient,
    cancelFetch,
    disabled,
    focused,
    isComposing,
    onStatusChange,
    scheduleFetch,
    uiValue,
  ])

  useLayoutEffect(() => {
    if (items.length > 0 && focused && !disabled && !dismissedRef.current) {
      if (!stateRef.current.isOpen) {
        stateRef.current.open(null, "manual")
      }
      update()
      return
    }
    if (
      stateRef.current.isOpen &&
      (items.length === 0 || !focused || disabled)
    ) {
      stateRef.current.close()
    }
    if (items.length === 0 || !focused || disabled) {
      clearArmedKey()
    }
  }, [clearArmedKey, disabled, focused, items.length, update])

  const showList = items.length > 0
  if (!showList) {
    return null
  }

  return (
    <FloatingPortal id={FLOATING_OVERLAY_PORTAL_ID}>
      <StyledSuggestionsPopover
        ref={node => {
          popoverRef.current = node
          refs.setFloating(node)
        }}
        style={{
          ...floatingStyles,
          display: state.isOpen ? undefined : "none",
        }}
        hidden={!state.isOpen}
        $isInSidebar={isInSidebar}
        data-testid="stTextInputSuggestions"
        onMouseDown={preventFocusLoss}
      >
        <StyledSuggestionsList {...resolvedListBoxProps} ref={listBoxRef}>
          {[...state.collection].map(item => (
            <SuggestionOption
              key={item.key}
              item={item}
              state={state}
              armed={item.key === armedKey}
              onSelect={handleSelectionChange}
            />
          ))}
        </StyledSuggestionsList>
      </StyledSuggestionsPopover>
    </FloatingPortal>
  )
}
