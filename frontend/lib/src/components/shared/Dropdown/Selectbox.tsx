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
  FocusEvent,
  memo,
  KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  SyntheticEvent,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import isPropValid from "@emotion/is-prop-valid"
import styled from "@emotion/styled"
import { ExpandMore } from "@emotion-icons/material-outlined"
import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  size,
  useDismiss,
  useFloating,
  useInteractions,
} from "@floating-ui/react"
import type { OptionListProps } from "baseui/menu"
import { flushSync } from "react-dom"

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
function VirtualOptionCarrier(_props: OptionListProps): null {
  return null
}

function EmptyDropdownMessage(_props: { children?: ReactNode }): null {
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
  /** Latest prop value for Escape/blur handlers (avoid stale closures on document listeners). */
  const propValueRef = useRef(propValue)
  propValueRef.current = propValue
  /** Committed selection (`value` state); blur must sync the input to this, not to `propValueRef`, which can lag after onChange. */
  const committedValueRef = useRef<string | null>(propValue ?? null)
  /** Used to detect browser "select all" right after focus (Playwright / macOS). */
  const focusTimestampRef = useRef(0)
  /**
   * When the input still shows the full committed value, the first typed character
   * appends in the DOM ("male" + "x" → "malex"); collapse to that char for search.
   * Skip when the user has already edited (e.g. Backspace) so inputValue !== value.
   */
  const firstEditAfterFocusRef = useRef(true)
  /** After focus, move caret to end once (avoids browser select-all wiping partial edits). */
  const placeCaretAtEndAfterFocusRef = useRef(false)
  /** Tracks focus transitions for layout-phase caret + input sync (e2e / fast input). */
  const wasFocusedRef = useRef(false)

  const [value, setValue] = useState<string | null>(propValue ?? null)
  committedValueRef.current = value
  const valueBeforeRemovalRef = useRef<string | null>(null)
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  /** Synchronous mirror of `focused` so keydown runs before the next paint see the real focus state. */
  const focusedRef = useRef(false)
  const [inputValue, setInputValue] = useState("")
  /** Filter string for options; reset on focus so the menu lists all options while input shows value. */
  const [searchFilter, setSearchFilter] = useState("")
  const [highlightedIndex, setHighlightedIndex] = useState(0)

  useExecuteWhenChanged(() => {
    const next = propValue ?? null
    setValue(next)
    committedValueRef.current = next
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
      committedValueRef.current = next
      setValue(next)
      onChange(next)
      setOpen(false)
      focusedRef.current = false
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
    focusedRef.current = false
    setFocused(false)
    firstEditAfterFocusRef.current = true
    setOpen(false)
    setSearchFilter("")
    if (valueBeforeRemovalRef.current !== null) {
      const restore = valueBeforeRemovalRef.current
      valueBeforeRemovalRef.current = null
      committedValueRef.current = restore
      setValue(restore)
      setInputValue(restore)
      return
    }
    // Sync to committed selection, not `propValueRef` — the prop can lag one frame after
    // commitSelection / Escape while the parent rerenders (stale prop would break clear + session_state).
    setInputValue(committedValueRef.current ?? "")
  }, [])

  const handleFocus = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      focusedRef.current = true
      firstEditAfterFocusRef.current = true
      focusTimestampRef.current = Date.now()
      // Use parent prop so session_state / proto updates are reflected immediately
      // (local `value` can lag one interaction behind in edge cases).
      const text = propValueRef.current ?? ""
      // Flush so the controlled input shows the committed label before the next
      // key event (Playwright/e2e can otherwise see inputValue "" and type "xyz").
      flushSync(() => {
        setFocused(true)
        setInputValue(text)
        setSearchFilter("")
        if (!selectDisabled) {
          setOpen(true)
        }
      })
      if (text.length > 0) {
        placeCaretAtEndAfterFocusRef.current = true
      }
      // Avoid browser select-all on focus (Playwright / some browsers): caret must stay
      // at the end so Backspace edits the committed label instead of clearing it.
      const el = e.currentTarget
      const placeCaret = (): void => {
        if (document.activeElement !== el) {
          return
        }
        const len = el.value.length
        if (len > 0) {
          try {
            el.setSelectionRange(len, len)
          } catch {
            // setSelectionRange not supported on some input types
          }
        }
      }
      queueMicrotask(placeCaret)
      requestAnimationFrame(placeCaret)
      requestAnimationFrame(() => requestAnimationFrame(placeCaret))
    },
    [selectDisabled]
  )

  useLayoutEffect(() => {
    const gainedFocus = focused && !wasFocusedRef.current
    wasFocusedRef.current = focused

    if (!focused || selectDisabled || inputReadOnly) {
      if (!focused) {
        placeCaretAtEndAfterFocusRef.current = false
      }
      return
    }

    const el = inputRef.current
    if (!el) {
      return
    }

    // On focus entry, ensure React state matches the committed label so the first
    // Backspace edits the tail (not an empty/fully-selected field from stale "").
    if (gainedFocus) {
      const label = committedValueRef.current ?? ""
      if (label !== "" && inputValue !== label) {
        setInputValue(label)
        setSearchFilter("")
        placeCaretAtEndAfterFocusRef.current = true
        return
      }
    }

    if (!placeCaretAtEndAfterFocusRef.current) {
      return
    }
    placeCaretAtEndAfterFocusRef.current = false

    const len = el.value.length
    if (len > 0 && document.activeElement === el) {
      try {
        el.setSelectionRange(len, len)
      } catch {
        // setSelectionRange not supported on some input types
      }
    }
  }, [focused, inputValue, selectDisabled, inputReadOnly])

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
      shift({ padding: convertRemToPx(theme.spacing.sm) }),
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
    const onDocKeyDown = (e: globalThis.KeyboardEvent): void => {
      if (e.key !== "Escape") {
        return
      }
      const t = e.target
      const refEl = refs.reference.current
      const floatEl = refs.floating.current
      const refNode = refEl instanceof HTMLElement ? refEl : null
      const floatNode = floatEl instanceof HTMLElement ? floatEl : null
      const active =
        document.activeElement instanceof Node ? document.activeElement : null
      const targetInside =
        t instanceof Node &&
        ((refNode?.contains(t) ?? false) || (floatNode?.contains(t) ?? false))
      const activeInside =
        active &&
        ((refNode?.contains(active) ?? false) ||
          (floatNode?.contains(active) ?? false))
      if (targetInside || activeInside) {
        e.preventDefault()
        e.stopPropagation()
        // index=None selectboxes are clearable: Escape clears while the menu is open.
        // index set (non-clearable): Escape closes and restores committed value (no onChange).
        // Use committedValueRef so session_state / widget value wins over a stale prop ref.
        const committed = committedValueRef.current
        if (clearable && committed !== null && committed !== "") {
          commitSelection(null)
        } else {
          const nextCommitted = committed ?? null
          setOpen(false)
          setSearchFilter("")
          setInputValue(nextCommitted ?? "")
          committedValueRef.current = nextCommitted
          setValue(nextCommitted)
          firstEditAfterFocusRef.current = true
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
    commitSelection,
    refs.reference,
    refs.floating,
  ])

  const onInputKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLInputElement>) => {
      if (selectDisabled) {
        return
      }

      if (e.key === "Escape") {
        e.preventDefault()
        const committed = committedValueRef.current
        if (open) {
          // Usually handled in capture on document (focus may be on the listbox). If that
          // path missed the event target, close/restore here so session_state + clearable
          // behavior stay consistent.
          if (clearable && committed !== null && committed !== "") {
            commitSelection(null)
          } else {
            const nextCommitted = committed ?? null
            setOpen(false)
            setSearchFilter("")
            setInputValue(nextCommitted ?? "")
            committedValueRef.current = nextCommitted
            setValue(nextCommitted)
            firstEditAfterFocusRef.current = true
            requestAnimationFrame(() => {
              inputRef.current?.blur()
            })
          }
          return
        }
        // index=None selectboxes are clearable: Escape clears when the menu is closed.
        if (clearable && committed !== null && committed !== "") {
          commitSelection(null)
        }
        return
      }

      if (e.key === "Backspace" && !inputReadOnly) {
        const v = value
        // Only when the combobox is not actually focused in the DOM (e.g. programmatic
        // keydown in tests). If the input is focused, Backspace must edit the label
        // incrementally — `focusedRef` can lag one frame behind `focus` (e2e).
        const inputIsFocused = document.activeElement === inputRef.current
        if (
          v !== null &&
          !inputIsFocused &&
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
      highlightedIndex,
      inputReadOnly,
      inputValue,
      open,
      selectDisabled,
      value,
    ]
  )

  const onInputSelect = useCallback(
    (e: SyntheticEvent<HTMLInputElement>) => {
      if (selectDisabled || inputReadOnly) {
        return
      }
      const el = e.currentTarget
      const len = el.value.length
      if (len === 0) {
        return
      }
      const soonAfterFocus = Date.now() - focusTimestampRef.current < 500
      const selStart = el.selectionStart
      const selEnd = el.selectionEnd
      if (
        soonAfterFocus &&
        selStart === 0 &&
        selEnd === len &&
        document.activeElement === el
      ) {
        requestAnimationFrame(() => {
          if (document.activeElement !== el) {
            return
          }
          try {
            el.setSelectionRange(len, len)
          } catch {
            // ignore
          }
        })
      }
    },
    [selectDisabled, inputReadOnly]
  )

  const onControlMouseDown = useCallback(
    (e: ReactMouseEvent) => {
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
            getItemLabel={item => item.label}
            $isHighlighted={idx === highlightedIndex}
            onMouseDown={(e: ReactMouseEvent) => {
              e.preventDefault()
              e.stopPropagation()
            }}
            onClick={(e: ReactMouseEvent) => {
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
                onMouseDown={e => {
                  if (selectDisabled || inputReadOnly) {
                    return
                  }
                  const v = value
                  if (notNullOrUndefined(v) && v !== "" && !focused) {
                    e.preventDefault()
                    e.currentTarget.focus()
                  }
                }}
                onMouseUp={e => {
                  if (selectDisabled || inputReadOnly) {
                    return
                  }
                  // Suppress click-to-select-all after focus (especially with preventDefault
                  // on mousedown); keep caret at end for incremental editing.
                  const el = e.currentTarget
                  if (document.activeElement === el && el.value.length > 0) {
                    try {
                      const len = el.value.length
                      el.setSelectionRange(len, len)
                    } catch {
                      // ignore
                    }
                  }
                }}
                onChange={e => {
                  if (inputReadOnly) {
                    return
                  }
                  let next = e.target.value
                  if (
                    firstEditAfterFocusRef.current &&
                    notNullOrUndefined(value) &&
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
                onSelect={onInputSelect}
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
    backgroundColor: theme.colors.secondaryBg,
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
