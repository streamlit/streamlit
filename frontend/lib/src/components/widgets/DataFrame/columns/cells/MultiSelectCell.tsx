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
 * Custom MultiSelectCell implementation using react-select.
 *
 * NOTE: This is a custom implementation that replaces glide-data-grid's built-in
 * multi-select cell. We should consider switching back to glide-data-grid's
 * native implementation once the release process is fixed and includes
 * the fix.
 */

import type {
  ComponentPropsWithoutRef,
  FC,
  KeyboardEvent,
  KeyboardEventHandler,
  MouseEvent,
  TouchEvent,
} from "react"
import { useCallback, useMemo, useState } from "react"

import styled from "@emotion/styled"
import {
  type CustomCell,
  type CustomRenderer,
  getLuminance,
  getMiddleCenterBias,
  GridCellKind,
  measureTextCached,
  type ProvideEditorCallback,
  type Rectangle,
  roundedRect,
  useTheme,
} from "@glideapps/glide-data-grid"
import Select, {
  components,
  type MenuProps,
  type MultiValueGenericProps,
  type StylesConfig,
} from "react-select"
import CreatableSelect from "react-select/creatable"

import { isNullOrUndefined } from "@streamlit/utils"

export type SelectOption = { value: string; label?: string; color?: string }

interface MultiSelectCellProps {
  readonly kind: "multi-select-cell"
  /* The list of values of this cell. */
  readonly values: string[] | undefined | null
  /* The list of possible options that can be selected.
    The options can be provided as a list of strings
    or as a list of objects with the following properties:
    - value: The value of this option.
    - label: The label of this option. If not provided, the value will be used as the label.
    - color: The color of this option. If not provided, the default color will be used. */
  readonly options?: readonly (SelectOption | string)[]
  /* If true, users can create new values that are not part of the configured options. */
  readonly allowCreation?: boolean
  /* If true, users can select the same value multiple times. */
  readonly allowDuplicates?: boolean
}

/* This prefix is used when allowDuplicates is enabled to make sure that
all underlying values are unique. */
const VALUE_PREFIX = "__value"
const VALUE_PREFIX_REGEX = new RegExp(`^${VALUE_PREFIX}\\d+__`)

// eslint-disable-next-line streamlit-custom/no-hardcoded-theme-values -- Uses glide-data-grid CSS variables
const StyledWrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  margin-top: auto;
  margin-bottom: auto;
  .gdg-multi-select {
    font-family: var(--gdg-font-family);
    font-size: var(--gdg-editor-font-size);
  }
`

// eslint-disable-next-line streamlit-custom/no-hardcoded-theme-values -- Uses glide-data-grid CSS variables
const StyledPortalWrap = styled.div`
  font-family: var(--gdg-font-family);
  font-size: var(--gdg-editor-font-size);
  color: var(--gdg-text-dark);

  > div {
    border-radius: 0.25rem;
    border: 1px solid var(--gdg-border-color);
  }
`

/**
 * Prepares the options for usage with the react-select component.
 *
 * @param options The options to prepare.
 * @returns The prepared options in the format required by react-select.
 */
export const prepareOptions = (
  options: readonly (string | SelectOption)[]
): { value: string; label?: string; color?: string }[] => {
  return options.map(option => {
    if (typeof option === "string") {
      return { value: option, label: option, color: undefined }
    }

    if (isNullOrUndefined(option)) {
      return { value: "", label: "", color: undefined }
    }

    return {
      value: option.value,
      label: option.label ?? option.value ?? "",
      color: option.color,
    }
  })
}

/**
 * Resolve a list values to values compatible with react-select.
 * If allowDuplicates is true, the values will be prefixed with a numbered prefix to
 * make sure that all values are unique.
 *
 * @param values The values to resolve.
 * @param options The options to use for the resolution.
 * @param allowDuplicates If true, the values can contain duplicates.
 * @returns The list of values compatible with react-select.
 */
export const resolveValues = (
  values: string[] | null | undefined,
  options: readonly SelectOption[],
  allowDuplicates?: boolean
): { value: string; label?: string; color?: string }[] => {
  if (isNullOrUndefined(values)) {
    return []
  }

  return values.map((value, index) => {
    const valuePrefix = allowDuplicates ? `${VALUE_PREFIX}${index}__` : ""
    const matchedOption = options.find(option => {
      return option.value === value
    })
    if (matchedOption) {
      return {
        ...matchedOption,
        value: `${valuePrefix}${matchedOption.value}`,
      }
    }
    return { value: `${valuePrefix}${value}`, label: value }
  })
}

type CustomMenuProps = MenuProps<SelectOption, true>

const CustomMenu: FC<CustomMenuProps> = p => {
  const { Menu } = components
  const { children, ...rest } = p
  return <Menu {...rest}>{children}</Menu>
}

/**
 * Custom MultiValueLabel component that allows text selection within pills.
 * By default, react-select prevents text selection via onMouseDown preventDefault.
 * We override this to allow users to select and copy text from the pills.
 *
 * Side effects:
 * - Clicking on the pill label text won't focus the select input (click elsewhere to focus)
 * - Clicking on the pill label text won't open the dropdown menu (click input area to open)
 * - Removing pills via the X button still works normally (separate component)
 * - Keyboard navigation still works normally
 *
 * Note on type assertions: react-select's MultiValueGenericProps.innerProps type is
 * { className?: string }, but the underlying div element accepts all standard div props.
 * The type assertion to ComponentPropsWithoutRef<"div"> is necessary to add
 * event handlers that the actual DOM element supports.
 */
const SelectableMultiValueLabel: FC<
  MultiValueGenericProps<SelectOption, true>
> = props => {
  // Cast innerProps to the full div props type since react-select's types are overly restrictive
  // (they only type { className?: string } but the div accepts all standard props)
  const existingInnerProps = props.innerProps as
    | ComponentPropsWithoutRef<"div">
    | undefined

  const enhancedInnerProps: ComponentPropsWithoutRef<"div"> = {
    ...existingInnerProps,
    // Allow text selection by stopping propagation but not preventing default
    onMouseDown: (e: MouseEvent<HTMLDivElement>) => {
      e.stopPropagation() // Prevents react-select from treating it as a control click
      existingInnerProps?.onMouseDown?.(e)
    },
    onTouchEnd: (e: TouchEvent<HTMLDivElement>) => {
      e.stopPropagation()
      existingInnerProps?.onTouchEnd?.(e)
    },
  }

  return (
    <components.MultiValueLabel
      {...props}
      innerProps={enhancedInnerProps as typeof props.innerProps}
    />
  )
}

export type MultiSelectCell = CustomCell<MultiSelectCellProps>

// Module-level components to avoid nested component definitions inside the Editor.
// These are used by react-select's components prop.
const NullDropdownIndicator = (): null => null
const NullIndicatorSeparator = (): null => null

// Reads menuDisabled from selectProps which is passed by react-select.
const StyledMenuWrapper: FC<CustomMenuProps> = props => {
  // Access custom props passed via the Select component
  const menuDisabled = (
    props.selectProps as { menuDisabled?: boolean } | undefined
  )?.menuDisabled
  if (menuDisabled) {
    return null
  }
  return (
    <StyledPortalWrap>
      <CustomMenu
        {...props}
        className={[props.className, "click-outside-ignore"]
          .filter(Boolean)
          .join(" ")}
      />
    </StyledPortalWrap>
  )
}

const Editor: ReturnType<ProvideEditorCallback<MultiSelectCell>> = p => {
  const { value: cell, initialValue, onChange, onFinishedEditing } = p
  const {
    options: optionsIn,
    values: valuesIn,
    allowCreation,
    allowDuplicates,
  } = cell.data

  const theme = useTheme()
  const [value, setValue] = useState(valuesIn)
  const [menuOpen, setMenuOpen] = useState(true)
  const [inputValue, setInputValue] = useState(initialValue ?? "")

  // Use document.getElementById for the portal target.
  // The portalElementRef from glide-data-grid is not used here to avoid
  // accessing refs during render, which violates React best practices.
  // The "portal" element is the standard fallback used by glide-data-grid.
  const [portalTarget] = useState<HTMLElement | null>(() =>
    document.getElementById("portal")
  )

  const options = useMemo(() => {
    return prepareOptions(optionsIn ?? [])
  }, [optionsIn])

  const menuDisabled = allowCreation && allowDuplicates && options.length === 0

  // Prevent the grid from handling the keydown as long as the menu is open:
  // This allows usage of enter without triggering the grid to finish editing.
  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (menuOpen) {
        e.stopPropagation()
      }
    },
    [menuOpen]
  )

  // Menu open/close handlers
  const handleMenuOpen = useCallback(() => setMenuOpen(true), [])
  const handleMenuClose = useCallback(() => setMenuOpen(false), [])

  // No options message handler
  const noOptionsMessage = useCallback(
    (input: { inputValue: string }) => {
      return allowCreation && allowDuplicates && input.inputValue
        ? `Create "${input.inputValue}"`
        : undefined
    },
    [allowCreation, allowDuplicates]
  )

  // Apply styles to the react-select component.
  // All components: https://react-select.com/components
  const colorStyles: StylesConfig<SelectOption, true> = useMemo(
    () => ({
      control: (base, state) => ({
        ...base,
        border: 0,
        boxShadow: "none",
        backgroundColor: theme.bgCell,
        // Allow interaction (e.g. wheel scrolling) even when the select is disabled
        pointerEvents: state.isDisabled ? "auto" : base.pointerEvents,
        cursor: state.isDisabled ? "default" : base.cursor,
      }),
      valueContainer: base => ({
        ...base,
        // Keep default wrapping so multiple chips can move to new lines
        flexWrap: base.flexWrap ?? "wrap",
        overflowX: "auto",
        overflowY: "hidden",
      }),
      menu: styles => ({
        ...styles,
        backgroundColor: theme.bgCell,
      }),
      option: (styles, state) => {
        return {
          ...styles,
          fontSize: theme.editorFontSize,
          fontFamily: theme.fontFamily,
          color: theme.textDark,
          ...(state.isFocused
            ? { backgroundColor: theme.accentLight, cursor: "pointer" }
            : {}),
          ":active": {
            ...styles[":active"],
            color: theme.accentFg,
            backgroundColor: theme.accentColor,
          },
        }
      },
      input: (styles, { isDisabled }) => {
        if (isDisabled) {
          return {
            display: "none",
          }
        }
        return {
          ...styles,
          fontSize: theme.editorFontSize,
          fontFamily: theme.fontFamily,
          color: theme.textDark,
        }
      },
      placeholder: styles => {
        return {
          ...styles,
          fontSize: theme.editorFontSize,
          fontFamily: theme.fontFamily,
          color: theme.textLight,
        }
      },
      noOptionsMessage: styles => {
        return {
          ...styles,
          fontSize: theme.editorFontSize,
          fontFamily: theme.fontFamily,
          color: theme.textLight,
        }
      },
      clearIndicator: styles => {
        return {
          ...styles,
          color: theme.textLight,
          ":hover": {
            color: theme.textDark,
            cursor: "pointer",
          },
        }
      },
      multiValue: (styles, { data }) => {
        return {
          ...styles,
          backgroundColor: data.color ?? theme.bgBubble,
          borderRadius: `${theme.roundingRadius ?? theme.bubbleHeight / 2}px`,
          flexShrink: 0,
          whiteSpace: "nowrap",
        }
      },
      multiValueLabel: (styles, { data, isDisabled }) => {
        return {
          ...styles,
          paddingRight: isDisabled ? theme.bubblePadding : 0,
          paddingLeft: theme.bubblePadding,
          paddingTop: 0,
          paddingBottom: 0,
          color: data.color
            ? // If a color is set for this option,
              // we use it to determine the text color.
              getLuminance(data.color) > 0.5
              ? "black"
              : "white"
            : theme.textBubble,
          fontSize: theme.editorFontSize,
          fontFamily: theme.fontFamily,
          justifyContent: "center",
          alignItems: "center",
          display: "flex",
          height: theme.bubbleHeight,
          whiteSpace: "nowrap",
        }
      },
      multiValueRemove: (styles, { data, isDisabled, isFocused }) => {
        if (isDisabled) {
          return {
            display: "none",
          }
        }
        return {
          ...styles,
          color: data.color
            ? // If a color is set for this option,
              // we use it to determine the text color.
              getLuminance(data.color) > 0.5
              ? "black"
              : "white"
            : theme.textBubble,
          backgroundColor: undefined,
          borderRadius: isFocused
            ? `${theme.roundingRadius ?? theme.bubbleHeight / 2}px`
            : undefined,
          ":hover": {
            cursor: "pointer",
          },
        }
      },
    }),
    [theme]
  )

  // This is used to submit the values to the grid.
  const submitValues = useCallback(
    (values: string[]) => {
      // Change the list of values to the actual values by removing the prefix.
      // This is only relevant in the case of allowDuplicates being true.
      const mappedValues = values.map(v => {
        return allowDuplicates && v.startsWith(VALUE_PREFIX)
          ? v.replace(new RegExp(VALUE_PREFIX_REGEX), "")
          : v
      })
      setValue(mappedValues)
      onChange({
        ...cell,
        data: {
          ...cell.data,
          values: mappedValues,
        },
      })
    },
    [cell, onChange, allowDuplicates]
  )

  const handleKeyDown: KeyboardEventHandler = event => {
    switch (event.key) {
      case "Enter":
      case "Tab":
        if (!inputValue) {
          // If the user pressed enter or tab without entering anything,
          // we finish editing based on the current state.
          onFinishedEditing(cell, [0, 1])
          return
        }

        if (allowDuplicates && allowCreation) {
          // This is a workaround to allow the user to enter new values
          // multiple times.
          setInputValue("")
          submitValues([...(value ?? []), inputValue])
          setMenuOpen(false)
          event.preventDefault()
        }
    }
  }

  // Memoized components object for react-select
  // Uses module-level components to avoid nested component definitions
  const selectComponents = useMemo(
    () => ({
      DropdownIndicator: NullDropdownIndicator,
      IndicatorSeparator: NullIndicatorSeparator,
      MultiValueLabel: SelectableMultiValueLabel,
      Menu: StyledMenuWrapper,
    }),
    []
  )

  // onChange handler for react-select
  const handleChange = useCallback(
    (e: readonly SelectOption[] | null) => {
      if (e === null || !Array.isArray(e)) {
        return
      }
      submitValues(e.map((x: SelectOption) => x.value))
    },
    [submitValues]
  )

  const SelectComponent = allowCreation ? CreatableSelect : Select
  return (
    <StyledWrap onKeyDown={onKeyDown} data-testid={"multi-select-cell"}>
      <SelectComponent
        className="gdg-multi-select"
        isMulti={true}
        isDisabled={cell.readonly}
        isClearable={true}
        isSearchable={true}
        inputValue={inputValue}
        onInputChange={setInputValue}
        options={options}
        placeholder={cell.readonly ? "" : allowCreation ? "Add..." : undefined}
        noOptionsMessage={noOptionsMessage}
        menuIsOpen={cell.readonly ? false : menuOpen}
        onMenuOpen={handleMenuOpen}
        onMenuClose={handleMenuClose}
        value={resolveValues(value, options, allowDuplicates)}
        onKeyDown={cell.readonly ? undefined : handleKeyDown}
        menuPlacement={"auto"}
        menuPortalTarget={portalTarget}
        autoFocus={true}
        openMenuOnFocus={true}
        openMenuOnClick={true}
        closeMenuOnSelect={true}
        backspaceRemovesValue={true}
        escapeClearsValue={false}
        styles={colorStyles}
        components={selectComponents}
        onChange={handleChange}
        // Custom prop for StyledMenuWrapper to read via selectProps
        {...({ menuDisabled } as Record<string, unknown>)}
      />
    </StyledWrap>
  )
}

const renderer: CustomRenderer<MultiSelectCell> = {
  kind: GridCellKind.Custom,

  isMatch: (c): c is MultiSelectCell =>
    (c.data as { kind?: string }).kind === "multi-select-cell",
  draw: (args, cell) => {
    const { ctx, theme, rect, highlighted } = args
    const { values, options: optionsIn } = cell.data

    if (isNullOrUndefined(values)) {
      return true
    }

    const options = prepareOptions(optionsIn ?? [])

    const drawArea: Rectangle = {
      x: rect.x + theme.cellHorizontalPadding,
      y: rect.y + theme.cellVerticalPadding,
      width: rect.width - 2 * theme.cellHorizontalPadding,
      height: rect.height - 2 * theme.cellVerticalPadding,
    }
    const rows = Math.max(
      1,
      Math.floor(drawArea.height / (theme.bubbleHeight + theme.bubblePadding))
    )

    let { x } = drawArea
    let row = 1

    let y =
      rows === 1
        ? drawArea.y + (drawArea.height - theme.bubbleHeight) / 2
        : drawArea.y +
          (drawArea.height -
            rows * theme.bubbleHeight -
            (rows - 1) * theme.bubblePadding) /
            2
    for (const value of values) {
      const matchedOption = options.find(t => t.value === value)
      const color =
        matchedOption?.color ??
        (highlighted ? theme.bgBubbleSelected : theme.bgBubble)
      const displayText = matchedOption?.label ?? value
      const metrics = measureTextCached(displayText, ctx)
      const width = metrics.width + theme.bubblePadding * 2
      const textY = theme.bubbleHeight / 2

      if (
        x !== drawArea.x &&
        x + width > drawArea.x + drawArea.width &&
        row < rows
      ) {
        row++
        y += theme.bubbleHeight + theme.bubblePadding
        x = drawArea.x
      }

      ctx.fillStyle = color
      ctx.beginPath()
      roundedRect(
        ctx,
        x,
        y,
        width,
        theme.bubbleHeight,
        theme.roundingRadius ?? theme.bubbleHeight / 2
      )
      ctx.fill()

      // If a color is set for this option, we use either black or white as the text color depending on the background.
      // Otherwise, use the configured textBubble color.
      ctx.fillStyle = matchedOption?.color
        ? getLuminance(color) > 0.5
          ? "#000000"
          : "#ffffff"
        : theme.textBubble
      ctx.fillText(
        displayText,
        x + theme.bubblePadding,
        y + textY + getMiddleCenterBias(ctx, theme)
      )

      x += width + theme.bubbleMargin
      if (
        x > drawArea.x + drawArea.width + theme.cellHorizontalPadding &&
        row >= rows
      ) {
        break
      }
    }

    return true
  },
  measure: (ctx, cell, theme) => {
    const { values, options } = cell.data

    if (!values) {
      return theme.cellHorizontalPadding * 2
    }

    // Resolve the values to the actual display labels:
    const labels = resolveValues(
      values,
      prepareOptions(options ?? []),
      cell.data.allowDuplicates
    ).map(x => x.label ?? x.value)

    const bubblesWidth = labels.reduce(
      (acc, data) =>
        ctx.measureText(data).width +
        acc +
        theme.bubblePadding * 2 +
        theme.bubbleMargin,
      0
    )

    if (labels.length === 0) {
      return theme.cellHorizontalPadding * 2
    }

    return bubblesWidth + 2 * theme.cellHorizontalPadding - theme.bubbleMargin
  },
  provideEditor: () => ({
    editor: Editor,
    disablePadding: true,
    deletedValue: v => ({
      ...v,
      copyData: "",
      data: {
        ...v.data,
        values: [],
      },
    }),
  }),
  onPaste: (val: string, cell: MultiSelectCellProps) => {
    if (!val?.trim()) {
      // Empty values should result in empty strings
      return {
        ...cell,
        values: [],
      }
    }
    let values = val.split(",").map(s => s.trim())

    if (!cell.allowDuplicates) {
      // Remove all duplicates
      values = values.filter((v, index) => values.indexOf(v) === index)
    }

    if (!cell.allowCreation) {
      // Only allow values that are part of the options:
      const options = prepareOptions(cell.options ?? [])
      values = values.filter(v => options.find(o => o.value === v))
    }

    if (values.length === 0) {
      // We were not able to parse any values, return undefined to
      // not change the cell value.
      return undefined
    }
    return {
      ...cell,
      values,
    }
  },
}

export default renderer
