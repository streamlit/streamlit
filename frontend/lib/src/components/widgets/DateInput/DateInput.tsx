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
  ReactElement,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react"

import { ErrorOutline } from "@emotion-icons/material-outlined"
import { DENSITY, Datepicker as UIDatePicker } from "baseui/datepicker"
import { PLACEMENT } from "baseui/popover"
import { format } from "date-fns"
import moment from "moment"

import { DateInput as DateInputProto } from "@streamlit/protobuf"

import IsSidebarContext from "~lib/components/core/IsSidebarContext"
import { LibContext } from "~lib/components/core/LibContext"
import Icon from "~lib/components/shared/Icon"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown"
import Tooltip, { Placement } from "~lib/components/shared/Tooltip"
import TooltipIcon from "~lib/components/shared/TooltipIcon"
import {
  StyledWidgetLabelHelp,
  WidgetLabel,
} from "~lib/components/widgets/BaseWidget"
import {
  useBasicWidgetState,
  ValueWithSource,
} from "~lib/hooks/useBasicWidgetState"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { hasLightBackgroundColor } from "~lib/theme"
import {
  isNullOrUndefined,
  labelVisibilityProtoValueToEnum,
} from "~lib/util/utils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import { useIntlLocale } from "./useIntlLocale"

export interface Props {
  disabled: boolean
  element: DateInputProto
  widgetMgr: WidgetStateManager
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
  return dates.map((value: Date) => moment(value).format(DATE_FORMAT))
}

// Types for date validation
type ValidationResult = {
  errorType: "Start" | "End" | null
  newDates: Date[]
}

function DateInput({
  disabled,
  element,
  widgetMgr,
  fragmentId,
}: Props): ReactElement {
  const theme = useEmotionTheme()
  const isInSidebar = useContext(IsSidebarContext)

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
  const [error, setError] = useState<string | null>(null)

  const { colors, fontSizes, lineHeights, spacing, sizes } = useEmotionTheme()

  const { locale } = useContext(LibContext)
  const loadedLocale = useIntlLocale(locale)

  const minDate = useMemo(
    () => moment(element.min, DATE_FORMAT).toDate(),
    [element.min]
  )

  const maxDate = useMemo(() => getMaxDate(element), [element])

  const enableQuickSelect = useMemo(() => {
    if (!element.isRange) {
      return false
    }

    // Since quick select allows to select ranges up to the past 2 years,
    // we should only enable it if the min date is older than 2 years ago.
    const twoYearsAgo = moment().subtract(2, "years").toDate()
    return minDate < twoYearsAgo
  }, [element.isRange, minDate])

  const clearable = element.default.length === 0 && !disabled

  // We need to extract the mask and format (date-fns notation) from the provided format string
  // The user configured date format is based on the momentJS notation and is only allowed to contain
  // one of YYYY/MM/DD, DD/MM/YYYY, or MM/DD/YYYY" and can also use a period (.) or hyphen (-) as separators.
  // We need to convert the provided format into a mask supported by the Baseweb datepicker
  // Thereby, we need to replace all letters with 9s which refers to any number.
  // (Using useMemo to avoid recomputing every time for now reason)
  const dateMask = useMemo(
    () => element.format.replaceAll(/[a-zA-Z]/g, "9"),
    [element.format]
  )

  // The Baseweb datepicker supports the date-fns notation for date formatting which is
  // slightly different from the momentJS notation. Therefore, we need to
  // convert the provided format into the date-fns notation:
  // (Using useMemo to avoid recomputing every time for now reason)
  const dateFormat = useMemo(
    () => element.format.replaceAll("Y", "y").replaceAll("D", "d"),
    [element.format]
  )

  // Date strings used for error messages
  const minDateString = useMemo(
    () => format(minDate, dateFormat, { locale: loadedLocale }),
    [minDate, dateFormat, loadedLocale]
  )

  const maxDateString = useMemo(
    () =>
      maxDate ? format(maxDate, dateFormat, { locale: loadedLocale }) : "",
    [maxDate, dateFormat, loadedLocale]
  )

  // Create tooltip error message based on validation error
  const createErrorMessage = useCallback(
    (errorType: string | null): string | null => {
      if (!errorType) return null

      if (element.isRange) {
        const messageEnding =
          errorType === "End"
            ? `before ${maxDateString}`
            : `after ${minDateString}`

        return `**Error**: ${errorType} date set outside allowed range. Please select a date ${messageEnding}.`
      }

      return `**Error**: Date set outside allowed range. Please select a date between ${minDateString} and ${maxDateString}.`
    },
    [element.isRange, maxDateString, minDateString]
  )

  const handleChange = useCallback(
    ({
      date,
    }: {
      date: Date | (Date | null | undefined)[] | null | undefined
    }): void => {
      // Reset our error state
      setError(null)

      if (isNullOrUndefined(date)) {
        setValueWithSource({ value: [], fromUi: true })
        setIsEmpty(true)
        return
      }

      // Handles FE date validation
      const { errorType, newDates } = validateDates(date, minDate, maxDate)
      if (errorType) {
        setError(createErrorMessage(errorType))
      }
      setValueWithSource({ value: newDates, fromUi: true })
      setIsEmpty(!newDates)
    },
    [setValueWithSource, createErrorMessage, setError, minDate, maxDate]
  )

  const handleClose = useCallback((): void => {
    if (!isEmpty) return

    const newValue = stringsToDates(element.default)
    setValueWithSource({ value: newValue, fromUi: true })
    setIsEmpty(!newValue)
  }, [isEmpty, element, setValueWithSource])

  return (
    <div className="stDateInput" data-testid="stDateInput">
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
        locale={loadedLocale}
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
        quickSelect={enableQuickSelect}
        overrides={{
          Popover: {
            props: {
              ignoreBoundary: isInSidebar,
              placement: PLACEMENT.bottomLeft,
              overrides: {
                Body: {
                  style: {
                    marginTop: theme.spacing.px,
                  },
                },
              },
            },
          },
          CalendarContainer: {
            style: {
              fontSize: fontSizes.sm,
              paddingRight: spacing.sm,
              paddingLeft: spacing.sm,
              paddingBottom: spacing.sm,
              paddingTop: spacing.sm,
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
                    ? `${colors.darkenedBgMix15} !important`
                    : colors.transparent,
              },

              "::after": {
                borderColor: colors.transparent,
              },
              //Apply background color only when hovering over a date in the range in light theme
              ...(hasLightBackgroundColor(theme) &&
              $isHovered &&
              $pseudoSelected &&
              !$selected
                ? {
                    color: colors.secondaryBg,
                  }
                : {}),
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

              // Passes error icon/tooltip to underlying input in error state
              // otherwise no end enhancer is shown
              endEnhancer: error && (
                <Tooltip
                  content={
                    <StreamlitMarkdown source={error} allowHTML={false} />
                  }
                  placement={Placement.TOP_RIGHT}
                  error
                >
                  <Icon content={ErrorOutline} size="lg" />
                </Tooltip>
              ),

              overrides: {
                EndEnhancer: {
                  style: {
                    // Match text color with st.error in light and dark mode
                    color: hasLightBackgroundColor(theme)
                      ? colors.red100
                      : colors.red20,
                    backgroundColor: colors.transparent,
                  },
                },
                Root: {
                  style: {
                    // Baseweb requires long-hand props, short-hand leads to weird bugs & warnings.
                    borderLeftWidth: sizes.borderWidth,
                    borderRightWidth: sizes.borderWidth,
                    borderTopWidth: sizes.borderWidth,
                    borderBottomWidth: sizes.borderWidth,
                    paddingRight: spacing.twoXS,

                    // Baseweb has an error prop for the input, but its coloring doesn't reconcile
                    // with our dark theme - we handle error state coloring manually here
                    ...(error && {
                      backgroundColor: colors.dangerBg,
                    }),
                  },
                },
                ClearIcon: {
                  props: {
                    overrides: {
                      Svg: {
                        style: {
                          color: colors.darkGray,
                          // setting this width and height makes the clear-icon align with dropdown arrows of other input fields
                          padding: spacing.threeXS,
                          height: sizes.clearIconSize,
                          width: sizes.clearIconSize,
                          ":hover": {
                            fill: colors.bodyText,
                          },
                        },
                      },
                    },
                  },
                },
                InputContainer: {
                  style: {
                    // Explicitly specified so error background renders correctly
                    backgroundColor: "transparent",
                  },
                },
                Input: {
                  style: {
                    fontWeight: theme.fontWeights.normal,
                    // Baseweb requires long-hand props, short-hand leads to weird bugs & warnings.
                    paddingRight: spacing.sm,
                    paddingLeft: spacing.md,
                    paddingBottom: spacing.sm,
                    paddingTop: spacing.sm,
                    lineHeight: lineHeights.inputWidget,

                    "::placeholder": {
                      color: theme.colors.fadedText60,
                    },

                    // Change input value text color in error state - matches st.error in light and dark mode
                    ...(error && {
                      color: hasLightBackgroundColor(theme)
                        ? colors.red100
                        : colors.red20,
                    }),
                  },
                  props: {
                    "data-testid": "stDateInputField",
                  },
                },
              },
            },
          },
          QuickSelect: {
            props: {
              overrides: {
                ControlContainer: {
                  style: {
                    height: theme.sizes.minElementHeight,
                    // Baseweb requires long-hand props, short-hand leads to weird bugs & warnings.
                    borderLeftWidth: theme.sizes.borderWidth,
                    borderRightWidth: theme.sizes.borderWidth,
                    borderTopWidth: theme.sizes.borderWidth,
                    borderBottomWidth: theme.sizes.borderWidth,
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
  const minDate = moment(element.min, DATE_FORMAT).toDate()
  const maxDate = getMaxDate(element)
  let isValid = true

  // Check if date(s) outside of allowed min/max
  const { errorType } = validateDates(vws.value, minDate, maxDate)
  if (errorType) {
    isValid = false
  }

  // Only update widget state if date(s) valid
  if (isValid) {
    widgetMgr.setStringArrayValue(
      element,
      datesToStrings(vws.value),
      { fromUi: vws.fromUi },
      fragmentId
    )
  }
}

function validateDates(
  dates: Date | (Date | null | undefined)[] | null | undefined,
  minDate: Date,
  maxDate: Date | undefined
): ValidationResult {
  const newDates: Date[] = []
  let errorType: "Start" | "End" | null = null

  if (isNullOrUndefined(dates)) {
    return { errorType: null, newDates: [] }
  }

  if (Array.isArray(dates)) {
    dates.forEach((dt: Date | null | undefined) => {
      if (dt) {
        if (maxDate && dt > maxDate) {
          errorType = "End"
        } else if (dt < minDate) {
          errorType = "Start"
        }
        newDates.push(dt)
      }
    })
  } else if (dates) {
    if (maxDate && dates > maxDate) {
      errorType = "End"
    } else if (dates < minDate) {
      errorType = "Start"
    }
    newDates.push(dates)
  }

  return {
    errorType,
    newDates,
  }
}

function getMaxDate(element: DateInputProto): Date | undefined {
  const maxDate = element.max

  return maxDate && maxDate.length > 0
    ? moment(maxDate, DATE_FORMAT).toDate()
    : undefined
}

export default memo(DateInput)
