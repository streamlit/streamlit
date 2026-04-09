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

import { ExpandMore } from "@emotion-icons/material-outlined"
import isPropValid from "@emotion/is-prop-valid"
import styled from "@emotion/styled"
import {
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  shift,
  size,
  useDismiss,
  useFloating,
  useInteractions,
} from "@floating-ui/react"
import {
  FC,
  FocusEvent,
  KeyboardEvent,
  memo,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react"

import { streamlit } from "@streamlit/protobuf"

import IsSidebarContext from "~lib/components/core/IsSidebarContext"
import {
  getBorderColor,
  getPopoverContainerStyle,
} from "~lib/components/shared/Base/styled-components"
import VirtualDropdown from "~lib/components/shared/Dropdown/VirtualDropdown"
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

type SelectOptionItem = {
  label: string
  value: string
  id: string
  isCreatable?: boolean
}

/** Props-only carrier; VirtualDropdown reads props via Children, not by rendering. */
function VirtualOptionCarrier(): null {
  return null
}

function EmptyDropdownMessage(): null {
  return null
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
  const listboxId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  /**
   * When the input still shows the full committed value, the first typed character
   * appends in the DOM ("male" + "x" → "malex"); collapse to that char for search.
   * Skip when the user has already edited (e.g. Backspace) so inputValue !== value.
   */
  const firstEditAfterFocusRef = useRef(true)

  const [value, setValue] = useState<string | null>(propValue ?? null)
  const valueBeforeRemovalRef = useRef<string | null>(null)
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const [inputValue, setInputValue] = useState("")
  /** Filter string for options; reset on focus so the menu lists all options while input shows value. */
  const [searchFilter, setSearchFilter] = useState("")
  const [highlightedIndex, setHighlightedIndex] = useState(0)

  useExecuteWhenChanged(() => {
    setValue(propValue ?? null)
    valueBeforeRemovalRef.current = null
  }, [propValue])

  const opts = propOptions

  const {
    placeholder: selectboxPlaceholder,
    disabled: shouldDisable,
    selectOptions,
    inputReadOnly,
    valueToUiSingle,
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

  const baseFiltered = useMemo((): readonly SelectOptionItem[] => {
    return filterOptions(selectOptions, searchFilter) as SelectOptionItem[]
  }, [filterOptions, selectOptions, searchFilter])

  const displayOptions = useMemo((): SelectOptionItem[] => {
    const base = [...baseFiltered]
    if (
      acceptNewOptions &&
      searchFilter &&
      !selectOptions.some(o => o.value === searchFilter)
    ) {
      base.push({
        label: searchFilter,
        value: searchFilter,
        id: `__creatable__${searchFilter}`,
        isCreatable: true,
      })
    }
    return base
  }, [acceptNewOptions, baseFiltered, searchFilter, selectOptions])

  useEffect(() => {
    if (!open) {
      return
    }
    const idx = displayOptions.findIndex(o => o.value === value)
    setHighlightedIndex(idx >= 0 ? idx : 0)
  }, [open, displayOptions, value])

  const commitSelection = useCallback(
    (next: string | null) => {
      valueBeforeRemovalRef.current = null
      setValue(next)
      onChange(next)
      setOpen(false)
      setFocused(false)
      setInputValue(next ?? "")
      setSearchFilter("")
      requestAnimationFrame(() => {
        inputRef.current?.blur()
      })
    },
    [onChange]
  )

  const handleBlur = useCallback(() => {
    setFocused(false)
    firstEditAfterFocusRef.current = true
    setOpen(false)
    setSearchFilter("")
    if (valueBeforeRemovalRef.current !== null) {
      const restore = valueBeforeRemovalRef.current
      valueBeforeRemovalRef.current = null
      setValue(restore)
      setInputValue(restore)
      return
    }
    // Use prop so we stay in sync if the parent committed value (e.g. session_state) while open.
    setInputValue(propValue ?? "")
  }, [propValue])

  const handleFocus = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      setFocused(true)
      firstEditAfterFocusRef.current = true
      // Use parent prop so session_state / proto updates are reflected immediately
      // (local `value` can lag one interaction behind in edge cases).
      const text = propValue ?? ""
      setInputValue(text)
      setSearchFilter("")
      if (!selectDisabled) {
        setOpen(true)
      }
      // When a committed value is shown, move the caret to the end after focus.
      // Skip if empty: a deferred setSelectionRange can run after the first search
      // keystroke and corrupt the filter string (unit tests + clearable empty select).
      if (text.length > 0) {
        const el = e.currentTarget
        requestAnimationFrame(() => {
          try {
            const len = text.length
            el.setSelectionRange(len, len)
          } catch {
            // setSelectionRange not supported on some input types
          }
        })
      }
    },
    [selectDisabled, propValue]
  )

  const { refs, floatingStyles, context } = useFloating({
    open: open && !selectDisabled,
    onOpenChange: next => {
      if (!selectDisabled) {
        setOpen(next)
      }
    },
    placement: "bottom-start",
    strategy: "fixed",
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(convertRemToPx(theme.spacing.twoXS)),
      flip({
        boundary: isInSidebar ? document.documentElement : undefined,
      }),
      shift({ padding: 8 }),
      size({
        apply({ availableHeight, rects, elements }) {
          const refWidth =
            rects.reference.width > 1 ? rects.reference.width : 320
          // jsdom often reports 0 available height; keep a floor so VirtualDropdown can render.
          const safeAvail = Math.max(availableHeight, 320)
          Object.assign(elements.floating.style, {
            width: `${refWidth}px`,
            maxHeight: `min(${theme.sizes.maxDropdownHeight}, ${safeAvail}px, 70vh)`,
            overflow: "hidden",
          })
        },
      }),
    ],
  })

  const dismiss = useDismiss(context, {
    outsidePress: true,
    escapeKey: false,
  })

  const { getReferenceProps, getFloatingProps } = useInteractions([dismiss])

  // When the listbox is open, focus may be on the floating surface (not the input).
  // Handle Escape in capture phase so Playwright and keyboard users get consistent behavior.
  useEffect(() => {
    if (!open || selectDisabled) {
      return
    }
    const onDocKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") {
        return
      }
      const t = e.target
      if (!(t instanceof Node)) {
        return
      }
      const refEl = refs.reference.current
      const floatEl = refs.floating.current
      if ((refEl && refEl.contains(t)) || (floatEl && floatEl.contains(t))) {
        e.preventDefault()
        if (open) {
          // index=None selectboxes are clearable: Escape clears while the menu is open.
          // index set (non-clearable): Escape only closes the menu and keeps the value.
          if (clearable && propValue !== null && propValue !== "") {
            commitSelection(null)
          } else {
            setOpen(false)
            setSearchFilter("")
            requestAnimationFrame(() => {
              inputRef.current?.blur()
            })
          }
          return
        }
        if (clearable && propValue !== null && propValue !== "") {
          commitSelection(null)
        } else {
          setOpen(false)
          requestAnimationFrame(() => {
            inputRef.current?.blur()
          })
        }
      }
    }
    document.addEventListener("keydown", onDocKeyDown, true)
    return () => document.removeEventListener("keydown", onDocKeyDown, true)
  }, [
    open,
    selectDisabled,
    clearable,
    propValue,
    commitSelection,
    refs.reference,
    refs.floating,
  ])

  const onInputKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (selectDisabled) {
        return
      }

      if (e.key === "Escape") {
        e.preventDefault()
        if (open) {
          // Dropdown open: capture-phase listener on `document` handles Escape (input may
          // not be the event target when focus is on the floating listbox).
          return
        }
        // index=None selectboxes are clearable: Escape clears when the menu is closed.
        if (clearable && propValue !== null && propValue !== "") {
          commitSelection(null)
        }
        return
      }

      if (e.key === "Backspace" && !inputReadOnly) {
        const v = value
        // Only intercept when the field is collapsed (!focused). When focused, Backspace
        // edits the text one character at a time (e2e dismiss / partial edit).
        if (
          v !== null &&
          !focused &&
          (inputValue === "" || inputValue === v)
        ) {
          e.preventDefault()
          valueBeforeRemovalRef.current = v
          setValue(null)
          setInputValue("")
          setSearchFilter("")
          return
        }
      }

      if (e.key === "ArrowDown") {
        e.preventDefault()
        if (!open) {
          setOpen(true)
        }
        setHighlightedIndex(i =>
          Math.min(i + 1, Math.max(displayOptions.length - 1, 0))
        )
        return
      }

      if (e.key === "ArrowUp") {
        e.preventDefault()
        if (!open) {
          setOpen(true)
        }
        setHighlightedIndex(i => Math.max(i - 1, 0))
        return
      }

      if (e.key === "Enter") {
        e.preventDefault()
        if (!open || displayOptions.length === 0) {
          return
        }
        const opt = displayOptions[highlightedIndex]
        if (opt) {
          commitSelection(opt.value)
        }
        return
      }

      if ((e.key === "Tab" || e.key === "Home" || e.key === "End") && open) {
        setOpen(false)
      }
    },
    [
      clearable,
      commitSelection,
      displayOptions,
      focused,
      highlightedIndex,
      inputReadOnly,
      inputValue,
      open,
      propValue,
      selectDisabled,
      value,
    ]
  )

  const onControlMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (selectDisabled) {
        return
      }
      if (e.target === inputRef.current) {
        return
      }
      e.preventDefault()
      inputRef.current?.focus()
      setOpen(o => !o)
    },
    [selectDisabled]
  )

  const selectValue = valueToUiSingle(value)

  const showCollapsedValue = !focused && value !== null && value !== ""

  const showPlaceholder =
    selectValue.length === 0 &&
    (!focused || inputValue === "" || selectDisabled)

  const inputDisplay = (() => {
    // Keep the committed value in the DOM even when the visible label is drawn by
    // StyledDisplayedValue (transparent input). Otherwise the field is literally ""
    // until the next paint after focus, and Backspace/type operate on empty text (e2e).
    if (showCollapsedValue) {
      return value ?? ""
    }
    if (!focused && !open) {
      return value ?? ""
    }
    return inputValue
  })()

  const dropdownContent = (() => {
    if (displayOptions.length === 0) {
      return (
        <VirtualDropdown>
          <EmptyDropdownMessage>No results</EmptyDropdownMessage>
        </VirtualDropdown>
      )
    }
    return (
      <VirtualDropdown>
        {displayOptions.map((opt, idx) => (
          <VirtualOptionCarrier
            key={opt.id}
            item={opt}
            $isHighlighted={idx === highlightedIndex}
            onMouseDown={e => {
              e.preventDefault()
              e.stopPropagation()
            }}
            onClick={e => {
              e.preventDefault()
              commitSelection(opt.value)
            }}
            onMouseEnter={() => setHighlightedIndex(idx)}
            role="option"
            aria-selected={idx === highlightedIndex}
            id={`${listboxId}-opt-${idx}`}
          />
        ))}
      </VirtualDropdown>
    )
  })()

  return (
    <div className="stSelectbox" data-testid="stSelectbox">
      <WidgetLabel
        label={label}
        labelVisibility={labelVisibility}
        disabled={selectDisabled}
      >
        {help && <WidgetLabelHelpIcon content={help} label={label} />}
      </WidgetLabel>
      <StyledRoot
        ref={refs.setReference}
        {...getReferenceProps({
          onMouseDown: onControlMouseDown,
        })}
      >
        <StyledControl $isFocused={focused || open} $disabled={selectDisabled}>
          <StyledValueContainer>
            {showPlaceholder && (
              <StyledPlaceholder $disabled={selectDisabled}>
                {selectboxPlaceholder}
              </StyledPlaceholder>
            )}
            <StyledInputContainer>
              {showCollapsedValue && (
                <StyledDisplayedValue>{value}</StyledDisplayedValue>
              )}
              <StyledInput
                ref={inputRef}
                type="text"
                role="combobox"
                aria-expanded={open}
                aria-controls={listboxId}
                aria-autocomplete="list"
                aria-label={label || ""}
                disabled={selectDisabled}
                readOnly={Boolean(inputReadOnly)}
                value={inputDisplay}
                $hideText={showCollapsedValue}
                onChange={e => {
                  if (inputReadOnly) {
                    return
                  }
                  let next = e.target.value
                  if (
                    firstEditAfterFocusRef.current &&
                    value != null &&
                    inputValue === value &&
                    next.length === value.length + 1 &&
                    next.startsWith(value)
                  ) {
                    next = next.slice(-1)
                  }
                  firstEditAfterFocusRef.current = false
                  setInputValue(next)
                  setSearchFilter(next)
                  if (!open) {
                    setOpen(true)
                  }
                }}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onKeyDown={onInputKeyDown}
              />
            </StyledInputContainer>
          </StyledValueContainer>
          <StyledIconsContainer>
            {clearable && value !== null && !selectDisabled && (
              <StyledClearButton
                type="button"
                aria-label="Clear"
                tabIndex={-1}
                onMouseDown={e => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onClick={e => {
                  e.stopPropagation()
                  valueBeforeRemovalRef.current = null
                  commitSelection(null)
                }}
              >
                <StyledClearSvg
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    fill="currentColor"
                    d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                  />
                </StyledClearSvg>
              </StyledClearButton>
            )}
            <StyledChevronWrapper $disabled={selectDisabled}>
              <StyledChevronIcon />
            </StyledChevronWrapper>
          </StyledIconsContainer>
        </StyledControl>
      </StyledRoot>
      {open && !selectDisabled && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            id={listboxId}
            role="listbox"
            style={{
              zIndex: theme.zIndices.popup,
              overflow: "hidden",
              ...getPopoverContainerStyle(theme),
              ...floatingStyles,
            }}
            {...getFloatingProps({
              onMouseDown(e) {
                e.preventDefault()
              },
            })}
          >
            {dropdownContent}
          </div>
        </FloatingPortal>
      )}
    </div>
  )
}

const StyledRoot = styled.div(() => ({
  lineHeight: "inherit",
  width: "100%",
}))

const StyledControl = styled.div<{
  $isFocused: boolean
  $disabled: boolean
}>(({ theme, $isFocused, $disabled }) => {
  const borderColor = getBorderColor(theme.colors, $isFocused)
  return {
    display: "flex",
    alignItems: "stretch",
    width: "100%",
    minHeight: theme.sizes.minElementHeight,
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
    backgroundColor: theme.colors.widgetBackgroundColor,
    cursor: $disabled ? "not-allowed" : "text",
    boxSizing: "border-box",
    fontWeight: theme.fontWeights.normal,
    lineHeight: theme.lineHeights.inputWidget,
  }
})

const StyledValueContainer = styled.div(({ theme }) => ({
  position: "relative",
  display: "flex",
  alignItems: "center",
  flexGrow: 1,
  minWidth: 0,
  paddingRight: theme.spacing.sm,
  paddingLeft: theme.spacing.sm,
  paddingBottom: theme.spacing.sm,
  paddingTop: theme.spacing.sm,
  marginLeft: theme.sizes.tagMarginInsideBorder,
}))

const StyledPlaceholder = styled.div<{ $disabled: boolean }>(
  ({ theme, $disabled }) => ({
    color: $disabled ? theme.colors.fadedText40 : theme.colors.fadedText60,
    position: "absolute",
    pointerEvents: "none",
    left: 0,
    top: "50%",
    transform: "translateY(-50%)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "100%",
  })
)

const StyledInputContainer = styled.div(({ theme }) => ({
  marginLeft: theme.spacing.none,
  position: "relative",
  minWidth: theme.spacing.threeXS,
  flexGrow: 1,
  flexShrink: 1,
}))

const StyledDisplayedValue = styled.span(({ theme }) => ({
  position: "absolute",
  left: 0,
  top: "50%",
  transform: "translateY(-50%)",
  pointerEvents: "none",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  maxWidth: "100%",
  lineHeight: theme.lineHeights.inputWidget,
  color: theme.colors.bodyText,
}))

const StyledInput = styled("input", {
  shouldForwardProp: prop => isPropValid(prop) && prop !== "$hideText",
})<{ $hideText: boolean }>(({ theme, $hideText }) => ({
  width: "100%",
  minWidth: "2em",
  border: "none",
  outline: "none",
  background: "transparent",
  padding: 0,
  margin: 0,
  font: "inherit",
  lineHeight: theme.lineHeights.inputWidget,
  color: $hideText ? "transparent" : theme.colors.bodyText,
  caretColor: $hideText ? "transparent" : theme.colors.bodyText,
}))

const StyledIconsContainer = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  flexShrink: 0,
  paddingRight: theme.spacing.sm,
  gap: theme.spacing.threeXS,
}))

const StyledClearButton = styled.button(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
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

const StyledClearSvg = styled.svg({
  width: "100%",
  height: "100%",
})

const StyledChevronWrapper = styled.span<{ $disabled: boolean }>(
  ({ theme, $disabled }) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: $disabled ? "not-allowed" : "default",
    color: theme.colors.grayTextColor,
  })
)

const StyledChevronIcon = styled(ExpandMore)(({ theme }) => ({
  width: theme.iconSizes.xl,
  height: theme.iconSizes.xl,
}))

export default memo(Selectbox)
