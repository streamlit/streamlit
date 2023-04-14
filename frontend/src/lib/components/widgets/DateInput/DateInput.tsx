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

import React from "react"
import moment from "moment"
import { withTheme } from "@emotion/react"
import { Datepicker as UIDatePicker, DENSITY } from "baseui/datepicker"
import { PLACEMENT } from "baseui/popover"
import { DateInput as DateInputProto } from "src/autogen/proto"
import { FormClearHelper } from "src/lib/components/widgets/Form"
import { WidgetStateManager, Source } from "src/lib/WidgetStateManager"
import {
  WidgetLabel,
  StyledWidgetLabelHelp,
} from "src/lib/components/widgets/BaseWidget"
import { EmotionTheme } from "src/lib/theme"
import TooltipIcon from "src/lib/components/shared/TooltipIcon"
import { Placement } from "src/lib/components/shared/Tooltip"

import { labelVisibilityProtoValueToEnum } from "src/lib/util/utils"

export interface Props {
  disabled: boolean
  element: DateInputProto
  theme: EmotionTheme
  widgetMgr: WidgetStateManager
  width: number
}

interface State {
  /**
   * An array with start and end date specified by the user via the UI. If the user
   * didn't touch this widget's UI, the default value is used. End date is optional.
   */
  values: Date[]
  /**
   * Boolean to toggle between single-date picker and range date picker.
   */
  isRange: boolean
  isEmpty: boolean
}

// Date format for communication (protobuf) support
const DATE_FORMAT = "YYYY/MM/DD"

/** Convert an array of strings to an array of dates. */
function stringsToDates(strings: string[]): Date[] {
  return strings.map(val => new Date(val))
}

/** Convert an array of dates to an array of strings. */
function datesToStrings(dates: Date[]): string[] {
  return dates.map((value: Date) => moment(value as Date).format(DATE_FORMAT))
}

class DateInput extends React.PureComponent<Props, State> {
  private readonly formClearHelper = new FormClearHelper()

  public state: State = {
    values: this.initialValue,
    isRange: this.props.element.isRange,
    isEmpty: false,
  }

  get initialValue(): Date[] {
    // If WidgetStateManager knew a value for this widget, initialize to that.
    // Otherwise, use the default value from the widget protobuf.
    const storedValue = this.props.widgetMgr.getStringArrayValue(
      this.props.element
    )
    const stringArray =
      storedValue !== undefined ? storedValue : this.props.element.default
    return stringsToDates(stringArray)
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
    const { value: values } = this.props.element
    this.props.element.setValue = false
    this.setState(
      {
        values: values.map((v: string) => new Date(v)),
      },
      () => {
        this.commitWidgetValue({ fromUi: false })
      }
    )
  }

  /** Commit state.value to the WidgetStateManager. */
  private commitWidgetValue = (source: Source): void => {
    this.props.widgetMgr.setStringArrayValue(
      this.props.element,
      datesToStrings(this.state.values),
      source
    )
  }

  /**
   * If we're part of a clear_on_submit form, this will be called when our
   * form is submitted. Restore our default value and update the WidgetManager.
   */
  private onFormCleared = (): void => {
    const defaultValue = stringsToDates(this.props.element.default)
    this.setState({ values: defaultValue }, () =>
      this.commitWidgetValue({ fromUi: true })
    )
  }

  private handleChange = ({
    date,
  }: {
    date: Date | (Date | null | undefined)[] | null | undefined
  }): void => {
    if (date === null || date === undefined) {
      this.setState({
        values: [],
        isEmpty: true,
      })
      return
    }

    const values: Date[] = []
    if (Array.isArray(date)) {
      date.forEach((dt: Date | null | undefined) => {
        if (dt) {
          values.push(dt)
        }
      })
    } else {
      values.push(date)
    }

    this.setState(
      {
        values,
        isEmpty: !values,
      },
      () => {
        if (!this.state.isEmpty) this.commitWidgetValue({ fromUi: true })
      }
    )
  }

  private handleClose = (): void => {
    const { isEmpty } = this.state
    if (isEmpty) {
      this.setState(
        (_, prevProps) => {
          return {
            values: stringsToDates(prevProps.element.default),
            isEmpty: !stringsToDates(prevProps.element.default),
          }
        },
        () => {
          this.commitWidgetValue({ fromUi: true })
        }
      )
    }
  }

  private getMaxDate = (): Date | undefined => {
    const { element } = this.props
    const maxDate = element.max

    return maxDate && maxDate.length > 0
      ? moment(maxDate, DATE_FORMAT).toDate()
      : undefined
  }

  public render(): React.ReactNode {
    const { width, element, disabled, theme, widgetMgr } = this.props
    const { values, isRange } = this.state
    const { colors, fontSizes, lineHeights } = theme

    const style = { width }
    const minDate = moment(element.min, DATE_FORMAT).toDate()
    const maxDate = this.getMaxDate()

    // Manage our form-clear event handler.
    this.formClearHelper.manageFormClearListener(
      widgetMgr,
      element.formId,
      this.onFormCleared
    )

    return (
      <div className="stDateInput" style={style}>
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
        <UIDatePicker
          density={DENSITY.high}
          formatString="yyyy/MM/dd"
          disabled={disabled}
          onChange={this.handleChange}
          onClose={this.handleClose}
          overrides={{
            Popover: {
              props: {
                placement: PLACEMENT.bottomLeft,
                overrides: {
                  Body: {
                    style: {
                      border: `1px solid ${colors.fadedText10}`,
                    },
                  },
                },
              },
            },
            CalendarContainer: {
              style: {
                fontSize: fontSizes.sm,
                paddingRight: theme.spacing.sm,
                paddingLeft: theme.spacing.sm,
                paddingBottom: theme.spacing.sm,
                paddingTop: theme.spacing.sm,
              },
            },
            Week: {
              style: {
                fontSize: fontSizes.sm,
              },
            },
            Day: {
              style: {
                fontSize: fontSizes.sm,
                lineHeight: lineHeights.base,
                "::after": {
                  borderColor: colors.transparent,
                },
              },
            },
            PrevButton: {
              style: () => ({
                // Align icon to the center of the button.
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                // Remove primary-color click effect.
                ":active": {
                  backgroundColor: colors.transparent,
                },
                ":focus": {
                  backgroundColor: colors.transparent,
                  outline: 0,
                },
              }),
            },
            NextButton: {
              style: {
                // Align icon to the center of the button.
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                // Remove primary-color click effect.
                ":active": {
                  backgroundColor: colors.transparent,
                },
                ":focus": {
                  backgroundColor: colors.transparent,
                  outline: 0,
                },
              },
            },
            Input: {
              props: {
                // The default maskChar ` ` causes empty dates to display as ` / / `
                // Clearing the maskChar so empty dates will not display
                maskChar: null,

                overrides: {
                  Root: {
                    style: {
                      // Baseweb requires long-hand props, short-hand leads to weird bugs & warnings.
                      borderLeftWidth: "1px",
                      borderRightWidth: "1px",
                      borderTopWidth: "1px",
                      borderBottomWidth: "1px",
                    },
                  },

                  Input: {
                    style: {
                      // Baseweb requires long-hand props, short-hand leads to weird bugs & warnings.
                      paddingRight: ".5rem",
                      paddingLeft: ".5rem",
                      paddingBottom: ".5rem",
                      paddingTop: ".5rem",
                    },
                  },
                },
              },
            },
          }}
          value={values}
          minDate={minDate}
          maxDate={maxDate}
          range={isRange}
        />
      </div>
    )
  }
}

export default withTheme(DateInput)
