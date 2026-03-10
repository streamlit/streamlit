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
  memo,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react"

import { ChevronDown } from "baseui/icon"
import { type OnChangeParams, Select as UISelect } from "baseui/select"

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  options: any[]
  label?: string | null
  labelVisibility?: LabelVisibilityOptions
  help?: string
  placeholder: string
  clearable?: boolean
  acceptNewOptions: boolean
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
}) => {
  const theme = useEmotionTheme()
  const isInSidebar = useContext(IsSidebarContext)

  const [value, setValue] = useState<string | null>(propValue)
  // This ref is used to store the value before the user starts removing characters so that we can restore
  // the value in case the user dismisses the changes by clicking away.
  const valueBeforeRemovalRef = useRef<string | null>(value)

  useExecuteWhenChanged(() => {
    setValue(propValue)
    // Reset the ref when propValue changes externally (e.g., via session state)
    // to prevent handleBlur from restoring a stale value.
    valueBeforeRemovalRef.current = null
  }, [propValue])

  const handleChange = useCallback(
    (params: OnChangeParams): void => {
      if (params.type === "remove") {
        valueBeforeRemovalRef.current = params.option?.value
        // We set the value so that BaseWeb updates the element's value while typing.
        // We don't want to commit the change yet, so we don't call onChange.
        setValue(null)
        return
      }

      valueBeforeRemovalRef.current = null

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
    if (valueBeforeRemovalRef.current !== null) {
      setValue(valueBeforeRemovalRef.current)
    }
  }, [])

  const opts = propOptions

  const {
    placeholder: selectboxPlaceholder,
    disabled: shouldDisable,
    selectOptions,
    inputReadOnly,
    valueToUiSingle,
    createFilterOptions,
  } = useSelectCommon({
    options: opts as string[],
    isMulti: false,
    acceptNewOptions,
    placeholderInput: placeholder,
  })

  const selectDisabled = disabled || shouldDisable

  const filterOptions = useMemo(
    () => createFilterOptions(),
    [createFilterOptions]
  )

  const selectValue = valueToUiSingle(value)

  return (
    <div className="stSelectbox" data-testid="stSelectbox">
      <WidgetLabel
        label={label}
        labelVisibility={labelVisibility}
        disabled={selectDisabled}
      >
        {help && <WidgetLabelHelpIcon content={help} label={label} />}
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
          Dropdown: {
            component: VirtualDropdown,
            style: { boxShadow: "none", overflow: "hidden" },
          },
          ClearIcon: {
            props: {
              overrides: {
                Svg: {
                  style: {
                    color: theme.colors.grayTextColor,
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
            style: ({ $isFocused }: { $isFocused: boolean }) => {
              const borderColor = getBorderColor(theme.colors, $isFocused)
              return {
                height: theme.sizes.minElementHeight,
                // Baseweb requires long-hand props, short-hand leads to weird bugs & warnings.
                borderLeftWidth: theme.sizes.borderWidth,
                borderRightWidth: theme.sizes.borderWidth,
                borderTopWidth: theme.sizes.borderWidth,
                borderBottomWidth: theme.sizes.borderWidth,

                borderTopColor: borderColor,
                borderRightColor: borderColor,
                borderBottomColor: borderColor,
                borderLeftColor: borderColor,
              }
            },
          },
          IconsContainer: {
            style: () => ({
              paddingRight: theme.spacing.sm,
            }),
          },
          ValueContainer: {
            style: () => ({
              // Take up as much width as possible
              flexGrow: 1,
              paddingRight: theme.spacing.sm,
              paddingLeft: theme.spacing.sm,
              paddingBottom: theme.spacing.sm,
              paddingTop: theme.spacing.sm,
              marginLeft: theme.sizes.tagMarginInsideBorder,
            }),
          },
          Placeholder: {
            style: () => ({
              color: selectDisabled
                ? theme.colors.fadedText40
                : theme.colors.fadedText60,
              // Position absolute so Input can overlay it
              position: "absolute",
              // Allow clicks to pass through to input
              pointerEvents: "none",
            }),
          },
          InputContainer: {
            style: () => ({
              marginLeft: theme.spacing.none,
              // Position relative so InputContainer stacks above the absolutely positioned Placeholder
              position: "relative",
              minWidth: theme.spacing.threeXS,
              flexGrow: 0,
            }),
          },
          Input: {
            props: {
              readOnly: inputReadOnly,
            },
            style: () => ({
              lineHeight: theme.lineHeights.inputWidget,
              color: theme.colors.bodyText,
              caretColor: theme.colors.bodyText,
            }),
          },
          DropdownContainer: {
            style: () => ({
              ...getPopoverContainerStyle(theme),

              // Height constraint - VirtualDropdown handles scrolling internally
              maxHeight: `min(${theme.sizes.maxDropdownHeight}, 70vh)`,
              overflow: "hidden",
            }),
          },
          Popover: {
            props: {
              ignoreBoundary: isInSidebar,
              popoverMargin: convertRemToPx(theme.spacing.twoXS),
              overrides: {
                Body: {
                  style: () => ({
                    // Scrolling is handled by the VirtualDropdown component
                    overflow: "hidden",
                  }),
                },
              },
            },
          },

          SingleValue: {
            style: () => ({
              marginLeft: theme.spacing.none,
            }),
          },
          SelectArrow: {
            component: ChevronDown,
            props: {
              style: {
                ...(selectDisabled && {
                  cursor: "not-allowed",
                }),
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
