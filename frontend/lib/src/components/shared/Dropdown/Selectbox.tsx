/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import React, {
  memo,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"

import { ChevronDown } from "baseui/icon"
import {
  type OnChangeParams,
  type Option,
  Select as UISelect,
} from "baseui/select"
import sortBy from "lodash/sortBy"

import IsSidebarContext from "~lib/components/core/IsSidebarContext"
import VirtualDropdown from "~lib/components/shared/Dropdown/VirtualDropdown"
import { Placement } from "~lib/components/shared/Tooltip"
import TooltipIcon from "~lib/components/shared/TooltipIcon"
import {
  StyledWidgetLabelHelp,
  WidgetLabel,
} from "~lib/components/widgets/BaseWidget"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { isMobile } from "~lib/util/isMobile"
import {
  getSelectPlaceholder,
  isNullOrUndefined,
  LabelVisibilityOptions,
} from "~lib/util/utils"
import { hasMatch, score } from "~lib/vendor/fzy.js/fuzzySearch"

export interface Props {
  value: string | null
  onChange: (value: string | null) => void
  disabled: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  options: any[]
  label?: string | null
  labelVisibility?: LabelVisibilityOptions
  help?: string
  placeholder: string
  clearable?: boolean
  acceptNewOptions: boolean
}

interface SelectOption {
  label: string
  value: string
}

// Add a custom filterOptions method to filter options only based on labels.
// The baseweb default method filters based on labels or indices
// More details: https://github.com/streamlit/streamlit/issues/1010
// Also filters using fuzzy search.
export function fuzzyFilterSelectOptions(
  options: SelectOption[],
  pattern: string
): readonly SelectOption[] {
  if (!pattern) {
    return options
  }

  const filteredOptions = options.filter((opt: SelectOption) =>
    hasMatch(pattern, opt.label)
  )
  return sortBy(
    filteredOptions,
    // Use the negative score to sort the list in a stable manner
    // This ensures highest score is first
    (opt: SelectOption) => -score(pattern, opt.label, true)
  )
}

const Selectbox: React.FC<Props> = ({
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
}) => {
  const theme = useEmotionTheme()
  const isInSidebar = useContext(IsSidebarContext)

  const [value, setValue] = useState<string | null>(propValue)
  // This ref is used to store the value before the user starts removing characters so that we can restore
  // the value in case the user dismisses the changes by clicking away.
  const valueBeforeRemoval = useRef<string | null>(value)

  // Update the value whenever the value provided by the props changes
  // TODO: Find a better way to handle this to prevent unneeded re-renders
  useEffect(() => {
    setValue(propValue)
  }, [propValue])

  const handleChange = useCallback(
    (params: OnChangeParams): void => {
      if (params.type === "remove") {
        valueBeforeRemoval.current = params.option?.value
        // We set the value so that BaseWeb updates the element's value while typing.
        // We don't want to commit the change yet, so we don't call onChange.
        setValue(null)
        return
      }

      valueBeforeRemoval.current = null

      if (params.type === "clear") {
        setValue(null)
        onChange(null)
        return
      }

      const [selected] = params.value
      setValue(selected.value)
      onChange(selected.value)
    },
    [onChange]
  )

  const handleBlur = useCallback(() => {
    if (valueBeforeRemoval.current !== null) {
      setValue(valueBeforeRemoval.current)
    }
  }, [])

  const filterOptions = useCallback(
    (options: readonly Option[], filterValue: string): readonly Option[] =>
      fuzzyFilterSelectOptions(options as SelectOption[], filterValue),
    []
  )

  const opts = propOptions

  let selectValue: Option[] = []
  if (!isNullOrUndefined(value)) {
    selectValue = [{ label: value, value }]
  }

  // Get placeholder and disabled state using utility function
  const { placeholder: selectboxPlaceholder, shouldDisable } =
    getSelectPlaceholder(
      placeholder,
      opts,
      acceptNewOptions,
      false // isMultiSelect = false for single select
    )

  const selectDisabled = disabled || shouldDisable

  const selectOptions: SelectOption[] = opts.map(
    (option: string, index: number) => ({
      label: option,
      value: option,
      // We are using an id because if multiple options are equal,
      // we have observed weird UI glitches
      id: `${option}_${index}`,
    })
  )

  // Check if we have more than 10 options in the selectbox.
  // If that's true, we show the keyboard on mobile. If not, we hide it.
  const showKeyboardOnMobile = opts.length > 10

  return (
    <div className="stSelectbox" data-testid="stSelectbox">
      <WidgetLabel
        label={label}
        labelVisibility={labelVisibility}
        disabled={selectDisabled}
      >
        {help && (
          <StyledWidgetLabelHelp>
            <TooltipIcon content={help} placement={Placement.TOP_RIGHT} />
          </StyledWidgetLabelHelp>
        )}
      </WidgetLabel>
      <UISelect
        creatable={acceptNewOptions}
        disabled={selectDisabled}
        labelKey="label"
        aria-label={label || ""}
        onChange={handleChange}
        onBlur={handleBlur}
        options={selectOptions}
        filterOptions={filterOptions}
        clearable={clearable || false}
        escapeClearsValue={clearable || false}
        value={selectValue}
        valueKey="value"
        placeholder={selectboxPlaceholder}
        ignoreCase={false}
        overrides={{
          Root: {
            style: () => ({
              lineHeight: theme.lineHeights.inputWidget,
              fontWeight: theme.fontWeights.normal,
            }),
          },
          Dropdown: { component: VirtualDropdown },
          ClearIcon: {
            props: {
              overrides: {
                Svg: {
                  style: {
                    color: theme.colors.darkGray,
                    // Setting this width and height makes the clear-icon align with dropdown arrows
                    padding: theme.spacing.threeXS,
                    height: theme.sizes.clearIconSize,
                    width: theme.sizes.clearIconSize,
                    ":hover": {
                      fill: theme.colors.bodyText,
                    },
                  },
                },
              },
            },
          },
          ControlContainer: {
            style: () => ({
              height: theme.sizes.minElementHeight,
              // Baseweb requires long-hand props, short-hand leads to weird bugs & warnings.
              borderLeftWidth: theme.sizes.borderWidth,
              borderRightWidth: theme.sizes.borderWidth,
              borderTopWidth: theme.sizes.borderWidth,
              borderBottomWidth: theme.sizes.borderWidth,
            }),
          },
          IconsContainer: {
            style: () => ({
              paddingRight: theme.spacing.sm,
            }),
          },
          Placeholder: {
            style: () => ({
              color: selectDisabled
                ? theme.colors.fadedText40
                : theme.colors.fadedText60,
            }),
          },
          ValueContainer: {
            style: () => ({
              // Baseweb requires long-hand props, short-hand leads to weird bugs & warnings.
              paddingRight: theme.spacing.sm,
              paddingLeft: theme.spacing.md,
              paddingBottom: theme.spacing.sm,
              paddingTop: theme.spacing.sm,
            }),
          },
          Input: {
            props: {
              // When on mobile, if there are less than 10 options and new
              // options are not accepted, set the input to read-only to hide
              // the mobile keyboard.
              readOnly:
                isMobile() && !showKeyboardOnMobile && !acceptNewOptions
                  ? "readonly"
                  : null,
            },
            style: () => ({
              lineHeight: theme.lineHeights.inputWidget,
            }),
          },
          // Nudge the dropdown menu by 1px so the focus state doesn't get cut off
          Popover: {
            props: {
              ignoreBoundary: isInSidebar,
              overrides: {
                Body: {
                  style: () => ({
                    marginTop: theme.spacing.px,
                  }),
                },
              },
            },
          },
          SingleValue: {
            style: () => ({
              // remove margin from select value so that there is no jumpb, e.g. when pressing backspace on a selected option and removing a character.
              marginLeft: theme.spacing.none,
            }),
          },
          SelectArrow: {
            component: ChevronDown,
            props: {
              style: {
                cursor: "pointer",
              },
              overrides: {
                Svg: {
                  style: () => ({
                    width: theme.iconSizes.xl,
                    height: theme.iconSizes.xl,
                  }),
                },
              },
            },
          },
        }}
      />
    </div>
  )
}

export default memo(Selectbox)
