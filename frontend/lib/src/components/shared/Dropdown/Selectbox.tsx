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

import React from "react"

import { isMobile } from "react-device-detect"
import { ChevronDown } from "baseui/icon"
import { OnChangeParams, Option, Select as UISelect } from "baseui/select"
import { withTheme } from "@emotion/react"
import { hasMatch, score } from "fzy.js"
import sortBy from "lodash/sortBy"

import VirtualDropdown from "@streamlit/lib/src/components/shared/Dropdown/VirtualDropdown"
import {
  isNullOrUndefined,
  LabelVisibilityOptions,
} from "@streamlit/lib/src/util/utils"
import { Placement } from "@streamlit/lib/src/components/shared/Tooltip"
import TooltipIcon from "@streamlit/lib/src/components/shared/TooltipIcon"
import {
  StyledWidgetLabelHelp,
  WidgetLabel,
} from "@streamlit/lib/src/components/widgets/BaseWidget"
import { EmotionTheme } from "@streamlit/lib/src/theme"

const NO_OPTIONS_MSG = "No options to select."

export interface Props {
  disabled: boolean
  width?: number
  value: number | null
  onChange: (value: number | null) => void
  options: any[]
  label?: string | null
  labelVisibility?: LabelVisibilityOptions
  help?: string
  placeholder?: string
  clearable?: boolean
  theme: EmotionTheme
}

interface State {
  // Used to work around the forced rerender when the input is empty
  isEmpty: boolean
  /**
   * The value specified by the user via the UI. If the user didn't touch this
   * widget's UI, the default value is used.
   */
  value: number | null
}

interface SelectOption {
  label: string
  value: string
}

// Add a custom filterOptions method to filter options only based on labels.
// The baseweb default method filters based on labels or indices
// More details: https://github.com/streamlit/streamlit/issues/1010
// Also filters using fuzzy search powered by fzy.js. Automatically handles
// upper/lowercase.
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
  return sortBy(filteredOptions, (opt: SelectOption) =>
    score(pattern, opt.label)
  ).reverse()
}

export class Selectbox extends React.PureComponent<Props, State> {
  public state: State = {
    isEmpty: false,
    value: this.props.value,
  }

  componentDidUpdate(prevProps: Readonly<Props>): void {
    if (
      prevProps.value !== this.props.value &&
      this.state.value !== this.props.value
    ) {
      this.setState((_, prevProps) => {
        return { value: prevProps.value }
      })
    }
  }

  private onChange = (params: OnChangeParams): void => {
    if (params.value.length === 0) {
      this.setState({ value: null }, () => this.props.onChange(null))
      return
    }

    const [selected] = params.value

    this.setState({ value: parseInt(selected.value, 10) }, () =>
      this.props.onChange(this.state.value)
    )
  }

  /**
   * Both onInputChange and onClose handle the situation where
   * the user has hit backspace enough times that there's nothing
   * left in the input, but we don't want the value for the input
   * to then be invalid once they've clicked away
   */
  private onInputChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ): void => {
    const currentInput = event.target.value

    this.setState({
      isEmpty: !currentInput,
    })
  }

  private onClose = (): void => {
    this.setState({
      isEmpty: false,
    })
  }

  private filterOptions = (
    options: readonly Option[],
    filterValue: string
  ): readonly Option[] =>
    fuzzyFilterSelectOptions(options as SelectOption[], filterValue)

  public render(): React.ReactNode {
    const style = { width: this.props.width }
    const { label, labelVisibility, help, placeholder, theme, clearable } =
      this.props
    let { disabled, options } = this.props

    let value: Option[] = []

    if (!isNullOrUndefined(this.state.value) && !this.state.isEmpty) {
      value = [
        {
          label:
            options.length > 0 ? options[this.state.value] : NO_OPTIONS_MSG,
          value: this.state.value.toString(),
        },
      ]
    }

    if (options.length === 0) {
      options = [NO_OPTIONS_MSG]
      disabled = true
    }

    const selectOptions: SelectOption[] = options.map(
      (option: string, index: number) => ({
        label: option,
        value: index.toString(),
      })
    )

    // Check if we have more than 10 options in the selectbox.
    // If that's true, we show the keyboard on mobile. If not, we hide it.
    const showKeyboardOnMobile = options.length > 10

    return (
      <div className="stSelectbox" data-testid="stSelectbox" style={style}>
        <WidgetLabel
          label={label}
          labelVisibility={labelVisibility}
          disabled={disabled}
        >
          {help && (
            <StyledWidgetLabelHelp>
              <TooltipIcon content={help} placement={Placement.TOP_RIGHT} />
            </StyledWidgetLabelHelp>
          )}
        </WidgetLabel>
        <UISelect
          disabled={disabled}
          labelKey="label"
          aria-label={label || ""}
          onChange={this.onChange}
          onInputChange={this.onInputChange}
          onClose={this.onClose}
          options={selectOptions}
          filterOptions={this.filterOptions}
          clearable={clearable || false}
          escapeClearsValue={clearable || false}
          value={value}
          valueKey="value"
          placeholder={placeholder}
          overrides={{
            Root: {
              style: () => ({
                lineHeight: theme.lineHeights.inputWidget,
              }),
            },
            Dropdown: { component: VirtualDropdown },
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

            ValueContainer: {
              style: () => ({
                // Baseweb requires long-hand props, short-hand leads to weird bugs & warnings.
                paddingRight: theme.spacing.sm,
                paddingLeft: theme.spacing.sm,
                paddingBottom: theme.spacing.sm,
                paddingTop: theme.spacing.sm,
              }),
            },

            Input: {
              props: {
                // Change the 'readonly' prop to hide the mobile keyboard if options < 10
                readOnly:
                  isMobile && showKeyboardOnMobile === false
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
}

export default withTheme(Selectbox)
