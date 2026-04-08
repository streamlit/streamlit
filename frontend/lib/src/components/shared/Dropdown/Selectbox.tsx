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

import { KeyboardArrowDown } from "@emotion-icons/material-outlined"
import styled from "@emotion/styled"
import {
  FC,
  KeyboardEvent,
  memo,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  Button,
  ComboBox,
  Group,
  Input,
  ListBox,
  ListBoxItem,
  Popover,
  I18nProvider,
} from "react-aria-components"
import type { Key } from "@react-types/shared"

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

const StyledInput = styled(Input)(({ theme }) => ({
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
    color: theme.colors.fadedText60,
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
  maxHeight: `min(${theme.sizes.maxDropdownHeight}, 70vh)`,
  overflow: "hidden",
  boxShadow: "none",
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
}))

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

  const [value, setValue] = useState<string | null>(propValue)
  const valueBeforeRemovalRef = useRef<string | null>(null)
  const clearIntentRef = useRef(false)

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

  const filterOptions = useMemo(
    () => createFilterOptions(),
    [createFilterOptions]
  )

  const selectValueSet = useMemo(
    () => new Set(selectOptions.map(o => o.value)),
    [selectOptions]
  )

  const [inputValue, setInputValue] = useState(() =>
    propValue != null ? propValue : ""
  )

  const selectedKey: Key | null = useMemo(() => {
    if (value == null) {
      return null
    }
    const found = selectOptions.find(o => o.value === value)
    return found?.id ?? null
  }, [value, selectOptions])

  // While the input still matches the committed selection only, do not narrow
  // the list to that substring (matches BaseWeb: open shows all options).
  const filterPatternForList =
    value != null && inputValue === value ? "" : inputValue

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

  const syncInputFromValue = useCallback((v: string | null) => {
    if (v != null) {
      setInputValue(v)
    } else {
      setInputValue("")
    }
  }, [])

  useExecuteWhenChanged(() => {
    syncInputFromValue(propValue)
  }, [propValue, syncInputFromValue])

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
          setInputValue("")
          commitIfChanged(null)
          valueBeforeRemovalRef.current = null
        } else {
          const prev = value
          valueBeforeRemovalRef.current = prev
          setValue(null)
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
    [commitIfChanged, displayItems, value]
  )

  const handleInputChange = useCallback(
    (v: string) => {
      if (inputReadOnly) {
        return
      }
      setInputValue(v)
      if (selectedKey != null && v === "") {
        const prev = value
        valueBeforeRemovalRef.current = prev
        handleComboChange(null)
      }
    },
    [handleComboChange, inputReadOnly, selectedKey, value]
  )

  const handleBlur = useCallback(() => {
    if (valueBeforeRemovalRef.current !== null) {
      const restore = valueBeforeRemovalRef.current
      valueBeforeRemovalRef.current = null
      setValue(restore)
      syncInputFromValue(restore)
      return
    }
    // Discard draft query text when it does not match the committed value
    // (parent prop and internal value still agree).
    const committed = propValue ?? ""
    if (value === propValue && inputValue !== committed) {
      syncInputFromValue(propValue)
    }
  }, [inputValue, propValue, syncInputFromValue, value])

  const onClearPress = useCallback(() => {
    clearIntentRef.current = true
    setValue(null)
    setInputValue("")
    commitIfChanged(null)
    valueBeforeRemovalRef.current = null
  }, [commitIfChanged])

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

  const placeholderColor = selectDisabled
    ? theme.colors.fadedText40
    : theme.colors.fadedText60

  const showClear =
    (clearable || false) && value != null && !selectDisabled && !inputReadOnly

  return (
    <I18nProvider
      locale={typeof navigator !== "undefined" ? navigator.language : "en-US"}
    >
      <div className="stSelectbox" data-testid="stSelectbox">
        <WidgetLabel
          label={label}
          labelVisibility={labelVisibility}
          disabled={selectDisabled}
        >
          {help && <WidgetLabelHelpIcon content={help} label={label} />}
        </WidgetLabel>
        <ComboBox<ComboOption>
          allowsCustomValue={false}
          isDisabled={selectDisabled}
          aria-label={label || ""}
          menuTrigger="focus"
          items={displayItems}
          defaultFilter={() => true}
          allowsEmptyCollection
          value={selectedKey}
          onChange={handleComboChange}
          inputValue={inputValue}
          onInputChange={handleInputChange}
          placeholder={selectboxPlaceholder}
          onBlur={handleBlur}
          shouldFlip={!isInSidebar}
          offset={convertRemToPx(theme.spacing.twoXS)}
          style={{
            width: "100%",
            lineHeight: theme.lineHeights.inputWidget,
            fontWeight: theme.fontWeights.normal,
          }}
        >
          <StyledGroup>
            <StyledInput
              placeholder={selectboxPlaceholder}
              readOnly={inputReadOnly === "readonly"}
              onKeyDown={handleCreatableEnter}
              style={{
                color: theme.colors.bodyText,
              }}
              css={{
                "&::placeholder": {
                  color: placeholderColor,
                },
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
          <StyledPopover>
            <StyledListBox
              renderEmptyState={() => "No results"}
              data-testid="stSelectboxVirtualDropdown"
            >
              {item => (
                <StyledListBoxItem
                  id={item.id}
                  textValue={item.label}
                  data-creatable={item.isCreatable ? true : undefined}
                >
                  {item.label}
                </StyledListBoxItem>
              )}
            </StyledListBox>
          </StyledPopover>
        </ComboBox>
      </div>
    </I18nProvider>
  )
}

export default memo(Selectbox)
