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

import { Combobox } from "@ark-ui/react/combobox"
import {
  createListCollection,
  type ListCollection,
} from "@ark-ui/react/collection"
import { Portal } from "@ark-ui/react/portal"
import styled from "@emotion/styled"
import {
  FC,
  memo,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
} from "react"

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
import { getSelectFilterMode } from "~lib/util/fuzzyFilterSelectOptions"
import { LabelVisibilityOptions } from "~lib/util/utils"

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

  useLayoutEffect(() => {
    setValue(propValue ?? null)
    valueBeforeRemovalRef.current = null
  }, [propValue])

  const handleBlur = useCallback(() => {
    if (valueBeforeRemovalRef.current !== null) {
      setValue(valueBeforeRemovalRef.current)
    }
    valueBeforeRemovalRef.current = null
  }, [])

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

  const normalizedFilterMode = useMemo(
    () => getSelectFilterMode(filterMode),
    [filterMode]
  )

  const shouldSelectAllOnFocus = useMemo(
    () =>
      !inputReadOnly &&
      normalizedFilterMode !==
        streamlit.SelectWidgetFilterMode.FILTER_MODE_NONE,
    [inputReadOnly, normalizedFilterMode]
  )

  const handleInputFocus = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      if (shouldSelectAllOnFocus) {
        e.currentTarget.select()
      }
    },
    [shouldSelectAllOnFocus]
  )

  const filterOptions = useMemo(
    () => createFilterOptions(),
    [createFilterOptions]
  )

  const selectedOption = useMemo(() => {
    if (value == null) {
      return null
    }
    return selectOptions.find(o => o.value === value) ?? null
  }, [selectOptions, value])

  const filteredOptions = useMemo(
    () => filterOptions(selectOptions, inputQuery) as typeof selectOptions,
    [filterOptions, selectOptions, inputQuery]
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
      value != null &&
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
    if (value == null) {
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
    [onChange, value]
  )

  const onInputValueChange = useCallback(
    (d: { inputValue: string; reason?: string }) => {
      setInputQuery(d.inputValue)
      if (d.reason === "item-select" || d.reason === "clear-trigger") {
        return
      }
      if (value != null && d.inputValue === "") {
        valueBeforeRemovalRef.current = value
        setValue(null)
      }
    },
    [value]
  )

  const onOpenChange = useCallback(
    (d: { open: boolean }) => {
      if (!d.open) {
        handleBlur()
      }
    },
    [handleBlur]
  )

  const onInputKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (
        !acceptNewOptions &&
        value != null &&
        (e.key === "Backspace" || e.key === "Delete")
      ) {
        valueBeforeRemovalRef.current = value
        setValue(null)
        e.preventDefault()
        return
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
    [acceptNewOptions, onChange, selectOptions, value]
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
        onValueChange={onValueChange}
        onInputValueChange={onInputValueChange}
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
            <Combobox.Input
              data-testid="stSelectboxInput"
              readOnly={inputReadOnly === "readonly"}
              css={cssInput(theme, selectDisabled)}
              onFocus={handleInputFocus}
              onKeyDown={onInputKeyDown}
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
            <StyledContent data-testid="stSelectboxContent">
              <Combobox.List css={cssList(theme)}>
                {collection.items.map(item => (
                  <Combobox.Item
                    key={item.id}
                    item={item}
                    css={cssItem(theme)}
                    data-testid={`stSelectboxOption-${item.optionValue}`}
                  >
                    <Combobox.ItemText>
                      {item.isCreatable
                        ? `Add: ${item.optionValue}`
                        : item.label}
                    </Combobox.ItemText>
                    <Combobox.ItemIndicator css={cssItemIndicator(theme)}>
                      ✓
                    </Combobox.ItemIndicator>
                  </Combobox.Item>
                ))}
              </Combobox.List>
              <Combobox.Empty css={cssEmpty(theme)}>No results</Combobox.Empty>
            </StyledContent>
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

function cssItem(theme: ReturnType<typeof useEmotionTheme>) {
  return {
    cursor: "pointer",
    paddingLeft: theme.spacing.sm,
    paddingRight: theme.spacing.sm,
    paddingTop: theme.spacing.twoXS,
    paddingBottom: theme.spacing.twoXS,
    minHeight: theme.sizes.dropdownItemHeight,
    "&[data-highlighted]": {
      backgroundColor: theme.colors.secondaryBg,
    },
  }
}

function cssItemIndicator(theme: ReturnType<typeof useEmotionTheme>) {
  return {
    marginLeft: theme.spacing.sm,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.primary,
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
