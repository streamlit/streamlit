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

import moment from "moment"
import { withTheme } from "@emotion/react"
import { DENSITY, Datepicker as UIDatePicker } from "baseui/datepicker"
import { PLACEMENT } from "baseui/popover"

import { DateInput as DateInputProto } from "@streamlit/lib/src/proto"
import { FormClearHelper } from "@streamlit/lib/src/components/widgets/Form"
import {
  Source,
  WidgetStateManager,
} from "@streamlit/lib/src/WidgetStateManager"
import {
  StyledWidgetLabelHelp,
  WidgetLabel,
} from "@streamlit/lib/src/components/widgets/BaseWidget"
import { EmotionTheme } from "@streamlit/lib/src/theme"
import TooltipIcon from "@streamlit/lib/src/components/shared/TooltipIcon"
import { Placement } from "@streamlit/lib/src/components/shared/Tooltip"
import { labelVisibilityProtoValueToEnum } from "@streamlit/lib/src/util/utils"

export interface Props {
  disabled: boolean
  element: DateInputProto
  theme: EmotionTheme
  widgetMgr: WidgetStateManager
  width: number
  fragmentId?: string
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
  if (!dates) {
    return []
  }
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
      storedValue !== undefined
        ? storedValue
        : this.props.element.default || []
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
    const dateValues = values.map((v: string) => new Date(v))
    this.setState(
      {
        values: dateValues,
        isEmpty: !dateValues,
      },
      () => {
        this.commitWidgetValue({ fromUi: false })
      }
    )
  }

  /** Commit state.value to the WidgetStateManager. */
  private commitWidgetValue = (source: Source): void => {
    const { widgetMgr, element, fragmentId } = this.props
    widgetMgr.setStringArrayValue(
      element,
      datesToStrings(this.state.values),
      source,
      fragmentId
    )
  }

  /**
   * If we're part of a clear_on_submit form, this will be called when our
   * form is submitted. Restore our default value and update the WidgetManager.
   */
  private onFormCleared = (): void => {
    const defaultValue = stringsToDates(this.props.element.default)
    this.setState(
      {
        values: defaultValue,
        isEmpty: !defaultValue,
      },
      () => this.commitWidgetValue({ fromUi: true })
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
    const { colors, fontSizes, lineHeights, spacing } = theme

    const style = { width }
    const minDate = moment(element.min, DATE_FORMAT).toDate()
    const maxDate = this.getMaxDate()
    const clearable = element.default.length === 0 && !disabled

    // We need to extract the mask and format (date-fns notation) from the provided format string
    // The user configured date format is based on the momentJS notation and is only allowed to contain
    // one of YYYY/MM/DD, DD/MM/YYYY, or MM/DD/YYYY" and can also use a period (.) or hyphen (-) as separators.

    // We need to convert the provided format into a mask supported by the Baseweb datepicker
    // Thereby, we need to replace all letters with 9s which refers to any number.
    const dateMask = element.format.replaceAll(/[a-zA-Z]/g, "9")
    // The Baseweb datepicker supports the date-fns notation for date formatting which is
    // slightly different from the momentJS notation. Therefore, we need to
    // convert the provided format into the date-fns notation:
    const dateFormat = element.format.replaceAll("Y", "y").replaceAll("D", "d")

    // Manage our form-clear event handler.
    this.formClearHelper.manageFormClearListener(
      widgetMgr,
      element.formId,
      this.onFormCleared
    )

    return (
      <div className="stDateInput" data-testid="stDateInput" style={style}>
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
          formatString={dateFormat}
          mask={isRange ? `${dateMask} – ${dateMask}` : dateMask}
          placeholder={
            isRange ? `${element.format} – ${element.format}` : element.format
          }
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
                      border: `${theme.sizes.borderWidth} solid ${colors.borderColor}`,
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
              style: ({
                // Due to a bug in BaseWeb, where the range selection defaults to mono300 and can't be changed, we need to override the background colors for all these shared props:
                // $pseudoHighlighted: Styles the range selection when you click an initial date, and hover over the end one, but NOT click it.
                // $pseudoSelected: Styles when a range was selected, click outide, and click the calendar again.
                // $selected: Styles the background below the red circle from the start and end dates.
                // $isHovered: Styles the background below the end date when hovered.
                $pseudoHighlighted,
                $pseudoSelected,
                $selected,
                $isHovered,
              }) => ({
                fontSize: fontSizes.sm,
                lineHeight: lineHeights.base,

                "::before": {
                  backgroundColor:
                    $selected ||
                    $pseudoSelected ||
                    $pseudoHighlighted ||
                    $isHovered
                      ? `${colors.secondaryBg} !important`
                      : colors.transparent,
                },

                "::after": {
                  borderColor: colors.transparent,
                },
              }),
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
                      borderLeftWidth: theme.sizes.borderWidth,
                      borderRightWidth: theme.sizes.borderWidth,
                      borderTopWidth: theme.sizes.borderWidth,
                      borderBottomWidth: theme.sizes.borderWidth,
                      paddingRight: theme.spacing.twoXS,
                    },
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
                            ":hover": {
                              fill: theme.colors.bodyText,
                            },
                          },
                        },
                      },
                    },
                  },
                  Input: {
                    style: {
                      // Baseweb requires long-hand props, short-hand leads to weird bugs & warnings.
                      paddingRight: spacing.sm,
                      paddingLeft: spacing.sm,
                      paddingBottom: spacing.sm,
                      paddingTop: spacing.sm,
                      lineHeight: lineHeights.inputWidget,
                    },
                    props: {
                      "data-testid": "stDateInputField",
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
          clearable={clearable}
        />
      </div>
    )
  }
}

export default withTheme(DateInput)
