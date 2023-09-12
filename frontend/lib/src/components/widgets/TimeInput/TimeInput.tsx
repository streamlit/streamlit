/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import React, { PureComponent, ReactNode } from "react"
import { TimePicker as UITimePicker } from "baseui/timepicker"
import { StyledClearIcon } from "baseui/input/styled-components"
import { ChevronDown } from "baseui/icon"
import { withTheme } from "@emotion/react"

import { TimeInput as TimeInputProto } from "@streamlit/lib/src/proto"
import { FormClearHelper } from "@streamlit/lib/src/components/widgets/Form"
import {
  WidgetStateManager,
  Source,
} from "@streamlit/lib/src/WidgetStateManager"
import {
  WidgetLabel,
  StyledWidgetLabelHelp,
} from "@streamlit/lib/src/components/widgets/BaseWidget"
import TooltipIcon from "@streamlit/lib/src/components/shared/TooltipIcon"
import { Placement } from "@streamlit/lib/src/components/shared/Tooltip"
import { EmotionTheme } from "@streamlit/lib/src/theme"
import {
  labelVisibilityProtoValueToEnum,
  isNullOrUndefined,
} from "@streamlit/lib/src/util/utils"

import { StyledClearIconContainer } from "./styled-components"

export interface Props {
  disabled: boolean
  element: TimeInputProto
  widgetMgr: WidgetStateManager
  width: number
  theme: EmotionTheme
}

interface State {
  /**
   * The value specified by the user via the UI. If the user didn't touch this
   * widget's UI, the default value is used.
   */
  value: string | null
}

class TimeInput extends PureComponent<Props, State> {
  private readonly formClearHelper = new FormClearHelper()

  public state: State = {
    value: this.initialValue,
  }

  get initialValue(): string | null {
    // If WidgetStateManager knew a value for this widget, initialize to that.
    // Otherwise, use the default value from the widget protobuf.
    const storedValue = this.props.widgetMgr.getStringValue(this.props.element)
    return storedValue ?? this.props.element.default ?? null
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
    this.setState({ value: value ?? null }, () => {
      this.commitWidgetValue({ fromUi: false })
    })
  }

  /** Commit state.value to the WidgetStateManager. */
  private commitWidgetValue = (source: Source): void => {
    this.props.widgetMgr.setStringValue(
      this.props.element,
      this.state.value,
      source
    )
  }

  /**
   * If we're part of a clear_on_submit form, this will be called when our
   * form is submitted. Restore our default value and update the WidgetManager.
   */
  private onFormCleared = (): void => {
    this.setState(
      (_, prevProps) => {
        return { value: prevProps.element.default ?? null }
      },
      () => this.commitWidgetValue({ fromUi: true })
    )
  }

  private handleChange = (newDate: Date | null): void => {
    let value: string | null
    if (newDate === null) {
      value = null
    } else {
      value = this.dateToString(newDate)
    }
    this.setState({ value }, () => this.commitWidgetValue({ fromUi: true }))
  }

  private stringToDate = (value: string | null): Date | null => {
    if (value === null) {
      return null
    }
    const [hours, minutes] = value.split(":").map(Number)
    const date = new Date()

    date.setHours(hours)
    date.setMinutes(minutes)

    return date
  }

  private dateToString = (value: Date): string => {
    const hours = value.getHours().toString().padStart(2, "0")
    const minutes = value.getMinutes().toString().padStart(2, "0")

    return `${hours}:${minutes}`
  }

  public render(): ReactNode {
    const { disabled, width, element, widgetMgr, theme } = this.props
    const clearable = isNullOrUndefined(element.default) && !disabled

    const style = { width }

    const selectOverrides = {
      Select: {
        props: {
          disabled,

          overrides: {
            ControlContainer: {
              style: {
                // Baseweb requires long-hand props, short-hand leads to weird bugs & warnings.
                borderLeftWidth: "1px",
                borderRightWidth: "1px",
                borderTopWidth: "1px",
                borderBottomWidth: "1px",
              },
            },

            IconsContainer: {
              style: () => ({
                paddingRight: ".5rem",
              }),
            },

            ValueContainer: {
              style: () => ({
                // Baseweb requires long-hand props, short-hand leads to weird bugs & warnings.
                paddingRight: ".5rem",
                paddingLeft: ".5rem",
                paddingBottom: ".5rem",
                paddingTop: ".5rem",
              }),
            },

            SingleValue: {
              props: {
                // For easier testing - indicates div that holds the selected time
                "data-testid": "stTimeInput-timeDisplay",
              },
            },

            Dropdown: {
              style: () => ({
                paddingTop: 0,
                paddingBottom: 0,
              }),
            },

            // Nudge the dropdown menu by 1px so the focus state doesn't get cut off
            Popover: {
              props: {
                overrides: {
                  Body: {
                    style: () => ({
                      marginTop: "1px",
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
          },
        },
      },
    }

    // Manage our form-clear event handler.
    this.formClearHelper.manageFormClearListener(
      widgetMgr,
      element.formId,
      this.onFormCleared
    )

    return (
      <div className="stTimeInput" data-testid="stTimeInput" style={style}>
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
        <UITimePicker
          format="24"
          step={element.step ? Number(element.step) : 900} // step in seconds, defaults to 900s (15 minutes)
          value={
            isNullOrUndefined(this.state.value)
              ? undefined
              : this.stringToDate(this.state.value)
          }
          onChange={this.handleChange}
          overrides={selectOverrides}
          nullable={clearable}
          creatable
          aria-label={element.label}
        />
        {clearable && !isNullOrUndefined(this.state.value) && (
          // The time picker doesn't have a built-in clearable functionality.
          // Therefore, we are adding the clear button here.
          <StyledClearIconContainer
            onClick={() => {
              this.handleChange(null)
            }}
            data-testid="stTimeInputClearButton"
          >
            <StyledClearIcon
              overrides={{
                Svg: {
                  style: {
                    color: theme.colors.darkGray,
                    // Since the close icon is an SVG, and we can't control its viewbox nor its attributes,
                    // Let's use a scale transform effect to make it bigger.
                    // The width property only enlarges its bounding box, so it's easier to click.
                    transform: "scale(1.41)",
                    width: theme.spacing.twoXL,

                    ":hover": {
                      fill: theme.colors.bodyText,
                    },
                  },
                },
              }}
              $isFocusVisible={false}
            />
          </StyledClearIconContainer>
        )}
      </div>
    )
  }
}

export default withTheme(TimeInput)
