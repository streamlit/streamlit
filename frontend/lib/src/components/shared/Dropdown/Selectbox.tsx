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

/**
 * Selectbox uses Base UI **Combobox** (`@base-ui-components/react/combobox`), not
 * `Select`, because we need search/filter, creatable values, and virtualized
 * options. Base UI `Select` is listbox-based and does not cover this behavior;
 * Combobox is the supported primitive for this pattern.
 */

import styled from "@emotion/styled"
import { Combobox } from "@base-ui-components/react/combobox"
import {
  FC,
  memo,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react"

import { streamlit } from "@streamlit/protobuf"

import IsSidebarContext from "~lib/components/core/IsSidebarContext"
import {
  getBorderColor,
  getPopoverContainerStyle,
} from "~lib/components/shared/Base/styled-components"
import VirtualDropdown, {
  type SelectboxVirtualRow,
} from "~lib/components/shared/Dropdown/VirtualDropdown"
import { StyledHighlightWrapper } from "~lib/components/shared/Highlight/styled-components"
import OverflowTooltip from "~lib/components/shared/Tooltip/OverflowTooltip"
import { Placement } from "~lib/components/shared/Tooltip/Tooltip"
import { WidgetLabel } from "~lib/components/widgets/BaseWidget/WidgetLabel"
import { WidgetLabelHelpIcon } from "~lib/components/widgets/BaseWidget/WidgetLabelHelpIcon"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { useExecuteWhenChanged } from "~lib/hooks/useExecuteWhenChanged"
import { useSelectCommon } from "~lib/hooks/useSelectCommon"
import { convertRemToPx } from "~lib/theme/utils"
import { LabelVisibilityOptions } from "~lib/util/utils"

import { ThemedStyledDropdownListItem } from "./styled-components"

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

const ControlContainer = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "stretch",
  flexDirection: "row",
  width: "100%",
  minHeight: theme.sizes.minElementHeight,
  boxSizing: "border-box",
  borderLeftWidth: theme.sizes.borderWidth,
  borderRightWidth: theme.sizes.borderWidth,
  borderTopWidth: theme.sizes.borderWidth,
  borderBottomWidth: theme.sizes.borderWidth,
  borderStyle: "solid",
  borderRadius: theme.radii.default,
  backgroundColor: theme.colors.secondaryBg,
}))

const IconsContainer = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  flexShrink: 0,
  paddingRight: theme.spacing.sm,
}))

const ValueContainer = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  flexGrow: 1,
  minWidth: 0,
  paddingLeft: theme.spacing.sm,
  paddingRight: theme.spacing.sm,
  paddingBottom: theme.spacing.sm,
  paddingTop: theme.spacing.sm,
  marginLeft: theme.sizes.tagMarginInsideBorder,
  position: "relative",
}))

const InputWrap = styled.div(({ theme }) => ({
  position: "relative",
  flexGrow: 1,
  minWidth: theme.spacing.threeXS,
  display: "flex",
  alignItems: "center",
}))

/** Mirrors the selected value as real text for tests (input value is not matched by getByText). */
const SelectionMirror = styled.span({
  position: "absolute",
  left: 0,
  top: "50%",
  transform: "translateY(-50%)",
  pointerEvents: "none",
  color: "transparent",
  zIndex: 0,
  maxWidth: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
})

const PlaceholderSpan = styled.span(({ theme }) => ({
  position: "absolute",
  left: 0,
  top: "50%",
  transform: "translateY(-50%)",
  pointerEvents: "none",
  color: theme.colors.fadedText60,
  maxWidth: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
}))

const StyledComboboxInput = styled(Combobox.Input, {
  shouldForwardProp: prop => prop !== "$disabled",
})<{ $disabled: boolean }>(({ theme, $disabled }) => ({
  flexGrow: 1,
  minWidth: 0,
  width: "100%",
  margin: 0,
  padding: 0,
  border: "none",
  outline: "none",
  background: "transparent",
  lineHeight: theme.lineHeights.inputWidget,
  fontWeight: theme.fontWeights.normal,
  color: theme.colors.bodyText,
  caretColor: theme.colors.bodyText,
  position: "relative",
  zIndex: 1,
  ...($disabled && {
    color: theme.colors.fadedText40,
    cursor: "not-allowed",
  }),
}))

const ChevronIcon = styled.svg(({ theme }) => ({
  width: theme.iconSizes.xl,
  height: theme.iconSizes.xl,
  flexShrink: 0,
}))

const ClearButton = styled(Combobox.Clear)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: theme.spacing.threeXS,
  height: theme.sizes.clearIconSize,
  width: theme.sizes.clearIconSize,
  border: "none",
  background: "transparent",
  cursor: "pointer",
  color: theme.colors.grayTextColor,
  "&:hover": {
    color: theme.colors.bodyText,
  },
}))

const PopupPanel = styled(Combobox.Popup)(({ theme }) => ({
  ...getPopoverContainerStyle(theme),
  maxHeight: `min(${theme.sizes.maxDropdownHeight}, 70vh)`,
  overflow: "hidden",
  zIndex: theme.zIndices.popup,
  // Base UI mount transitions can leave opacity at 0 long enough that Playwright treats
  // the virtualized list as not visible (screenshots/clicks); keep the panel opaque.
  opacity: 1,
  transition: "none",
  "&[data-starting-style]": { opacity: 1 },
  "&[data-ending-style]": { opacity: 1 },
}))

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
  const [inputValue, setInputValue] = useState(() => propValue ?? "")
  const [open, setOpen] = useState(false)
  /** Mirrors `open` for value-change handlers (Base UI can fire in the same tick as transitions). */
  const openRef = useRef(false)
  useLayoutEffect(() => {
    openRef.current = open
  }, [open])
  const valueBeforeRemovalRef = useRef<string | null>(null)
  /** True until the first `onInputValueChange` after open is applied (Base UI may emit a spurious ""). */
  const skipRemovalSyncRef = useRef(false)
  /** True while creatable was opened via trigger-press with an intentional empty query. */
  const creatableEmptyQueryRef = useRef(false)
  /** True until the next microtask after open; Base UI may emit several synchronous "" events to clear. */
  const openInputSyncBatchRef = useRef(false)
  /** Count of label restores from "" during the open sync batch (bounded). */
  const openSyncEmptyRestoresRef = useRef(0)

  useExecuteWhenChanged(() => {
    setValue(propValue)
    valueBeforeRemovalRef.current = null
    setInputValue(propValue ?? "")
  }, [propValue])

  const handleValueChange = useCallback(
    (next: string | null): void => {
      valueBeforeRemovalRef.current = null
      setValue(next)
      onChange(next)
      setInputValue(next ?? "")
    },
    [onChange]
  )

  /**
   * Base UI clears `selectedValue` to null with reason `input-clear` whenever the text field
   * becomes empty (including while filtering). Streamlit must keep the committed value until
   * blur/selection/clear-button — otherwise partial edits like "male" → "mxyz" break.
   */
  const handleComboboxValueChange = useCallback(
    (next: string | null, eventDetails?: { reason?: string }): void => {
      if (
        next === null &&
        eventDetails?.reason === "input-clear" &&
        openRef.current
      ) {
        return
      }
      handleValueChange(next)
    },
    [handleValueChange]
  )

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

  const filterOptions = useMemo(
    () => createFilterOptions(),
    [createFilterOptions]
  )

  const displayRows: SelectboxVirtualRow[] = useMemo(() => {
    const filtered = filterOptions(
      selectOptions,
      inputValue
    ) as typeof selectOptions
    const rows: SelectboxVirtualRow[] = filtered.map(o => ({
      id: o.id,
      value: o.value,
      label: o.label,
    }))
    const canCreate =
      acceptNewOptions &&
      inputValue.length > 0 &&
      !selectOptions.some(o => o.value === inputValue)
    if (canCreate) {
      // Prepend so react-window mounts the creatable row in the first viewport
      // (appending can leave it unmounted when many matches exist).
      rows.unshift({
        id: `__creatable__:${inputValue}`,
        value: inputValue,
        label: `Add: ${inputValue}`,
        isCreatable: true,
      })
    }
    return rows
  }, [acceptNewOptions, filterOptions, inputValue, selectOptions])

  const comboboxItems = useMemo(() => {
    const base = selectOptions.map(o => o.value)
    const out = new Set(base)
    if (acceptNewOptions && value != null && value !== "" && !out.has(value)) {
      out.add(value)
    }
    if (acceptNewOptions && inputValue.length > 0 && !out.has(inputValue)) {
      out.add(inputValue)
    }
    return [...out]
  }, [acceptNewOptions, inputValue, selectOptions, value])

  const filteredItemValues = useMemo(
    () => displayRows.map(r => r.value),
    [displayRows]
  )

  const showPlaceholder =
    !open && (value == null || value === "") && inputValue === ""

  const placeholderColor = selectDisabled
    ? theme.colors.fadedText40
    : theme.colors.fadedText60

  const handleOpenChange = useCallback(
    (nextOpen: boolean, eventDetails?: { reason?: string }) => {
      setOpen(nextOpen)
      if (nextOpen) {
        skipRemovalSyncRef.current = true
        openInputSyncBatchRef.current = true
        openSyncEmptyRestoresRef.current = 0
        queueMicrotask(() => {
          openInputSyncBatchRef.current = false
        })
        if (acceptNewOptions && eventDetails?.reason === "trigger-press") {
          creatableEmptyQueryRef.current = true
          setInputValue("")
        } else {
          creatableEmptyQueryRef.current = false
          const label =
            value == null || value === ""
              ? ""
              : (selectOptions.find(o => o.value === value)?.label ??
                String(value))
          setInputValue(label)
        }
      } else {
        let nextVal = value
        if (valueBeforeRemovalRef.current !== null) {
          nextVal = valueBeforeRemovalRef.current
          setValue(valueBeforeRemovalRef.current)
          valueBeforeRemovalRef.current = null
        }
        const closeLabel =
          nextVal == null || nextVal === ""
            ? ""
            : (selectOptions.find(o => o.value === nextVal)?.label ??
              String(nextVal))
        setInputValue(closeLabel)
        creatableEmptyQueryRef.current = false
        openInputSyncBatchRef.current = false
      }
    },
    [acceptNewOptions, selectOptions, value]
  )

  const handleInputValueChange = useCallback(
    (next: string) => {
      if (skipRemovalSyncRef.current) {
        skipRemovalSyncRef.current = false
        if (
          next === "" &&
          value != null &&
          value !== "" &&
          !creatableEmptyQueryRef.current
        ) {
          const label =
            selectOptions.find(o => o.value === value)?.label ?? String(value)
          setInputValue(label)
          return
        }
        if (creatableEmptyQueryRef.current && next === "") {
          setInputValue(next)
          return
        }
        creatableEmptyQueryRef.current = false
        setInputValue(next)
        return
      }
      if (creatableEmptyQueryRef.current && next.length > 0) {
        creatableEmptyQueryRef.current = false
      }
      if (
        open &&
        next === "" &&
        value != null &&
        value !== "" &&
        !creatableEmptyQueryRef.current &&
        openInputSyncBatchRef.current &&
        openSyncEmptyRestoresRef.current < 3
      ) {
        openSyncEmptyRestoresRef.current += 1
        const label =
          selectOptions.find(o => o.value === value)?.label ?? String(value)
        setInputValue(label)
        return
      }
      if (!open && value !== null && next === "" && inputValue === value) {
        valueBeforeRemovalRef.current = value
        setValue(null)
        setInputValue("")
        return
      }
      setInputValue(next)
    },
    [inputValue, open, selectOptions, value]
  )

  const handleCreatableEnterCapture = useCallback(
    (e: KeyboardEvent) => {
      if (e.key !== "Enter" || !acceptNewOptions || selectDisabled) {
        return
      }
      const fromDom =
        e.target instanceof HTMLInputElement
          ? e.target.value
          : ((e.currentTarget as HTMLElement | null)?.querySelector("input")
              ?.value ?? "")
      const trimmed = fromDom.trim()
      if (!trimmed) {
        return
      }
      const exists = selectOptions.some(o => o.value === trimmed)
      if (!exists) {
        e.preventDefault()
        e.stopPropagation()
        handleValueChange(trimmed)
        setOpen(false)
      }
    },
    [acceptNewOptions, handleValueChange, selectDisabled, selectOptions]
  )

  const borderColor = getBorderColor(theme.colors, open)

  const renderSelectboxRow = useCallback(
    ({
      row,
      index,
      style,
    }: {
      row: SelectboxVirtualRow
      index: number
      style: React.CSSProperties
    }) => {
      const displayLabel = row.isCreatable ? row.label : row.label
      return (
        <Combobox.Item
          key={row.id}
          value={row.value}
          index={index}
          style={style}
          render={itemProps => (
            <li {...itemProps}>
              <ThemedStyledDropdownListItem
                as="div"
                $isCreatable={row.isCreatable}
              >
                <StyledHighlightWrapper $isHighlighted={false}>
                  <OverflowTooltip
                    content={displayLabel}
                    placement={Placement.AUTO}
                  >
                    {displayLabel}
                  </OverflowTooltip>
                </StyledHighlightWrapper>
              </ThemedStyledDropdownListItem>
            </li>
          )}
        />
      )
    },
    []
  )

  return (
    <div className="stSelectbox" data-testid="stSelectbox">
      <WidgetLabel
        label={label}
        labelVisibility={labelVisibility}
        disabled={selectDisabled}
      >
        {help && <WidgetLabelHelpIcon content={help} label={label} />}
      </WidgetLabel>
      <Combobox.Root
        open={open}
        value={value}
        onValueChange={(v, eventDetails) => {
          handleComboboxValueChange(v as string | null, eventDetails)
        }}
        inputValue={inputValue}
        onInputValueChange={handleInputValueChange}
        onOpenChange={(nextOpen, eventDetails) =>
          handleOpenChange(nextOpen, eventDetails)
        }
        items={comboboxItems}
        filteredItems={filteredItemValues}
        filter={null}
        disabled={selectDisabled}
        virtualized
        modal={false}
      >
        <ControlContainer
          style={{
            borderTopColor: borderColor,
            borderRightColor: borderColor,
            borderBottomColor: borderColor,
            borderLeftColor: borderColor,
          }}
        >
          <ValueContainer>
            {showPlaceholder && (
              <PlaceholderSpan style={{ color: placeholderColor }}>
                {selectboxPlaceholder}
              </PlaceholderSpan>
            )}
            <InputWrap
              onKeyDownCapture={e => {
                handleCreatableEnterCapture(e)
                if (e.defaultPrevented) {
                  return
                }
                if (e.key !== "Backspace" && e.key !== "Delete") {
                  return
                }
                if (open || value === null || value === "") {
                  return
                }
                if (inputValue !== value) {
                  return
                }
                const str = String(value)
                if (str.length !== 1) {
                  return
                }
                e.preventDefault()
                e.stopPropagation()
                valueBeforeRemovalRef.current = value
                setValue(null)
                setInputValue("")
              }}
            >
              {!open && value != null && value !== "" && (
                <SelectionMirror>{value}</SelectionMirror>
              )}
              <StyledComboboxInput
                data-testid="stSelectboxComboboxInput"
                $disabled={selectDisabled}
                disabled={selectDisabled}
                readOnly={inputReadOnly != null}
                aria-label={label || ""}
                placeholder={open ? selectboxPlaceholder : undefined}
                onFocus={e => {
                  if (selectDisabled) {
                    return
                  }
                  if (acceptNewOptions) {
                    ;(e.target as HTMLInputElement).select()
                    return
                  }
                  if (value != null && value !== "" && inputValue === "") {
                    setInputValue(value)
                  }
                }}
                onKeyDown={e => {
                  if (e.key !== "Escape") {
                    return
                  }
                  e.preventDefault()
                  e.stopPropagation()
                  if (open) {
                    if (clearable && value != null && value !== "") {
                      handleValueChange(null)
                    } else {
                      const label =
                        value == null || value === ""
                          ? ""
                          : (selectOptions.find(o => o.value === value)
                              ?.label ?? String(value))
                      setInputValue(label)
                    }
                    setOpen(false)
                    return
                  }
                  if (!clearable) {
                    return
                  }
                  if (value == null || value === "") {
                    return
                  }
                  handleValueChange(null)
                }}
              />
            </InputWrap>
          </ValueContainer>
          <IconsContainer>
            {clearable && value != null && value !== "" && !selectDisabled && (
              <ClearButton
                type="button"
                aria-label="Clear"
                disabled={selectDisabled}
              />
            )}
            <Combobox.Icon
              style={selectDisabled ? { cursor: "not-allowed" } : undefined}
            >
              <ChevronIcon
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden
              >
                <path
                  d="M6 9l6 6 6-6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </ChevronIcon>
            </Combobox.Icon>
          </IconsContainer>
        </ControlContainer>

        {open ? (
          <Combobox.Portal keepMounted={false}>
            <Combobox.Positioner
              side="bottom"
              align="start"
              sideOffset={convertRemToPx(theme.spacing.twoXS)}
              collisionBoundary={
                isInSidebar ? undefined : "clipping-ancestors"
              }
            >
              <PopupPanel data-testid="stSelectboxDropdownPopup">
                <Combobox.List>
                  {displayRows.length === 0 ? (
                    <Combobox.Empty
                      data-testid="stSelectboxVirtualDropdown"
                      style={{
                        padding: theme.spacing.md,
                        color: theme.colors.fadedText60,
                      }}
                    >
                      No results
                    </Combobox.Empty>
                  ) : (
                    <VirtualDropdown
                      selectboxListDataTestId="stSelectboxVirtualDropdown"
                      selectboxVirtualRows={displayRows}
                      renderSelectboxRow={renderSelectboxRow}
                    />
                  )}
                </Combobox.List>
              </PopupPanel>
            </Combobox.Positioner>
          </Combobox.Portal>
        ) : null}
      </Combobox.Root>
    </div>
  )
}

export default memo(Selectbox)
