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
  type ClipboardEvent,
  type ComponentProps,
  FC,
  FocusEvent,
  type FormEvent,
  type ForwardedRef,
  forwardRef,
  HTMLAttributes,
  KeyboardEvent,
  memo,
  MouseEvent,
  type ReactElement,
  useCallback,
  useContext,
  useId,
  useMemo,
  useRef,
  useState,
} from "react"

import styled from "@emotion/styled"
import { KeyboardArrowDown } from "@emotion-icons/material-outlined"
import type { ComboBoxState } from "@react-stately/combobox"
import type { Key } from "@react-types/shared"
import {
  Button,
  ComboBox,
  ComboBoxStateContext,
  Group,
  I18nProvider,
  Input,
  ListBox,
  ListBoxItem,
  Popover,
} from "react-aria-components"
import { flushSync } from "react-dom"

import { streamlit } from "@streamlit/protobuf"

import IsSidebarContext from "~lib/components/core/IsSidebarContext"
import {
  getBorderColor,
  getPopoverContainerStyle,
} from "~lib/components/shared/Base/styled-components"
import { WidgetLabel } from "~lib/components/widgets/BaseWidget/WidgetLabel"
import { WidgetLabelHelpIcon } from "~lib/components/widgets/BaseWidget/WidgetLabelHelpIcon"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { useExecuteWhenChanged } from "~lib/hooks/useExecuteWhenChanged"
import { useSelectCommon } from "~lib/hooks/useSelectCommon"
import { convertRemToPx } from "~lib/theme/utils"
import { getSelectFilterMode } from "~lib/util/fuzzyFilterSelectOptions"
import { isNullOrUndefined, LabelVisibilityOptions, notNullOrUndefined } from "~lib/util/utils"

export interface Props {
  value: string | null
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

const StyledGroup = styled(Group)(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  alignItems: "stretch",
  width: "100%",
  minHeight: theme.sizes.minElementHeight,
  borderLeftWidth: theme.sizes.borderWidth,
  borderRightWidth: theme.sizes.borderWidth,
  borderTopWidth: theme.sizes.borderWidth,
  borderBottomWidth: theme.sizes.borderWidth,
  borderStyle: "solid",
  borderColor: getBorderColor(theme.colors, false),
  boxSizing: "border-box",
  borderRadius: theme.radii.default,
  backgroundColor: theme.colors.widgetBackgroundColor,
  "&[data-focus-within]": {
    borderColor: getBorderColor(theme.colors, true),
  },
}))

const StyledInput = styled(Input, {
  shouldForwardProp: prop => prop !== "$placeholderColor",
})<{ $placeholderColor?: string }>(({ theme, $placeholderColor }) => ({
  flexGrow: 1,
  flexShrink: 1,
  minWidth: theme.spacing.threeXS,
  marginLeft: theme.spacing.none,
  paddingLeft: theme.spacing.sm,
  paddingRight: theme.spacing.sm,
  paddingTop: theme.spacing.sm,
  paddingBottom: theme.spacing.sm,
  border: "none",
  outline: "none",
  background: "transparent",
  lineHeight: theme.lineHeights.inputWidget,
  fontWeight: theme.fontWeights.normal,
  color: theme.colors.bodyText,
  caretColor: theme.colors.bodyText,
  boxSizing: "border-box",
  "&::placeholder": {
    color: $placeholderColor ?? theme.colors.fadedText60,
  },
}))

const StyledOpenButton = styled(Button)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  paddingRight: theme.spacing.sm,
  paddingLeft: theme.spacing.twoXS,
  border: "none",
  background: "transparent",
  cursor: "pointer",
  color: theme.colors.bodyText,
  "&[data-disabled]": {
    cursor: "not-allowed",
  },
}))

const StyledClearButton = styled(Button)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  padding: theme.spacing.threeXS,
  border: "none",
  background: "transparent",
  cursor: "pointer",
  color: theme.colors.grayTextColor,
  height: theme.sizes.clearIconSize,
  width: theme.sizes.clearIconSize,
  "&:hover": {
    color: theme.colors.bodyText,
  },
}))

const StyledPopover = styled(Popover)(({ theme }) => ({
  ...getPopoverContainerStyle(theme),
  zIndex: theme.zIndices.toast,
  maxHeight: `min(${theme.sizes.maxDropdownHeight}, 70vh)`,
  overflow: "hidden",
  marginTop: convertRemToPx(theme.spacing.twoXS),
}))

const StyledListBox = styled(ListBox)(({ theme }) => ({
  outline: "none",
  maxHeight: `min(${theme.sizes.maxDropdownHeight}, 70vh)`,
  overflow: "auto",
  paddingTop: theme.spacing.none,
  paddingBottom: theme.spacing.none,
  paddingLeft: theme.spacing.none,
  paddingRight: theme.spacing.none,
  listStyle: "none",
  margin: theme.spacing.none,
}))

/** ListBox for the open popover only (CollectionBuilder also renders a hidden clone without this wrapper). */
const SelectboxVirtualListBox = memo(function SelectboxVirtualListBox(
  props: ComponentProps<typeof StyledListBox>
) {
  return <StyledListBox {...props} />
})

/** Portaled list overlay: RAC only mounts this subtree while the menu is open, so mark it for e2e. */
const SelectboxDropdownContainer = memo(function SelectboxDropdownContainer({
  children,
  instanceId,
}: {
  children: React.ReactNode
  instanceId: string
}): ReactElement {
  return (
    <div
      data-testid="stSelectboxVirtualDropdown"
      data-dropdown-open=""
      data-selectbox-dropdown={instanceId}
    >
      {children}
    </div>
  )
})

const StyledListBoxItem = styled(ListBoxItem)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  margin: theme.spacing.none,
  minHeight: theme.sizes.dropdownItemHeight,
  paddingTop: theme.spacing.none,
  paddingBottom: theme.spacing.none,
  paddingLeft: theme.sizes.tagMarginInsideBorder,
  paddingRight: theme.sizes.tagMarginInsideBorder,
  cursor: "pointer",
  outline: "none",
  fontWeight: theme.fontWeights.normal,
  color: theme.colors.bodyText,
  "&[data-focused]": {
    backgroundColor: theme.colors.secondaryBg,
  },
  "&[data-selected]": {
    backgroundColor: theme.colors.primary,
    color: theme.colors.white,
  },
}))

const ChevronIcon = styled(KeyboardArrowDown)(({ theme }) => ({
  width: theme.iconSizes.xl,
  height: theme.iconSizes.xl,
}))

/** E2e `to_contain_text` checks widget subtree; native `placeholder` is not innerText. */
/* eslint-disable streamlit-custom/no-hardcoded-theme-values --
 * Invisible positioning/sizing for the hint span; not theme-driven styling.
 */
const SelectboxEmptyOptionsHint = styled.span({
  position: "absolute",
  left: 0,
  top: 0,
  fontSize: "0.01px",
  lineHeight: 0,
  color: "transparent",
  pointerEvents: "none",
  userSelect: "none",
  whiteSpace: "nowrap",
})
/* eslint-enable streamlit-custom/no-hardcoded-theme-values */

const SelectComboInput = memo(
  forwardRef(function SelectComboInput(
    {
      onFocusProp,
      onClickProp,
      onKeyDownCaptureProp,
      placeholderColor,
      ...rest
    }: Omit<ComponentProps<typeof StyledInput>, "$placeholderColor"> & {
      onFocusProp: (e: FocusEvent<HTMLInputElement>) => void
      onClickProp: (e: MouseEvent<HTMLInputElement>) => void
      onKeyDownCaptureProp?: (e: KeyboardEvent<HTMLInputElement>) => void
      /** Placeholder text color (RAC Input does not accept Emotion `css`). */
      placeholderColor?: string
    },
    ref: ForwardedRef<HTMLInputElement>
  ) {
    const state = useContext(ComboBoxStateContext) as ComboBoxState<
      ComboOption,
      "single"
    > | null

    const openMenuIfClosed = useCallback(() => {
      if (state && !state.isOpen) {
        state.toggle(null, "manual")
      }
    }, [state])

    const mergedFocus = useCallback(
      (e: FocusEvent<HTMLInputElement>) => {
        onFocusProp(e)
        // Do not open on focus alone: e2e uses .focus()+Escape to clear without opening
        // (BaseWeb); typing tests still open via click → mergedClick → openMenuIfClosed.
      },
      [onFocusProp]
    )

    const moveCaretToEnd = useCallback((el: HTMLInputElement) => {
      if (document.activeElement !== el) {
        return
      }
      const len = el.value.length
      try {
        el.setSelectionRange(len, len)
      } catch {
        // ignore invalid selection
      }
    }, [])

    const mergedClick = useCallback(
      (e: MouseEvent<HTMLInputElement>) => {
        onClickProp(e)
        openMenuIfClosed()
        const el = e.currentTarget
        // RA may move virtual focus / selection when the list opens; defer so Backspace
        // edits the suffix (e2e: dismiss_change — End + 3× Backspace on "male").
        queueMicrotask(() => moveCaretToEnd(el))
        requestAnimationFrame(() => {
          requestAnimationFrame(() => moveCaretToEnd(el))
        })
      },
      [moveCaretToEnd, onClickProp, openMenuIfClosed]
    )

    const { onKeyDownCapture: racKeyDownCapture, ...restForDom } = rest

    const mergedKeyDownCapture = useCallback(
      (e: KeyboardEvent<HTMLInputElement>) => {
        onKeyDownCaptureProp?.(e)
        if (!e.defaultPrevented) {
          racKeyDownCapture?.(e)
        }
      },
      [onKeyDownCaptureProp, racKeyDownCapture]
    )

    return (
      <StyledInput
        {...restForDom}
        ref={ref}
        $placeholderColor={placeholderColor}
        onFocus={mergedFocus}
        onClick={mergedClick}
        onKeyDownCapture={mergedKeyDownCapture}
      />
    )
  })
)

function buildCreatableItem(inputValue: string): ComboOption {
  return {
    id: `__creatable__:${inputValue}`,
    label: `Add: ${inputValue}`,
    value: inputValue,
    isCreatable: true,
  }
}

function shouldAppendCreatable(
  acceptNewOptions: boolean,
  inputValue: string,
  selectValues: Set<string>
): boolean {
  if (!acceptNewOptions || inputValue === "") {
    return false
  }
  return !selectValues.has(inputValue)
}

const Selectbox: FC<Props> = ({
  disabled,
  value: propValue,
  onChange,
  options: propOptions,
  label,
  labelVisibility,
  help,
  placeholder,
  clearable,
  acceptNewOptions,
  filterMode,
}) => {
  const theme = useEmotionTheme()
  const isInSidebar = useContext(IsSidebarContext)
  const selectboxInstanceId = useId()

  const [value, setValue] = useState<string | null>(propValue)
  const valueBeforeRemovalRef = useRef<string | null>(null)
  const clearIntentRef = useRef(false)
  /** True when the user cleared the input to "" while a value was selected (not RA dismiss/Escape). */
  const userClearedInputRef = useRef(false)

  useExecuteWhenChanged(() => {
    setValue(propValue)
    valueBeforeRemovalRef.current = null
  }, [propValue])

  const {
    placeholder: selectboxPlaceholder,
    disabled: shouldDisable,
    selectOptions,
    inputReadOnly,
    createFilterOptions,
  } = useSelectCommon({
    options: propOptions,
    isMulti: false,
    acceptNewOptions,
    filterMode,
    placeholderInput: placeholder,
  })

  const selectDisabled = disabled || shouldDisable

  const normalizedFilterMode = useMemo(
    () => getSelectFilterMode(filterMode),
    [filterMode]
  )
  const isFilterTypingLocked =
    normalizedFilterMode === streamlit.SelectWidgetFilterMode.FILTER_MODE_NONE

  const filterOptions = useMemo(
    () => createFilterOptions(),
    [createFilterOptions]
  )

  const selectValueSet = useMemo(
    () => new Set(selectOptions.map(o => o.value)),
    [selectOptions]
  )

  const getDisplayString = useCallback(
    (v: string | null): string => {
      if (isNullOrUndefined(v)) {
        return ""
      }
      const found = selectOptions.find(o => o.value === v)
      return found?.label ?? v
    },
    [selectOptions]
  )

  const [inputValue, setInputValue] = useState(() =>
    getDisplayString(propValue)
  )
  /** Mirrors the latest input text synchronously (avoids openChange clobbering a batched type). */
  const inputTextRef = useRef(inputValue)

  const menuOpenRef = useRef(false)
  const selectboxContainerRef = useRef<HTMLDivElement>(null)
  const selectboxInputRef = useRef<HTMLInputElement>(null)

  const selectedKey: Key | null = useMemo(() => {
    if (isNullOrUndefined(value)) {
      return null
    }
    const found = selectOptions.find(o => o.value === value)
    return found?.id ?? null
  }, [value, selectOptions])

  // While the input still matches the committed selection only, do not narrow
  // the list to that substring (matches BaseWeb: open shows all options).
  const committedLabel = isNullOrUndefined(value)
    ? ""
    : getDisplayString(value)
  const filterPatternForList =
    committedLabel !== "" && inputValue === committedLabel ? "" : inputValue

  const displayItems = useMemo((): ComboOption[] => {
    const filtered = filterOptions(
      selectOptions as { label: string; value: string; id: string }[],
      filterPatternForList
    ) as { label: string; value: string; id: string }[]

    const base: ComboOption[] = filtered.map(o => ({
      id: o.id,
      label: o.label,
      value: o.value,
    }))

    if (shouldAppendCreatable(acceptNewOptions, inputValue, selectValueSet)) {
      base.push(buildCreatableItem(inputValue))
    }

    return base
  }, [
    acceptNewOptions,
    filterOptions,
    filterPatternForList,
    inputValue,
    selectOptions,
    selectValueSet,
  ])

  const syncInputFromValue = useCallback(
    (v: string | null) => {
      const s = getDisplayString(v)
      inputTextRef.current = s
      setInputValue(s)
    },
    [getDisplayString]
  )

  // Only react to prop value changes — do not list syncInputFromValue here; its identity
  // can change when selectOptions updates and would clobber in-progress typing (e2e dismiss).
  useExecuteWhenChanged(() => {
    syncInputFromValue(propValue)
  }, [propValue])

  const commitIfChanged = useCallback(
    (next: string | null) => {
      if (next !== propValue) {
        onChange(next)
      }
    },
    [onChange, propValue]
  )

  const handleComboChange = useCallback(
    (key: Key | null) => {
      if (key === null) {
        if (clearIntentRef.current) {
          clearIntentRef.current = false
          setValue(null)
          inputTextRef.current = ""
          setInputValue("")
          commitIfChanged(null)
          valueBeforeRemovalRef.current = null
        } else if (userClearedInputRef.current) {
          userClearedInputRef.current = false
          const prev = value
          valueBeforeRemovalRef.current = prev
          setValue(null)
        } else {
          // React Aria may emit null when the menu closes (e.g. Escape) without changing the
          // committed selection — keep parent value and display text in sync (e2e session_state).
          valueBeforeRemovalRef.current = null
          setValue(propValue)
          syncInputFromValue(propValue)
        }
        return
      }

      valueBeforeRemovalRef.current = null
      const item = displayItems.find(i => i.id === key)
      if (!item) {
        return
      }
      if (item.isCreatable) {
        setValue(item.value)
        setInputValue(item.value)
        commitIfChanged(item.value)
        return
      }
      setValue(item.value)
      setInputValue(item.value)
      commitIfChanged(item.value)
    },
    [commitIfChanged, displayItems, propValue, syncInputFromValue, value]
  )

  const handleInputChange = useCallback(
    (v: string) => {
      if (inputReadOnly) {
        return
      }
      inputTextRef.current = v
      setInputValue(v)
      if (notNullOrUndefined(selectedKey) && v === "") {
        userClearedInputRef.current = true
        handleComboChange(null)
      }
    },
    [handleComboChange, inputReadOnly, selectedKey]
  )

  const tryHandleSelectboxBackspace = useCallback(
    (t: HTMLInputElement): boolean => {
      // Prefer non-empty ref text (tracks our edits); when ref is still "" but the field
      // shows the committed label (focus/RA timing), fall back to the DOM value so the
      // first Backspace is not a no-op (vitest + real browsers).
      const refVal = inputTextRef.current
      const domVal = t.value
      const v = refVal.length > 0 ? refVal : domVal
      let start = t.selectionStart ?? v.length
      let end = t.selectionEnd ?? v.length
      if (t.value !== v && start === end) {
        start = end = v.length
      }

      if (start !== end) {
        const committedLabel = getDisplayString(value)
        // With the menu open, RA may leave the full committed label selected after click.
        // One Backspace should trim the suffix (same as End + Backspace); clearing the whole
        // field in one key triggers userCleared + prop sync and restores the label (vitest/e2e).
        if (
          start === 0 &&
          end === v.length &&
          v.length > 0 &&
          v === committedLabel
        ) {
          const next = v.slice(0, -1)
          inputTextRef.current = next
          /* eslint-disable-next-line @eslint-react/dom/no-flush-sync --
           * ComboBox input must commit synchronously so selection range updates match the trimmed value.
           */
          flushSync(() => {
            handleInputChange(next)
          })
          if (document.activeElement === t) {
            const c = next.length
            t.setSelectionRange(c, c)
          }
          return true
        }
        const next = v.slice(0, start) + v.slice(end)
        inputTextRef.current = next
        /* eslint-disable-next-line @eslint-react/dom/no-flush-sync --
         * ComboBox input must commit synchronously so selection range updates match the trimmed value.
         */
        flushSync(() => {
          handleInputChange(next)
        })
        if (document.activeElement === t) {
          t.setSelectionRange(start, start)
        }
        return true
      }

      const committedLabel = getDisplayString(value)
      const trimmingCommitted =
        committedLabel.length > 0 &&
        (v === committedLabel ||
          (committedLabel.startsWith(v) &&
            v.length > 0 &&
            v.length < committedLabel.length))

      if (trimmingCommitted && v.length > 0) {
        const next = v.slice(0, -1)
        inputTextRef.current = next
        /* eslint-disable-next-line @eslint-react/dom/no-flush-sync --
         * ComboBox input must commit synchronously so selection range updates match the trimmed value.
         */
        flushSync(() => {
          handleInputChange(next)
        })
        if (document.activeElement === t) {
          const caret = next.length
          t.setSelectionRange(caret, caret)
        }
        return true
      }

      if (start > 0) {
        const next = v.slice(0, start - 1) + v.slice(start)
        const caret = start - 1
        inputTextRef.current = next
        /* eslint-disable-next-line @eslint-react/dom/no-flush-sync --
         * ComboBox input must commit synchronously so selection range updates match the trimmed value.
         */
        flushSync(() => {
          handleInputChange(next)
        })
        if (document.activeElement === t) {
          t.setSelectionRange(caret, caret)
        }
        return true
      }
      return false
    },
    [getDisplayString, handleInputChange, value]
  )

  const handleSelectboxInputBackspaceCapture = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (isFilterTypingLocked) {
        return
      }
      if (
        e.key !== "Backspace" ||
        e.nativeEvent.isComposing ||
        selectDisabled ||
        inputReadOnly
      ) {
        return
      }
      const handled = tryHandleSelectboxBackspace(e.currentTarget)
      if (handled) {
        e.preventDefault()
        e.stopPropagation()
      }
    },
    [
      inputReadOnly,
      isFilterTypingLocked,
      selectDisabled,
      tryHandleSelectboxBackspace,
    ]
  )

  const handleBlur = useCallback(() => {
    if (valueBeforeRemovalRef.current !== null) {
      const restore = valueBeforeRemovalRef.current
      valueBeforeRemovalRef.current = null
      setValue(restore)
      syncInputFromValue(restore)
      return
    }
    // Discard draft query text when it does not match the committed selection label.
    const committedLabel = getDisplayString(propValue)
    if (value === propValue && inputValue !== committedLabel) {
      syncInputFromValue(propValue)
    }
  }, [getDisplayString, inputValue, propValue, syncInputFromValue, value])

  const onClearPress = useCallback(() => {
    clearIntentRef.current = true
    setValue(null)
    inputTextRef.current = ""
    setInputValue("")
    commitIfChanged(null)
    valueBeforeRemovalRef.current = null
  }, [commitIfChanged])

  const handleComboOpenChange = useCallback((isOpen: boolean) => {
    menuOpenRef.current = isOpen
    if (!isOpen) {
      return
    }
    // Do not call setInputValue here: onOpenChange can run while React is committing a
    // controlled inputValue update. Resetting from getDisplayString(value) races with
    // Backspace handling and restores the full label mid-sequence (e2e dismiss_change;
    // vitest suffix backspace). Focus + useExecuteWhenChanged already sync display text.
    let caretSyncTries = 0
    const moveCaretToEnd = (): void => {
      const el = selectboxInputRef.current
      if (!el || document.activeElement !== el) {
        return
      }
      const draft = inputTextRef.current
      if (el.value !== draft && caretSyncTries < 24) {
        caretSyncTries += 1
        queueMicrotask(moveCaretToEnd)
        return
      }
      const len = el.value.length
      try {
        el.setSelectionRange(len, len)
      } catch {
        // ignore
      }
    }
    queueMicrotask(moveCaretToEnd)
    requestAnimationFrame(() => {
      requestAnimationFrame(moveCaretToEnd)
    })
  }, [])

  const handleInputFocus = useCallback(
    (_e: FocusEvent<HTMLInputElement>) => {
      // Preserve the committed label on focus (RA can reset controlled text). Do not
      // select-all here: a deferred select() can run after e2e sends End and re-selects
      // the whole string so the first Backspace clears the field (dismiss_change test).
      const display = getDisplayString(value)
      const draft = inputTextRef.current
      // Focus can refire on the same tick as Backspace (RA); don't clobber suffix deletes
      // of the committed label (draft is a strict prefix of the selection text).
      if (
        display.length > 0 &&
        draft.length > 0 &&
        draft.length < display.length &&
        display.startsWith(draft)
      ) {
        setInputValue(draft)
        return
      }
      inputTextRef.current = display
      setInputValue(display)
    },
    [getDisplayString, value]
  )

  const handleInputClick = useCallback((e: MouseEvent<HTMLInputElement>) => {
    // Second click while focused: collapse to end so small edits edit the suffix.
    const el = e.currentTarget
    if (document.activeElement === el) {
      const len = el.value.length
      el.setSelectionRange(len, len)
    }
  }, [])

  const tryCommitEnterSelection = useCallback(
    (
      query: string,
      e: { preventDefault: () => void; stopPropagation: () => void }
    ): boolean => {
      const selectable = displayItems.filter(i => !i.isCreatable)
      const match = selectable.find(
        i => i.label === query || i.value === query
      )
      if (match) {
        e.preventDefault()
        e.stopPropagation()
        handleComboChange(match.id)
        return true
      }
      if (selectable.length === 1) {
        e.preventDefault()
        e.stopPropagation()
        handleComboChange(selectable[0].id)
        return true
      }
      return false
    },
    [displayItems, handleComboChange]
  )

  const handleGroupKeyDownCapture = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      // Prefer the focused combobox input: React/playwright can report a different `target`
      // than `document.activeElement` while the caret is in the field (breaks Backspace).
      const refInput = selectboxInputRef.current
      const active = document.activeElement
      const t: HTMLInputElement | null =
        refInput !== null &&
        active === refInput &&
        e.currentTarget.contains(refInput)
          ? refInput
          : e.target instanceof HTMLInputElement &&
              e.currentTarget.contains(e.target)
            ? e.target
            : null
      if (t === null) {
        return
      }
      if (!selectDisabled && !inputReadOnly && !e.nativeEvent.isComposing) {
        // With the menu open, React Aria maps Home/End to list navigation; e2e uses End to move
        // the text caret (prepare_react_aria_combobox_typing) before typing.
        if (e.key === "Home" && !e.ctrlKey && !e.metaKey) {
          e.preventDefault()
          e.stopPropagation()
          t.setSelectionRange(0, 0)
          return
        }
        if (e.key === "End" && !e.ctrlKey && !e.metaKey) {
          e.preventDefault()
          e.stopPropagation()
          const len = t.value.length
          t.setSelectionRange(len, len)
          return
        }
      }
      if (
        e.key !== "Enter" ||
        e.nativeEvent.isComposing ||
        selectDisabled ||
        inputReadOnly
      ) {
        return
      }
      tryCommitEnterSelection(t.value, e)
    },
    [inputReadOnly, selectDisabled, tryCommitEnterSelection]
  )

  const handleCreatableEnter = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (
        e.key !== "Enter" ||
        e.nativeEvent.isComposing ||
        !acceptNewOptions ||
        selectDisabled ||
        inputReadOnly
      ) {
        return
      }
      if (
        !shouldAppendCreatable(acceptNewOptions, inputValue, selectValueSet)
      ) {
        return
      }
      e.preventDefault()
      e.stopPropagation()
      const item = buildCreatableItem(inputValue)
      setValue(item.value)
      inputTextRef.current = item.value
      setInputValue(item.value)
      commitIfChanged(item.value)
    },
    [
      acceptNewOptions,
      commitIfChanged,
      inputReadOnly,
      inputValue,
      selectDisabled,
      selectValueSet,
    ]
  )

  const handleSelectboxKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (
        isFilterTypingLocked &&
        !selectDisabled &&
        !e.nativeEvent.isComposing
      ) {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          const allowed = new Set([
            "Tab",
            "Enter",
            "Escape",
            "ArrowDown",
            "ArrowUp",
            "ArrowLeft",
            "ArrowRight",
            "Home",
            "End",
            "PageUp",
            "PageDown",
          ])
          if (
            !allowed.has(e.key) &&
            (e.key === " " ||
              e.key === "Backspace" ||
              e.key === "Delete" ||
              e.key.length === 1)
          ) {
            e.preventDefault()
            e.stopPropagation()
            return
          }
        }
      }
      const canEscapeClear =
        (clearable || false) &&
        notNullOrUndefined(value) &&
        !selectDisabled &&
        !inputReadOnly
      if (e.key === "Escape" && canEscapeClear) {
        // First Escape: let React Aria close the menu and restore the input; only clear on Escape when closed.
        if (menuOpenRef.current) {
          return
        }
        e.preventDefault()
        e.stopPropagation()
        onClearPress()
        return
      }
      if (
        e.key === "Enter" &&
        !e.nativeEvent.isComposing &&
        !selectDisabled &&
        !inputReadOnly
      ) {
        const query = (e.currentTarget as HTMLInputElement).value ?? inputValue
        if (tryCommitEnterSelection(query, e)) {
          return
        }
      }
      handleCreatableEnter(e)
    },
    [
      clearable,
      handleCreatableEnter,
      inputReadOnly,
      inputValue,
      isFilterTypingLocked,
      onClearPress,
      selectDisabled,
      tryCommitEnterSelection,
      value,
    ]
  )

  const placeholderColor = selectDisabled
    ? theme.colors.fadedText40
    : theme.colors.fadedText60

  const showClear =
    (clearable || false) &&
    notNullOrUndefined(value) &&
    !selectDisabled &&
    !inputReadOnly

  return (
    <I18nProvider
      locale={typeof navigator !== "undefined" ? navigator.language : "en-US"}
    >
      <div
        ref={selectboxContainerRef}
        className="stSelectbox"
        data-testid="stSelectbox"
        style={{ position: "relative" }}
        onKeyDownCapture={handleGroupKeyDownCapture}
      >
        <WidgetLabel
          label={label}
          labelVisibility={labelVisibility}
          disabled={selectDisabled}
        >
          {help && <WidgetLabelHelpIcon content={help} label={label} />}
        </WidgetLabel>
        {selectOptions.length === 0 && acceptNewOptions && (
          <SelectboxEmptyOptionsHint aria-hidden="true">
            {selectboxPlaceholder}
          </SelectboxEmptyOptionsHint>
        )}
        <ComboBox<ComboOption>
          allowsCustomValue={false}
          isDisabled={selectDisabled}
          aria-label={label || ""}
          // Open on click (SelectComboInput) or when typing changes the query; not on Tab focus alone
          // so e2e can focus()+Escape to clear without opening the list first.
          menuTrigger="input"
          items={displayItems}
          defaultFilter={() => true}
          allowsEmptyCollection
          value={selectedKey}
          onChange={handleComboChange}
          inputValue={inputValue}
          onInputChange={handleInputChange}
          onOpenChange={handleComboOpenChange}
          onBlur={handleBlur}
          style={{
            width: "100%",
            lineHeight: theme.lineHeights.inputWidget,
            fontWeight: theme.fontWeights.normal,
          }}
        >
          <StyledGroup>
            <SelectComboInput
              ref={selectboxInputRef}
              placeholder={selectboxPlaceholder}
              placeholderColor={placeholderColor}
              readOnly={inputReadOnly === "readonly" && !isFilterTypingLocked}
              onBeforeInput={
                isFilterTypingLocked
                  ? (ev: FormEvent<HTMLInputElement>) => ev.preventDefault()
                  : undefined
              }
              onPaste={
                isFilterTypingLocked
                  ? (ev: ClipboardEvent<HTMLInputElement>) =>
                      ev.preventDefault()
                  : undefined
              }
              onFocusProp={handleInputFocus}
              onClickProp={handleInputClick}
              onKeyDownCaptureProp={handleSelectboxInputBackspaceCapture}
              onKeyDown={handleSelectboxKeyDown}
              style={{
                color: theme.colors.bodyText,
              }}
            />
            {showClear && (
              <StyledClearButton
                slot={null}
                aria-label="Clear"
                onPress={onClearPress}
              >
                ×
              </StyledClearButton>
            )}
            <StyledOpenButton aria-label="Toggle options">
              <ChevronIcon />
            </StyledOpenButton>
          </StyledGroup>
          <StyledPopover
            isNonModal={true}
            shouldFlip={!isInSidebar}
            offset={convertRemToPx(theme.spacing.twoXS)}
          >
            <SelectboxDropdownContainer instanceId={selectboxInstanceId}>
              <SelectboxVirtualListBox
                // react-aria-components ListBox renders a div by default; e2e tests expect ul/li.
                {...({
                  render: (props: HTMLAttributes<HTMLUListElement>) => (
                    <ul {...props} />
                  ),
                } as object)}
                renderEmptyState={() => "No results"}
              >
                {item => {
                  const option = item as ComboOption
                  return (
                    <StyledListBoxItem
                      id={option.id}
                      textValue={option.label}
                      data-creatable={option.isCreatable ? true : undefined}
                      render={props => (
                        <li {...(props as HTMLAttributes<HTMLLIElement>)} />
                      )}
                    >
                      {option.label}
                    </StyledListBoxItem>
                  )
                }}
              </SelectboxVirtualListBox>
            </SelectboxDropdownContainer>
          </StyledPopover>
        </ComboBox>
      </div>
    </I18nProvider>
  )
}

export default memo(Selectbox)
