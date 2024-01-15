/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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
import * as React from "react"

import {
  type CustomCell,
  type ProvideEditorCallback,
  type CustomRenderer,
  type Rectangle,
  measureTextCached,
  getMiddleCenterBias,
  useTheme,
  GridCellKind,
  roundedRect,
} from "@glideapps/glide-data-grid"

import styled from "@emotion/styled"
import chroma from "chroma-js"
import Select, {
  type MenuProps,
  components,
  type StylesConfig,
} from "react-select"
import CreatableSelect from "react-select/creatable"

type SelectOption = { value: string; label?: string; color?: string }

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

const BUBBLE_HEIGHT = 20
const BUBBLE_PADDING = 6
const BUBBLE_MARGIN = 4
/* This prefix is used when allowDuplicates is enabled to make sure that
all underlying values are unique. */
const VALUE_PREFIX = "__value"
const VALUE_PREFIX_REGEX = new RegExp(`^${VALUE_PREFIX}\\d+__`)

const Wrap = styled.div`
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

const PortalWrap = styled.div`
  font-family: var(--gdg-font-family);
  font-size: var(--gdg-editor-font-size);
  color: var(--gdg-text-dark);

  > div {
    border-radius: 4px;
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
    if (
      typeof option === "string" ||
      option === null ||
      option === undefined
    ) {
      return { value: option, label: option ?? "", color: undefined }
    }

    return {
      value: option.value,
      label: option.label ?? option.value ?? "",
      color: option.color ?? undefined,
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
  if (values === undefined || values === null) {
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

interface CustomMenuProps extends MenuProps<any> {}

const CustomMenu: React.FC<CustomMenuProps> = p => {
  const { Menu } = components
  const { children, ...rest } = p
  return <Menu {...rest}>{children}</Menu>
}

export type MultiSelectCell = CustomCell<MultiSelectCellProps>

const Editor: ReturnType<ProvideEditorCallback<MultiSelectCell>> = p => {
  const { value: cell, initialValue, onChange, onFinishedEditing } = p
  const {
    options: optionsIn,
    values: valuesIn,
    allowCreation,
    allowDuplicates,
  } = cell.data

  const theme = useTheme()
  const [value, setValue] = React.useState(valuesIn)
  const [menuOpen, setMenuOpen] = React.useState(true)
  const [inputValue, setInputValue] = React.useState(initialValue ?? "")

  const options = React.useMemo(() => {
    return prepareOptions(optionsIn ?? [])
  }, [optionsIn])

  const menuDisabled = allowCreation && allowDuplicates && options.length === 0

  // Prevent the grid from handling the keydown as long as the menu is open:
  // This allows usage of enter without triggering the grid to finish editing.
  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (menuOpen) {
        e.stopPropagation()
      }
    },
    [menuOpen]
  )

  // Apply styles to the react-select component.
  // All components: https://react-select.com/components
  const colorStyles: StylesConfig<SelectOption, true> = {
    control: base => ({
      ...base,
      border: 0,
      boxShadow: "none",
      backgroundColor: theme.bgCell,
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
      const color = chroma(data.color ?? theme.bgBubble)
      return {
        ...styles,
        backgroundColor: color.css(),
        borderRadius: `${theme.roundingRadius ?? BUBBLE_HEIGHT / 2}px`,
      }
    },
    multiValueLabel: (styles, { data, isDisabled }) => {
      const color = chroma(data.color ?? theme.bgBubble)
      return {
        ...styles,
        paddingRight: isDisabled ? BUBBLE_PADDING : undefined,
        paddingLeft: BUBBLE_PADDING,
        paddingTop: 0,
        paddingBottom: 0,
        color: color.luminance() > 0.5 ? "black" : "white",
        fontSize: theme.editorFontSize,
        fontFamily: theme.fontFamily,
        justifyContent: "center",
        alignItems: "center",
        display: "flex",
        height: BUBBLE_HEIGHT,
      }
    },
    multiValueRemove: (styles, { data, isDisabled, isFocused }) => {
      if (isDisabled) {
        return {
          display: "none",
        }
      }
      const color = chroma(data.color ?? theme.bgBubble)
      return {
        ...styles,
        color: color.luminance() > 0.5 ? "black" : "white",
        backgroundColor: isFocused
          ? color.luminance() > 0.5
            ? color.darken(0.5).css()
            : color.brighten(0.5).css()
          : undefined,
        borderRadius: isFocused
          ? `${theme.roundingRadius ?? BUBBLE_HEIGHT / 2}px`
          : undefined,
        ":hover": {
          cursor: "pointer",
        },
      }
    },
  }

  // This is used to submit the values to the grid.
  const submitValues = React.useCallback(
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

  const handleKeyDown: React.KeyboardEventHandler = event => {
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

  const SelectComponent = allowCreation ? CreatableSelect : Select
  return (
    <Wrap onKeyDown={onKeyDown} data-testid={"multi-select-cell"}>
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
        noOptionsMessage={input => {
          return allowCreation && allowDuplicates && input.inputValue
            ? `Create "${input.inputValue}"`
            : undefined
        }}
        menuIsOpen={cell.readonly ? false : menuOpen}
        onMenuOpen={() => setMenuOpen(true)}
        onMenuClose={() => setMenuOpen(false)}
        value={resolveValues(value, options, allowDuplicates)}
        onKeyDown={cell.readonly ? undefined : handleKeyDown}
        menuPlacement={"auto"}
        menuPortalTarget={document.getElementById("portal")}
        autoFocus={true}
        openMenuOnFocus={true}
        openMenuOnClick={true}
        closeMenuOnSelect={true}
        backspaceRemovesValue={true}
        escapeClearsValue={false}
        styles={colorStyles}
        components={{
          DropdownIndicator: () => null,
          IndicatorSeparator: () => null,
          Menu: props => {
            if (menuDisabled) {
              return null
            }
            return (
              <PortalWrap>
                <CustomMenu className={"click-outside-ignore"} {...props} />
              </PortalWrap>
            )
          },
        }}
        onChange={async e => {
          if (e === null) {
            return
          }
          submitValues(e.map(x => x.value))
        }}
      />
    </Wrap>
  )
}

const renderer: CustomRenderer<MultiSelectCell> = {
  kind: GridCellKind.Custom,
  isMatch: (c): c is MultiSelectCell =>
    (c.data as any).kind === "multi-select-cell",
  draw: (args, cell) => {
    const { ctx, theme, rect, highlighted } = args
    const { values, options: optionsIn } = cell.data

    if (values === undefined || values === null) {
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
      Math.floor(drawArea.height / (BUBBLE_HEIGHT + BUBBLE_PADDING))
    )

    let { x } = drawArea
    let row = 1

    let y =
      rows === 1
        ? drawArea.y + (drawArea.height - BUBBLE_HEIGHT) / 2
        : drawArea.y +
          (drawArea.height -
            rows * BUBBLE_HEIGHT -
            (rows - 1) * BUBBLE_PADDING) /
            2
    for (const value of values) {
      const matchedOption = options.find(t => t.value === value)
      const color = chroma(
        matchedOption?.color ??
          (highlighted ? theme.bgBubbleSelected : theme.bgBubble)
      )
      const displayText = matchedOption?.label ?? value
      const metrics = measureTextCached(displayText, ctx)
      const width = metrics.width + BUBBLE_PADDING * 2
      const textY = BUBBLE_HEIGHT / 2

      if (
        x !== drawArea.x &&
        x + width > drawArea.x + drawArea.width &&
        row < rows
      ) {
        row++
        y += BUBBLE_HEIGHT + BUBBLE_PADDING
        x = drawArea.x
      }

      ctx.fillStyle = color.hex()
      ctx.beginPath()
      roundedRect(
        ctx,
        x,
        y,
        width,
        BUBBLE_HEIGHT,
        theme.roundingRadius ?? BUBBLE_HEIGHT / 2
      )
      ctx.fill()

      ctx.fillStyle = color.luminance() > 0.5 ? "#000000" : "#ffffff"
      ctx.fillText(
        displayText,
        x + BUBBLE_PADDING,
        y + textY + getMiddleCenterBias(ctx, theme)
      )

      x += width + BUBBLE_MARGIN
      if (
        x > drawArea.x + drawArea.width + theme.cellHorizontalPadding &&
        row >= rows
      ) {
        break
      }
    }

    return true
  },
  measure: (ctx, cell, t) => {
    const { values, options } = cell.data

    if (!values) {
      return t.cellHorizontalPadding * 2
    }

    // Resolve the values to the actual display labels:
    const labels = resolveValues(
      values,
      prepareOptions(options ?? []),
      cell.data.allowDuplicates
    ).map(x => x.label ?? x.value)

    return (
      labels.reduce(
        (acc, data) =>
          ctx.measureText(data).width +
          acc +
          BUBBLE_PADDING * 2 +
          BUBBLE_MARGIN,
        0
      ) +
      2 * t.cellHorizontalPadding -
      4
    )
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
    if (!val || !val.trim()) {
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
