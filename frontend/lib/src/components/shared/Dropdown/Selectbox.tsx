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
  type KeyboardEvent,
  memo,
  type MutableRefObject,
  type ReactNode,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import {
  createListCollection,
  type ListCollection,
} from "@ark-ui/react/collection"
import { Combobox, useComboboxContext } from "@ark-ui/react/combobox"
import { Portal } from "@ark-ui/react/portal"
import styled from "@emotion/styled"

import { streamlit } from "@streamlit/protobuf"

import IsSidebarContext from "~lib/components/core/IsSidebarContext"
import {
  getBorderColor,
  getPopoverContainerStyle,
} from "~lib/components/shared/Base/styled-components"
import { WidgetLabel } from "~lib/components/widgets/BaseWidget/WidgetLabel"
import { WidgetLabelHelpIcon } from "~lib/components/widgets/BaseWidget/WidgetLabelHelpIcon"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { useSelectCommon } from "~lib/hooks/useSelectCommon"
import { convertRemToPx } from "~lib/theme/utils"
import {
  isNullOrUndefined,
  LabelVisibilityOptions,
  notNullOrUndefined,
} from "~lib/util/utils"

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

type SelectItem = {
  id: string
  label: string
  /** The Streamlit option string reported to the backend */
  optionValue: string
  isCreatable?: boolean
}

function itemToValue(item: SelectItem): string {
  return item.id
}

function itemToString(item: SelectItem): string {
  return item.isCreatable ? `Add: ${item.optionValue}` : item.label
}

/** Portal dropdown surface: test id only while open (avoids strict-mode collisions). */
function SelectboxDropdownContent({
  children,
}: {
  children: ReactNode
}): JSX.Element {
  const api = useComboboxContext()
  return (
    <StyledContent
      data-testid={api.open ? "stSelectboxVirtualDropdown" : undefined}
    >
      {children}
    </StyledContent>
  )
}

function SelectboxComboboxInput({
  theme,
  selectDisabled,
  inputReadOnly,
  handleInputFocus,
  clearable,
  comboboxOpenRef,
  propDerivedLabelRef,
  setInputQuery,
  userEditedInputThisFocusRef,
  onInputKeyDown,
}: {
  theme: ReturnType<typeof useEmotionTheme>
  selectDisabled: boolean
  inputReadOnly: "readonly" | null
  handleInputFocus: () => void
  clearable?: boolean
  comboboxOpenRef: MutableRefObject<boolean>
  propDerivedLabelRef: MutableRefObject<string>
  setInputQuery: (q: string) => void
  userEditedInputThisFocusRef: MutableRefObject<boolean>
  onInputKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void
}): JSX.Element {
  const api = useComboboxContext()
  const handleKeyDownCapture = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape" && !clearable && comboboxOpenRef.current) {
        e.preventDefault()
        e.stopPropagation()
        api.setOpen(false)
        setInputQuery(propDerivedLabelRef.current)
        userEditedInputThisFocusRef.current = false
        return
      }
      onInputKeyDown(e)
    },
    [
      api,
      clearable,
      comboboxOpenRef,
      onInputKeyDown,
      propDerivedLabelRef,
      setInputQuery,
      userEditedInputThisFocusRef,
    ]
  )
  return (
    <Combobox.Input
      data-testid="stSelectboxInput"
      readOnly={inputReadOnly === "readonly"}
      css={cssInput(theme, selectDisabled)}
      onFocus={handleInputFocus}
      onKeyDownCapture={handleKeyDownCapture}
    />
  )
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

  const [value, setValue] = useState<string | null>(propValue ?? null)
  const valueBeforeRemovalRef = useRef<string | null>(null)
  const clearIntentRef = useRef(false)
  const [inputQuery, setInputQuery] = useState("")
  const [isFocused, setIsFocused] = useState(false)
  const comboboxOpenRef = useRef(false)
  /** True after the user has changed the input this focus session (vs spurious empty from the combobox on focus). */
  const userEditedInputThisFocusRef = useRef(false)
  /** Next input-change "" right after close should show the committed label, not a blank field. */
  const suppressEmptyInputAfterCloseRef = useRef(false)

  useLayoutEffect(() => {
    setValue(propValue ?? null)
    valueBeforeRemovalRef.current = null
  }, [propValue])

  const opts = propOptions

  const {
    placeholder: selectboxPlaceholder,
    disabled: shouldDisable,
    selectOptions,
    inputReadOnly,
    createFilterOptions,
  } = useSelectCommon({
    options: opts,
    isMulti: false,
    acceptNewOptions,
    filterMode,
    placeholderInput: placeholder,
  })

  const selectDisabled = disabled || shouldDisable

  const propDerivedLabel = useMemo(() => {
    if (isNullOrUndefined(propValue) || propValue === undefined) {
      return ""
    }
    const opt = selectOptions.find(o => o.value === propValue)
    return opt?.label ?? propValue
  }, [propValue, selectOptions])

  const propDerivedLabelRef = useRef(propDerivedLabel)
  propDerivedLabelRef.current = propDerivedLabel

  useLayoutEffect(() => {
    setInputQuery(propDerivedLabel)
  }, [propDerivedLabel])

  const handleBlur = useCallback(() => {
    if (valueBeforeRemovalRef.current !== null) {
      const restored = valueBeforeRemovalRef.current
      setValue(restored)
      const opt = selectOptions.find(o => o.value === restored)
      setInputQuery(opt?.label ?? restored ?? "")
    } else if (!acceptNewOptions && notNullOrUndefined(value)) {
      // Ark may clear or desync the combobox input when the list closes (focus/Escape)
      // even though the committed value never changed (e2e: session_state sync, dismiss).
      const opt = selectOptions.find(o => o.value === value)
      setInputQuery(opt?.label ?? value)
    }
    valueBeforeRemovalRef.current = null
  }, [acceptNewOptions, selectOptions, value])

  const filterOptions = useMemo(
    () => createFilterOptions(),
    [createFilterOptions]
  )

  const selectedOption = useMemo(() => {
    if (isNullOrUndefined(value)) {
      return null
    }
    return selectOptions.find(o => o.value === value) ?? null
  }, [selectOptions, value])

  /**
   * Filter string passed to fuzzy/contains/prefix matching.
   * When Playwright (or the user) appends to the committed label without replacing it,
   * `inputQuery` can briefly be `propDerivedLabel + suffix` (e.g. …/iframe.pyexp) while
   * controlled reconciliation failed to slice — fuzzy match then finds nothing. Strip the
   * known label prefix in that case (same as the input-change handler's append branch).
   */
  const filterQuery = useMemo(() => {
    if (inputQuery === propDerivedLabel) {
      return ""
    }
    if (
      !acceptNewOptions &&
      propDerivedLabel !== "" &&
      inputQuery.startsWith(propDerivedLabel) &&
      inputQuery.length > propDerivedLabel.length
    ) {
      return inputQuery.slice(propDerivedLabel.length)
    }
    return inputQuery
  }, [acceptNewOptions, inputQuery, propDerivedLabel])

  const filteredOptions = useMemo(
    () => filterOptions(selectOptions, filterQuery) as typeof selectOptions,
    [filterOptions, selectOptions, filterQuery]
  )

  const showCreatable = useMemo(() => {
    if (!acceptNewOptions || !inputQuery.trim()) {
      return false
    }
    return !selectOptions.some(o => o.value === inputQuery)
  }, [acceptNewOptions, inputQuery, selectOptions])

  const collectionItems = useMemo((): SelectItem[] => {
    const base: SelectItem[] = filteredOptions.map(o => ({
      id: o.id,
      label: o.label,
      optionValue: o.value,
    }))

    if (showCreatable) {
      base.push({
        id: `__creatable__:${inputQuery}`,
        label: `Add: ${inputQuery}`,
        optionValue: inputQuery,
        isCreatable: true,
      })
    }

    if (
      inputQuery === "" &&
      notNullOrUndefined(value) &&
      !selectOptions.some(o => o.value === value) &&
      !base.some(i => i.optionValue === value)
    ) {
      base.unshift({
        id: `__custom__:${value}`,
        label: value,
        optionValue: value,
      })
    }

    return base
  }, [filteredOptions, inputQuery, selectOptions, showCreatable, value])

  const collection: ListCollection<SelectItem> = useMemo(
    () =>
      createListCollection<SelectItem>({
        items: collectionItems,
        itemToValue,
        itemToString,
      }),
    [collectionItems]
  )

  const comboboxValue = useMemo((): string[] => {
    if (isNullOrUndefined(value)) {
      return []
    }
    if (selectedOption) {
      return [selectedOption.id]
    }
    return [`__custom__:${value}`]
  }, [selectedOption, value])

  const onValueChange = useCallback(
    (details: { value: string[]; items: SelectItem[] }) => {
      const ids = details.value
      if (ids.length === 0) {
        if (clearIntentRef.current) {
          clearIntentRef.current = false
          setValue(null)
          onChange(null)
          valueBeforeRemovalRef.current = null
          return
        }
        // While the list is open, Zag can emit an empty selection during typing/filtering.
        // Keep the committed value so the controlled `value` prop stays in sync with Streamlit.
        if (comboboxOpenRef.current && !acceptNewOptions) {
          return
        }
        valueBeforeRemovalRef.current = value
        setValue(null)
        return
      }

      const item = details.items[0]
      if (!item) {
        return
      }

      setValue(item.optionValue)
      onChange(item.optionValue)
      valueBeforeRemovalRef.current = null
    },
    [acceptNewOptions, onChange, value]
  )

  const onInputValueChange = useCallback(
    (d: { inputValue: string; reason?: string }) => {
      if (d.reason === "item-select" || d.reason === "clear-trigger") {
        setInputQuery(d.inputValue)
        return
      }
      if (d.reason === "input-change") {
        if (
          d.inputValue === "" &&
          notNullOrUndefined(value) &&
          !userEditedInputThisFocusRef.current
        ) {
          // Zag can emit an empty input on focus before `onOpenChange` flips
          // `comboboxOpenRef`. Defer restore so we do not treat that as an open-list
          // empty filter (e2e: dismiss-by-click-away keeps "mxyz" edit path).
          if (!comboboxOpenRef.current) {
            queueMicrotask(() => {
              if (
                comboboxOpenRef.current ||
                userEditedInputThisFocusRef.current
              ) {
                return
              }
              setInputQuery(propDerivedLabelRef.current)
            })
            return
          }
          // List is already open: transient clear on open — show the committed label so
          // the user can edit from the full text (Backspace from "male", not from "").
          setInputQuery(propDerivedLabelRef.current)
          return
        }
        // BaseWeb keeps the filter string in an empty input while the selection label is
        // shown separately; we render the label in the input, so Playwright type() appends
        // to it. When the user starts typing a new option, treat that as a fresh filter.
        if (
          !acceptNewOptions &&
          propDerivedLabel !== "" &&
          d.inputValue.length > propDerivedLabel.length &&
          d.inputValue.startsWith(propDerivedLabel)
        ) {
          userEditedInputThisFocusRef.current = true
          if (
            valueBeforeRemovalRef.current === null &&
            notNullOrUndefined(value)
          ) {
            valueBeforeRemovalRef.current = value
          }
          setInputQuery(d.inputValue.slice(propDerivedLabel.length))
          return
        }
        if (d.inputValue !== propDerivedLabel) {
          userEditedInputThisFocusRef.current = true
          if (
            valueBeforeRemovalRef.current === null &&
            notNullOrUndefined(value)
          ) {
            valueBeforeRemovalRef.current = value
          }
        }
      }
      // After closing the list, Zag can emit input-change with "" while a value is still selected;
      // keep showing the committed option label (e2e: expect(selectbox).to_contain_text(option)).
      let nextInput = d.inputValue
      if (
        d.reason === "input-change" &&
        d.inputValue === "" &&
        suppressEmptyInputAfterCloseRef.current &&
        !acceptNewOptions &&
        notNullOrUndefined(value)
      ) {
        const opt = selectOptions.find(o => o.value === value)
        nextInput = opt?.label ?? value ?? ""
      }
      setInputQuery(nextInput)
    },
    [acceptNewOptions, propDerivedLabel, selectOptions, value]
  )

  const shouldOpenListOnInputChange = useCallback(
    (details: { inputValue: string; reason?: string }) => {
      // Zag defaults openOnChange to true: any INPUT.CHANGE opens the list. Spurious
      // controlled syncs to the committed label (focus/reconciliation) should not open,
      // or Escape first closes the list instead of clearing (BaseWeb escapeClearsValue).
      if (propDerivedLabel !== "" && details.inputValue === propDerivedLabel) {
        return false
      }
      return true
    },
    [propDerivedLabel]
  )

  const handleInputFocus = useCallback(() => {
    userEditedInputThisFocusRef.current = false
    // Keep the committed option label in the input on focus; Ark clears/reconciles
    // after focus — re-apply on the next frame so the controlled value wins (e2e parity
    // with BaseWeb).
    const label = propDerivedLabelRef.current
    setInputQuery(label)
    requestAnimationFrame(() => {
      if (!userEditedInputThisFocusRef.current) {
        setInputQuery(propDerivedLabelRef.current)
      }
    })
  }, [])

  const onOpenChange = useCallback(
    (d: { open: boolean }) => {
      comboboxOpenRef.current = d.open
      if (d.open) {
        // Re-apply the committed label when the list opens so Ark/Zag does not leave the
        // input blank before the first edit (BaseWeb keeps the selected label visible).
        if (!userEditedInputThisFocusRef.current) {
          setInputQuery(propDerivedLabelRef.current)
        }
      } else {
        suppressEmptyInputAfterCloseRef.current = true
        window.setTimeout(() => {
          suppressEmptyInputAfterCloseRef.current = false
        }, 0)
        handleBlur()
      }
    },
    [handleBlur]
  )

  const onInputKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      const domTrim = (e.currentTarget?.value ?? "").trim()
      const stateTrim = (inputQuery ?? "").trim()
      const inputText =
        domTrim.length >= stateTrim.length ? domTrim : stateTrim
      if (e.key === "Escape" && clearable) {
        // Let the combobox handle Escape while the dropdown is open (close only).
        if (comboboxOpenRef.current) {
          return
        }
        e.preventDefault()
        valueBeforeRemovalRef.current = null
        setValue(null)
        onChange(null)
        setInputQuery("")
        return
      }
      // Zag reverts on Enter when the text is "custom" vs the committed value and nothing
      // is highlighted. Commit when the input exactly matches an option (use inputQuery —
      // the controlled value can lag e.currentTarget in the keydown event).
      if (
        (e.key === "Enter" || e.key === "NumpadEnter") &&
        !acceptNewOptions
      ) {
        if (inputText !== "") {
          const exact = selectOptions.find(
            o => o.label === inputText || o.value === inputText
          )
          if (exact) {
            e.preventDefault()
            setValue(exact.value)
            onChange(exact.value)
            valueBeforeRemovalRef.current = null
            setInputQuery(exact.label ?? exact.value)
            return
          }
        }
      }
      if (
        e.key === "Enter" &&
        acceptNewOptions &&
        e.currentTarget.value.trim() !== "" &&
        !selectOptions.some(o => o.value === e.currentTarget.value)
      ) {
        const next = e.currentTarget.value
        e.preventDefault()
        setValue(next)
        onChange(next)
        valueBeforeRemovalRef.current = null
        return
      }
    },
    [acceptNewOptions, clearable, inputQuery, onChange, selectOptions, value]
  )

  const positioning = useMemo(
    () => ({
      placement: "bottom-start" as const,
      strategy: "fixed" as const,
      gutter: convertRemToPx(theme.spacing.twoXS),
      sameWidth: true,
      ...(isInSidebar
        ? { flip: true as const, fitViewport: true as const }
        : {}),
    }),
    [isInSidebar, theme.spacing.twoXS]
  )

  return (
    <StyledSelectboxRoot className="stSelectbox" data-testid="stSelectbox">
      <WidgetLabel
        label={label}
        labelVisibility={labelVisibility}
        disabled={selectDisabled}
      >
        {help && <WidgetLabelHelpIcon content={help} label={label} />}
      </WidgetLabel>
      <Combobox.Root
        collection={collection}
        openOnClick
        closeOnSelect
        allowCustomValue={acceptNewOptions}
        composite={false}
        disabled={selectDisabled}
        value={comboboxValue}
        inputValue={inputQuery}
        onValueChange={onValueChange}
        onInputValueChange={onInputValueChange}
        openOnChange={shouldOpenListOnInputChange}
        onOpenChange={onOpenChange}
        inputBehavior="none"
        selectionBehavior="replace"
        positioning={positioning}
        placeholder={selectboxPlaceholder}
        aria-label={label || ""}
      >
        <StyledControl
          data-testid="stSelectboxControl"
          onFocusCapture={() => setIsFocused(true)}
          onBlurCapture={() => setIsFocused(false)}
          $isFocused={isFocused}
        >
          <StyledValueRow>
            <SelectboxComboboxInput
              theme={theme}
              selectDisabled={selectDisabled}
              inputReadOnly={inputReadOnly}
              handleInputFocus={handleInputFocus}
              clearable={clearable}
              comboboxOpenRef={comboboxOpenRef}
              propDerivedLabelRef={propDerivedLabelRef}
              setInputQuery={setInputQuery}
              userEditedInputThisFocusRef={userEditedInputThisFocusRef}
              onInputKeyDown={onInputKeyDown}
            />
            {clearable && (
              <Combobox.ClearTrigger
                data-testid="stSelectboxClear"
                css={cssClearTrigger(theme)}
                onPointerDown={() => {
                  clearIntentRef.current = true
                }}
              />
            )}
            <Combobox.Trigger
              data-testid="stSelectboxTrigger"
              css={cssTrigger(theme, selectDisabled)}
            >
              <ChevronIcon aria-hidden />
            </Combobox.Trigger>
          </StyledValueRow>
        </StyledControl>
        <Portal>
          <Combobox.Positioner data-testid="stSelectboxPositioner">
            <SelectboxDropdownContent>
              <Combobox.List css={cssList(theme)}>
                {collection.items.map(item => (
                  <Combobox.Item
                    key={item.id}
                    asChild
                    item={item}
                    data-testid={`stSelectboxOption-${item.optionValue}`}
                  >
                    <StyledComboboxOption>
                      <Combobox.ItemText>
                        {item.isCreatable
                          ? `Add: ${item.optionValue}`
                          : item.label}
                      </Combobox.ItemText>
                    </StyledComboboxOption>
                  </Combobox.Item>
                ))}
              </Combobox.List>
              <Combobox.Empty css={cssEmpty(theme)}>No results</Combobox.Empty>
            </SelectboxDropdownContent>
          </Combobox.Positioner>
        </Portal>
      </Combobox.Root>
    </StyledSelectboxRoot>
  )
}

function cssInput(
  theme: ReturnType<typeof useEmotionTheme>,
  selectDisabled: boolean
) {
  return {
    lineHeight: theme.lineHeights.inputWidget,
    color: theme.colors.bodyText,
    caretColor: theme.colors.bodyText,
    flexGrow: 1,
    minWidth: theme.spacing.threeXS,
    border: "none",
    outline: "none",
    background: "transparent",
    paddingLeft: theme.spacing.sm,
    paddingRight: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    marginLeft: theme.sizes.tagMarginInsideBorder,
    "::placeholder": {
      color: selectDisabled
        ? theme.colors.fadedText40
        : theme.colors.fadedText60,
    },
  }
}

function cssClearTrigger(theme: ReturnType<typeof useEmotionTheme>) {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: theme.colors.grayTextColor,
    padding: theme.spacing.threeXS,
    height: theme.sizes.clearIconSize,
    width: theme.sizes.clearIconSize,
    border: "none",
    background: "transparent",
    cursor: "pointer",
    ":hover": {
      color: theme.colors.bodyText,
    },
  }
}

function cssTrigger(
  theme: ReturnType<typeof useEmotionTheme>,
  selectDisabled: boolean
) {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "none",
    background: "transparent",
    cursor: selectDisabled ? "not-allowed" : "pointer",
    paddingRight: theme.spacing.sm,
    color: theme.colors.bodyText,
  }
}

function cssList(theme: ReturnType<typeof useEmotionTheme>) {
  return {
    maxHeight: `min(${theme.sizes.maxDropdownHeight}, 70vh)`,
    overflowY: "auto",
    paddingTop: theme.spacing.none,
    paddingBottom: theme.spacing.none,
    paddingLeft: theme.spacing.none,
    paddingRight: theme.spacing.none,
  }
}

function cssEmpty(theme: ReturnType<typeof useEmotionTheme>) {
  return {
    padding: theme.spacing.sm,
    textAlign: "center",
    color: theme.colors.fadedText60,
  }
}

const StyledSelectboxRoot = styled.div({
  lineHeight: "inherit",
})

const StyledControl = styled(Combobox.Control, {
  shouldForwardProp: p => p !== "$isFocused",
})<{ $isFocused: boolean }>(({ theme, $isFocused }) => {
  const borderColor = getBorderColor(theme.colors, $isFocused)
  return {
    lineHeight: theme.lineHeights.inputWidget,
    fontWeight: theme.fontWeights.normal,
    height: theme.sizes.minElementHeight,
    borderLeftWidth: theme.sizes.borderWidth,
    borderRightWidth: theme.sizes.borderWidth,
    borderTopWidth: theme.sizes.borderWidth,
    borderBottomWidth: theme.sizes.borderWidth,
    borderStyle: "solid",
    borderTopColor: borderColor,
    borderRightColor: borderColor,
    borderBottomColor: borderColor,
    borderLeftColor: borderColor,
    borderRadius: theme.radii.default,
    backgroundColor:
      theme.colors.widgetBackgroundColor ?? theme.colors.bgColor,
  }
})

const StyledValueRow = styled.div({
  display: "flex",
  alignItems: "center",
  width: "100%",
  minWidth: 0,
  position: "relative",
})

const StyledComboboxOption = styled.li(({ theme }) => ({
  cursor: "pointer",
  paddingLeft: theme.spacing.sm,
  paddingRight: theme.spacing.sm,
  paddingTop: theme.spacing.twoXS,
  paddingBottom: theme.spacing.twoXS,
  minHeight: theme.sizes.dropdownItemHeight,
  "&[data-highlighted]": {
    backgroundColor: theme.colors.secondaryBg,
  },
}))

const StyledContent = styled(Combobox.Content)(({ theme }) => ({
  ...getPopoverContainerStyle(theme),
  maxHeight: `min(${theme.sizes.maxDropdownHeight}, 70vh)`,
  overflow: "auto",
  zIndex: theme.zIndices.popup,
}))

function ChevronIcon(props: { "aria-hidden"?: boolean }): JSX.Element {
  const theme = useEmotionTheme()
  return (
    <svg
      aria-hidden={props["aria-hidden"]}
      width={theme.iconSizes.xl}
      height={theme.iconSizes.xl}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M6 9L12 15L18 9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default memo(Selectbox)
