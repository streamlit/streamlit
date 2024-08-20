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
import without from "lodash/without"
import { withTheme } from "@emotion/react"
import { ChevronDown } from "baseui/icon"
import {
  OnChangeParams,
  Option,
  TYPE,
  Select as UISelect,
} from "baseui/select"

import { FormClearHelper } from "@streamlit/lib/src/components/widgets/Form"
import {
  Source,
  WidgetStateManager,
} from "@streamlit/lib/src/WidgetStateManager"
import { MultiSelect as MultiSelectProto } from "@streamlit/lib/src/proto"
import {
  StyledWidgetLabelHelp,
  WidgetLabel,
} from "@streamlit/lib/src/components/widgets/BaseWidget"
import { StyledUISelect } from "@streamlit/lib/src/components/widgets/Multiselect/styled-components"
import TooltipIcon from "@streamlit/lib/src/components/shared/TooltipIcon"
import { Placement } from "@streamlit/lib/src/components/shared/Tooltip"
import { VirtualDropdown } from "@streamlit/lib/src/components/shared/Dropdown"
import { fuzzyFilterSelectOptions } from "@streamlit/lib/src/components/shared/Dropdown/Selectbox"
import { labelVisibilityProtoValueToEnum } from "@streamlit/lib/src/util/utils"
import { EmotionTheme } from "@streamlit/lib/src/theme"

export interface Props {
  disabled: boolean
  element: MultiSelectProto
  theme: EmotionTheme
  widgetMgr: WidgetStateManager
  width: number
  fragmentId?: string
}

interface State {
  /**
   * The value specified by the user via the UI.
   */
  value: number[]
}

interface MultiselectOption {
  label: string
  value: string
}

class Multiselect extends React.PureComponent<Props, State> {
  private readonly formClearHelper = new FormClearHelper()

  public state: State = {
    value: this.initialValue,
  }

  private overMaxSelections(): boolean {
    return (
      this.props.element.maxSelections > 0 &&
      this.state.value.length >= this.props.element.maxSelections
    )
  }

  private getNoResultsMsg(): string {
    const { maxSelections } = this.props.element
    const { value } = this.state

    if (maxSelections === 0) {
      return "No results"
    } else if (value.length === maxSelections) {
      const option = maxSelections !== 1 ? "options" : "option"
      return `You can only select up to ${maxSelections} ${option}. Remove an option first.`
    }
    return "No results"
  }

  get initialValue(): number[] {
    // If WidgetStateManager knew a value for this widget, initialize to that.
    // Otherwise, use the default value from the widget protobuf.
    const storedValue = this.props.widgetMgr.getIntArrayValue(
      this.props.element
    )
    return storedValue !== undefined ? storedValue : this.props.element.default
  }

  public componentDidMount(): void {
    if (this.props.element.setValue) {
      this.updateFromProtobuf()
    } else {
      this.commitWidgetValue({ fromUi: false })
    }
  }

  public componentDidUpdate(): void {
    this.maybeUpdateFromProtobuf()
  }

  public componentWillUnmount(): void {
    this.formClearHelper.disconnect()
  }

  private maybeUpdateFromProtobuf(): void {
    const { setValue } = this.props.element
    if (setValue) {
      this.updateFromProtobuf()
    }
  }

  private updateFromProtobuf(): void {
    const { value } = this.props.element
    this.props.element.setValue = false
    this.setState({ value }, () => {
      this.commitWidgetValue({ fromUi: false })
    })
  }

  /** Commit state.value to the WidgetStateManager. */
  private commitWidgetValue = (source: Source): void => {
    const { widgetMgr, element, fragmentId } = this.props
    widgetMgr.setIntArrayValue(element, this.state.value, source, fragmentId)
  }

  /**
   * If we're part of a clear_on_submit form, this will be called when our
   * form is submitted. Restore our default value and update the WidgetManager.
   */
  private onFormCleared = (): void => {
    this.setState(
      (_, prevProps) => {
        return { value: prevProps.element.default }
      },
      () => this.commitWidgetValue({ fromUi: true })
    )
  }

  private get valueFromState(): MultiselectOption[] {
    return this.state.value.map(i => {
      const label = this.props.element.options[i]
      return { value: i.toString(), label }
    })
  }

  private generateNewState(data: OnChangeParams): State {
    const getIndex = (): number => {
      const valueId = data.option?.value
      return parseInt(valueId, 10)
    }

    switch (data.type) {
      case "remove": {
        return {
          value: without(this.state.value, getIndex()),
        }
      }
      case "clear": {
        return { value: [] }
      }
      case "select": {
        return {
          value: this.state.value.concat([getIndex()]),
        }
      }
      default: {
        throw new Error(`State transition is unknown: ${data.type}`)
      }
    }
  }

  private onChange = (params: OnChangeParams): void => {
    if (
      this.props.element.maxSelections &&
      params.type === "select" &&
      this.state.value.length >= this.props.element.maxSelections
    ) {
      return
    }
    this.setState(this.generateNewState(params), () => {
      this.commitWidgetValue({ fromUi: true })
    })
  }

  private filterOptions = (
    options: readonly Option[],
    filterValue: string
  ): readonly Option[] => {
    if (this.overMaxSelections()) {
      return []
    }
    // We need to manually filter for previously selected options here
    const unselectedOptions = options.filter(
      option => !this.state.value.includes(Number(option.value))
    )

    return fuzzyFilterSelectOptions(
      unselectedOptions as MultiselectOption[],
      filterValue
    )
  }

  public render(): React.ReactNode {
    const { element, theme, width, widgetMgr } = this.props
    const style = { width }
    const { options } = element
    const disabled = options.length === 0 ? true : this.props.disabled
    const placeholder =
      options.length === 0 ? "No options to select." : element.placeholder
    const selectOptions: MultiselectOption[] = options.map(
      (option: string, idx: number) => {
        return {
          label: option,
          value: idx.toString(),
        }
      }
    )

    // Manage our form-clear event handler.
    this.formClearHelper.manageFormClearListener(
      widgetMgr,
      element.formId,
      this.onFormCleared
    )

    // Check if we have more than 10 options in the selectbox.
    // If that's true, we show the keyboard on mobile. If not, we hide it.
    const showKeyboardOnMobile = options.length > 10

    return (
      <div className="stMultiSelect" data-testid="stMultiSelect" style={style}>
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
            options={selectOptions}
            labelKey="label"
            valueKey="value"
            aria-label={element.label}
            placeholder={placeholder}
            type={TYPE.select}
            multi
            onChange={this.onChange}
            value={this.valueFromState}
            disabled={disabled}
            size={"compact"}
            noResultsMsg={this.getNoResultsMsg()}
            filterOptions={this.filterOptions}
            closeOnSelect={false}
            overrides={{
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

              IconsContainer: {
                style: () => ({
                  paddingRight: theme.spacing.sm,
                }),
              },
              ControlContainer: {
                style: {
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
                }),
              },
              ValueContainer: {
                style: () => ({
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
                        // Since the close icon is an SVG, and we can't control its viewbox nor its attributes,
                        // Let's use a scale transform effect to make it bigger.
                        // The width property only enlarges its bounding box, so it's easier to click.
                        transform: "scale(1.5)",
                        width: theme.spacing.twoXL,

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
                        borderTopLeftRadius: theme.radii.md,
                        borderTopRightRadius: theme.radii.md,
                        borderBottomRightRadius: theme.radii.md,
                        borderBottomLeftRadius: theme.radii.md,
                        fontSize: theme.fontSizes.sm,
                        paddingLeft: theme.spacing.sm,
                        marginLeft: theme.spacing.none,
                        marginRight: theme.spacing.sm,
                        height: "28px",
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
                              width: "10px",
                              height: "10px",
                            },
                          },
                        },
                      },
                    },
                    Text: {
                      style: {
                        fontSize: theme.fontSizes.md,
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
                    isMobile && showKeyboardOnMobile === false
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
}

export default withTheme(Multiselect)
