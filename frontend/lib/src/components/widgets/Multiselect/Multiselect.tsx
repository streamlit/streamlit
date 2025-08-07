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

import React, { FC, memo, useCallback, useContext, useMemo } from "react"

import { ChevronDown } from "baseui/icon"
import {
  type OnChangeParams,
  type Option,
  TYPE,
  Select as UISelect,
} from "baseui/select"
import without from "lodash/without"

import { MultiSelect as MultiSelectProto } from "@streamlit/protobuf"

import IsSidebarContext from "~lib/components/core/IsSidebarContext"
import { VirtualDropdown } from "~lib/components/shared/Dropdown"
import { fuzzyFilterSelectOptions } from "~lib/components/shared/Dropdown/Selectbox"
import { Placement } from "~lib/components/shared/Tooltip"
import TooltipIcon from "~lib/components/shared/TooltipIcon"
import {
  StyledWidgetLabelHelp,
  WidgetLabel,
} from "~lib/components/widgets/BaseWidget"
import { StyledUISelect } from "~lib/components/widgets/Multiselect/styled-components"
import {
  useBasicWidgetState,
  ValueWithSource,
} from "~lib/hooks/useBasicWidgetState"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { isMobile } from "~lib/util/isMobile"
import {
  getSelectPlaceholder,
  labelVisibilityProtoValueToEnum,
} from "~lib/util/utils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

export interface Props {
  disabled: boolean
  element: MultiSelectProto
  widgetMgr: WidgetStateManager
  fragmentId?: string
}

type MultiselectValue = string[]

interface MultiselectOption {
  label: string
  value: string
}

const getStateFromWidgetMgr = (
  widgetMgr: WidgetStateManager,
  element: MultiSelectProto
): MultiselectValue | undefined => {
  return widgetMgr.getStringArrayValue(element)
}

const getDefaultStateFromProto = (
  element: MultiSelectProto
): MultiselectValue => {
  return element.default.map(i => element.options[i]) ?? null
}

const getCurrStateFromProto = (
  element: MultiSelectProto
): MultiselectValue => {
  return element.rawValues ?? null
}

const updateWidgetMgrState = (
  element: MultiSelectProto,
  widgetMgr: WidgetStateManager,
  valueWithSource: ValueWithSource<MultiselectValue>,
  fragmentId?: string
): void => {
  widgetMgr.setStringArrayValue(
    element,
    valueWithSource.value,
    { fromUi: valueWithSource.fromUi },
    fragmentId
  )
}

const Multiselect: FC<Props> = props => {
  const { element, widgetMgr, fragmentId } = props

  const theme = useEmotionTheme()
  const isInSidebar = useContext(IsSidebarContext)
  const [value, setValueWithSource] = useBasicWidgetState<
    MultiselectValue,
    MultiSelectProto
  >({
    getStateFromWidgetMgr,
    getDefaultStateFromProto,
    getCurrStateFromProto,
    updateWidgetMgrState,
    element,
    widgetMgr,
    fragmentId,
  })

  const overMaxSelections =
    element.maxSelections > 0 && value.length >= element.maxSelections

  const getNoResultsMsg = useMemo(() => {
    if (element.maxSelections === 0) {
      return "No results"
    } else if (value.length === element.maxSelections) {
      const option = element.maxSelections !== 1 ? "options" : "option"
      return `You can only select up to ${element.maxSelections} ${option}. Remove an option first.`
    }
    return "No results"
  }, [element.maxSelections, value.length])

  const valueFromState = useMemo(() => {
    return value.map(option => {
      return { value: option, label: option }
    })
  }, [value])

  const generateNewState = useCallback(
    (data: OnChangeParams): MultiselectValue => {
      switch (data.type) {
        case "remove": {
          return without(value, data.option?.value)
        }
        case "clear": {
          return []
        }
        case "select": {
          return value.concat([data.option?.value])
        }
        default: {
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          throw new Error(`State transition is unknown: ${data.type}`)
        }
      }
    },
    [value]
  )

  /**
   * This is the onChange handler for the baseweb Select component.
   * It is called whenever the user selects an option or removes an option.
   * When the user starts to modify an option by typing in the input field and
   * pressing backspace, a single `type="remove"` event is fired with the value set
   * to the option that is being removed. The same type of event is fired when the
   * user removes an option by clicking the X icon.
   *
   * If we wanted to prevent an immediate rerun when starting to delete characters,
   * we would need to introduce two new states, e.g. `localValue` and `aboutToDelete`,
   * and commit that state to the backend upon an onBlur event.
   * To keep it simple, we just accept the rerun happening for now.
   */
  const onChange = useCallback(
    (params: OnChangeParams) => {
      if (
        element.maxSelections &&
        params.type === "select" &&
        value.length >= element.maxSelections
      ) {
        return
      }
      setValueWithSource({
        value: generateNewState(params),
        fromUi: true,
      })
    },
    [element.maxSelections, generateNewState, setValueWithSource, value.length]
  )

  const filterOptions = useCallback(
    (options: readonly Option[], filterValue: string): readonly Option[] => {
      if (overMaxSelections) {
        return []
      }
      // We need to manually filter for previously selected options here
      const unselectedOptions = options.filter(
        option => !value.includes(option.value)
      )

      return fuzzyFilterSelectOptions(
        unselectedOptions as MultiselectOption[],
        filterValue
      )
    },
    [overMaxSelections, value]
  )

  const { options } = element

  // Get placeholder and disabled state using utility function
  const { placeholder, shouldDisable } = getSelectPlaceholder(
    element.placeholder,
    options,
    element.acceptNewOptions ?? false,
    true // isMultiSelect = true for multi-select
  )

  const disabled = props.disabled || shouldDisable
  const selectOptions: MultiselectOption[] = options.map(
    (option: string, index: number) => {
      return {
        label: option,
        value: option,
        // We are using an id because if multiple options are equal,
        // we have observed weird UI glitches
        id: `${option}_${index}`,
      }
    }
  )

  // Check if we have more than 10 options in the selectbox.
  // If that's true, we show the keyboard on mobile. If not, we hide it.
  const showKeyboardOnMobile = options.length > 10

  // Calculate the max height of the selectbox based on the baseFontSize
  // to better support advanced theming
  const maxHeight = useMemo(() => {
    // Option height = lineHeight (1.6 * baseFontSize) + margin/padding (14px total)
    const optionHeight = theme.fontSizes.baseFontSize * 1.6 + 14
    // Allow up to 4 options tall before scrolling + show small portion
    // of the next row so its clear the user can scroll
    const pxMaxHeight = Math.round(optionHeight * 4.25)
    // Return value in px
    return `${pxMaxHeight}px`
  }, [theme.fontSizes.baseFontSize])

  return (
    <div className="stMultiSelect" data-testid="stMultiSelect">
      <WidgetLabel
        label={element.label}
        disabled={disabled}
        labelVisibility={labelVisibilityProtoValueToEnum(
          element.labelVisibility?.value
        )}
      >
        {element.help && (
          <StyledWidgetLabelHelp>
            <TooltipIcon
              content={element.help}
              placement={Placement.TOP_RIGHT}
            />
          </StyledWidgetLabelHelp>
        )}
      </WidgetLabel>
      <StyledUISelect>
        <UISelect
          creatable={element.acceptNewOptions ?? false}
          options={selectOptions}
          labelKey="label"
          valueKey="value"
          aria-label={element.label}
          placeholder={placeholder}
          type={TYPE.select}
          multi
          onChange={onChange}
          value={valueFromState}
          disabled={disabled}
          size={"compact"}
          noResultsMsg={getNoResultsMsg}
          filterOptions={filterOptions}
          closeOnSelect={false}
          ignoreCase={false}
          overrides={{
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

            IconsContainer: {
              style: () => ({
                paddingRight: theme.spacing.sm,
              }),
            },
            ControlContainer: {
              style: {
                maxHeight: maxHeight,
                minHeight: theme.sizes.minElementHeight,
                // Baseweb requires long-hand props, short-hand leads to weird bugs & warnings.
                borderLeftWidth: theme.sizes.borderWidth,
                borderRightWidth: theme.sizes.borderWidth,
                borderTopWidth: theme.sizes.borderWidth,
                borderBottomWidth: theme.sizes.borderWidth,
              },
            },
            Placeholder: {
              style: () => ({
                flex: "inherit",
                color: disabled
                  ? theme.colors.fadedText40
                  : theme.colors.fadedText60,
              }),
            },
            ValueContainer: {
              style: () => ({
                overflowY: "auto",
                paddingLeft: theme.spacing.sm,
                paddingTop: theme.spacing.none,
                paddingBottom: theme.spacing.none,
                paddingRight: theme.spacing.none,
              }),
            },
            ClearIcon: {
              props: {
                overrides: {
                  Svg: {
                    style: {
                      color: theme.colors.darkGray,
                      // setting this width and height makes the clear-icon align with dropdown arrows of other input fields
                      padding: theme.spacing.threeXS,
                      height: theme.sizes.clearIconSize,
                      width: theme.sizes.clearIconSize,
                      cursor: "pointer",
                      ":hover": {
                        fill: theme.colors.bodyText,
                      },
                    },
                  },
                },
              },
            },
            SearchIcon: {
              style: {
                color: theme.colors.darkGray,
              },
            },
            Tag: {
              props: {
                overrides: {
                  Root: {
                    style: {
                      fontWeight: theme.fontWeights.normal,
                      borderTopLeftRadius: theme.radii.md,
                      borderTopRightRadius: theme.radii.md,
                      borderBottomRightRadius: theme.radii.md,
                      borderBottomLeftRadius: theme.radii.md,
                      fontSize: theme.fontSizes.md,
                      paddingLeft: theme.spacing.sm,
                      marginLeft: theme.spacing.none,
                      marginRight: theme.spacing.sm,
                      // The tag height is derived from the minElementHeight
                      // minus a top and bottom padding (2 * spacing.xs)
                      // to nicely fit into the input field.
                      height: `calc(${theme.sizes.minElementHeight} - 2 * ${theme.spacing.xs})`,
                      maxWidth: `calc(100% - ${theme.spacing.lg})`,
                      // Using !important because the alternative would be
                      // uglier: we'd have to put it under a selector like
                      // "&[role="button"]:not(:disabled)" in order to win in
                      // the order of the precedence.
                      cursor: "default !important",
                    },
                  },
                  Action: {
                    style: {
                      paddingLeft: 0,
                    },
                  },
                  ActionIcon: {
                    props: {
                      overrides: {
                        Svg: {
                          style: {
                            // The action icon should be around 0.625% of the parent font size.
                            width: "0.625em",
                            height: "0.625em",
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            MultiValue: {
              props: {
                overrides: {
                  Root: {
                    style: {
                      fontSize: theme.fontSizes.sm,
                    },
                  },
                },
              },
            },
            Input: {
              props: {
                // Change the 'readonly' prop to hide the mobile keyboard if options < 10
                readOnly:
                  isMobile() && showKeyboardOnMobile === false
                    ? "readonly"
                    : null,
              },
            },
            Dropdown: { component: VirtualDropdown },
          }}
        />
      </StyledUISelect>
    </div>
  )
}

export default memo(Multiselect)
