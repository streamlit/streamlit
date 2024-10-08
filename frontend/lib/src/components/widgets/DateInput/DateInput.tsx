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

import React, { memo, ReactElement, useCallback, useState } from "react"

import moment from "moment"
import { useTheme } from "@emotion/react"
import { DENSITY, Datepicker as UIDatePicker } from "baseui/datepicker"
import { PLACEMENT } from "baseui/popover"

import { DateInput as DateInputProto } from "@streamlit/lib/src/proto"
import { WidgetStateManager } from "@streamlit/lib/src/WidgetStateManager"
import {
  useBasicWidgetState,
  ValueWithSource,
} from "@streamlit/lib/src/useBasicWidgetState"
import {
  StyledWidgetLabelHelp,
  WidgetLabel,
} from "@streamlit/lib/src/components/widgets/BaseWidget"
import TooltipIcon from "@streamlit/lib/src/components/shared/TooltipIcon"
import { Placement } from "@streamlit/lib/src/components/shared/Tooltip"
import { labelVisibilityProtoValueToEnum } from "@streamlit/lib/src/util/utils"

export interface Props {
  disabled: boolean
  element: DateInputProto
  widgetMgr: WidgetStateManager
  width: number
  fragmentId?: string
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

function DateInput({
  disabled,
  element,
  widgetMgr,
  width,
  fragmentId,
}: Props): ReactElement {
  /**
   * An array with start and end date specified by the user via the UI. If the user
   * didn't touch this widget's UI, the default value is used. End date is optional.
   */
  const [value, setValueWithSource] = useBasicWidgetState<
    Date[],
    DateInputProto
  >({
    getStateFromWidgetMgr,
    getDefaultStateFromProto,
    getCurrStateFromProto,
    updateWidgetMgrState,
    element,
    widgetMgr,
    fragmentId,
  })

  const [isEmpty, setIsEmpty] = useState(false)

  const theme = useTheme()
  const { colors, fontSizes, lineHeights, spacing } = theme

  const style = { width }
  const minDate = moment(element.min, DATE_FORMAT).toDate()
  const maxDate = getMaxDate(element)
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

  const handleChange = useCallback(
    ({
      date,
    }: {
      date: Date | (Date | null | undefined)[] | null | undefined
    }): void => {
      if (date === null || date === undefined) {
        setValueWithSource({ value: [], fromUi: true })
        setIsEmpty(true)
        return
      }

      const newValue: Date[] = []
      if (Array.isArray(date)) {
        date.forEach((dt: Date | null | undefined) => {
          if (dt) {
            newValue.push(dt)
          }
        })
      } else {
        newValue.push(date)
      }

      setValueWithSource({ value: newValue, fromUi: true })
      setIsEmpty(!newValue)
    },
    [setValueWithSource]
  )

  const handleClose = useCallback((): void => {
    if (!isEmpty) return

    const newValue = stringsToDates(element.default)
    setValueWithSource({ value: newValue, fromUi: true })
    setIsEmpty(!newValue)
  }, [isEmpty, element, setValueWithSource])

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
        mask={element.isRange ? `${dateMask} – ${dateMask}` : dateMask}
        placeholder={
          element.isRange
            ? `${element.format} – ${element.format}`
            : element.format
        }
        disabled={disabled}
        onChange={handleChange}
        onClose={handleClose}
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
                  },
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
                          transform: "scale(1.41)",
                          width: theme.spacing.twoXL,
                          marginRight: "-8px",
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
        value={value}
        minDate={minDate}
        maxDate={maxDate}
        range={element.isRange}
        clearable={clearable}
      />
    </div>
  )
}

function getStateFromWidgetMgr(
  widgetMgr: WidgetStateManager,
  element: DateInputProto
): Date[] {
  // If WidgetStateManager knew a value for this widget, initialize to that.
  // Otherwise, use the default value from the widget protobuf.
  const storedValue = widgetMgr.getStringArrayValue(element)
  const stringArray =
    storedValue !== undefined ? storedValue : element.default || []

  return stringsToDates(stringArray)
}

function getDefaultStateFromProto(element: DateInputProto): Date[] {
  return stringsToDates(element.default) ?? []
}

function getCurrStateFromProto(element: DateInputProto): Date[] {
  return stringsToDates(element.value) ?? []
}

function updateWidgetMgrState(
  element: DateInputProto,
  widgetMgr: WidgetStateManager,
  vws: ValueWithSource<Date[]>,
  fragmentId?: string
): void {
  widgetMgr.setStringArrayValue(
    element,
    datesToStrings(vws.value),
    { fromUi: vws.fromUi },
    fragmentId
  )
}

function getMaxDate(element: DateInputProto): Date | undefined {
  const maxDate = element.max

  return maxDate && maxDate.length > 0
    ? moment(maxDate, DATE_FORMAT).toDate()
    : undefined
}

export default memo(DateInput)
