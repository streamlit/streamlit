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
  memo,
  ReactElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

import { ErrorOutline } from "@emotion-icons/material-outlined"
import { CalendarDate, getLocalTimeZone } from "@internationalized/date"
import { DENSITY, Datepicker as UIDatePicker } from "baseui/datepicker"
import { PLACEMENT } from "baseui/popover"

import { DateInput as DateInputProto } from "@streamlit/protobuf"

import IsSidebarContext from "~lib/components/core/IsSidebarContext"
import { LibConfigContext } from "~lib/components/core/LibConfigContext"
import {
  getBorderColor,
  getPopoverContainerStyle,
} from "~lib/components/shared/Base/styled-components"
import Icon from "~lib/components/shared/Icon/Icon"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown/StreamlitMarkdown"
import Tooltip, { Placement } from "~lib/components/shared/Tooltip/Tooltip"
import { WidgetLabel } from "~lib/components/widgets/BaseWidget/WidgetLabel"
import { WidgetLabelHelpIcon } from "~lib/components/widgets/BaseWidget/WidgetLabelHelpIcon"
import {
  useBasicWidgetState,
  ValueWithSource,
} from "~lib/hooks/useBasicWidgetState"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { hasLightBackgroundColor } from "~lib/theme/getColors"
import { convertRemToPx } from "~lib/theme/utils"
import {
  isNullOrUndefined,
  labelVisibilityProtoValueToEnum,
} from "~lib/util/utils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import {
  calendarDateToIso,
  createDateErrorMessage,
  dateToCalendarDate,
  DateValidationErrorType,
  formatCalendarDate,
  getMaxDate as getMaxCalendarDate,
  getMinDate,
  isOlderThanTwoYears,
  isoToCalendarDate,
  validateDate,
} from "./dateInputUtils"
import SingleDateInput from "./SingleDateInput"
import { useFirstDayOfWeek } from "./useFirstDayOfWeek"
import { useIntlLocale } from "./useIntlLocale"

export interface Props {
  disabled: boolean
  element: DateInputProto
  widgetMgr: WidgetStateManager
  fragmentId?: string
}

/**
 * Converts an array of ISO 8601 wire-format strings (the canonical widget
 * state — see `getStateFromWidgetMgr` et al. below) to native `Date`
 * objects, needed only to feed the still-BaseWeb-backed range mode's
 * `Datepicker` props. Single mode (`SingleDateInput`) consumes `CalendarDate`
 * directly and never needs this conversion.
 */
function stringsToDates(strings: string[]): Date[] {
  return strings
    .map(isoToCalendarDate)
    .filter((d): d is CalendarDate => d !== null)
    .map(d => d.toDate(getLocalTimeZone()))
}

function DateInput({
  disabled,
  element,
  widgetMgr,
  fragmentId,
}: Props): ReactElement {
  const theme = useEmotionTheme()
  const isInSidebar = useContext(IsSidebarContext)
  const [isEmpty, setIsEmpty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Lifted here so a future single/range toggle can preserve calendar
  // continuity across the swap.
  const [focusedValue, setFocusedValue] = useState<CalendarDate | null>(null)

  const resetError = useCallback(() => {
    setError(null)
  }, [])

  const handleFormCleared = useCallback(() => {
    resetError()
    setIsEmpty(false)
  }, [resetError])

  /**
   * An array with start and end date specified by the user via the UI. If the user
   * didn't touch this widget's UI, the default value is used. End date is optional.
   *
   * Canonical state is the ISO 8601 wire format directly (`string[]`), not
   * `Date[]` — this is what `WidgetStateManager` already stores, and what
   * `SingleDateInput`'s `CalendarDate`-based value converts to/from cleanly
   * via `dateInputUtils.ts`, with no `moment`/`date-fns` round-trip needed.
   */
  const queryParamBinding = element.queryParamKey
    ? {
        paramKey: element.queryParamKey,
        valueType: "string_array_value" as const,
        clearable: element.default.length === 0,
        urlFormat: element.isRange ? ("repeated" as const) : undefined,
      }
    : undefined

  const [value, setValueWithSource] = useBasicWidgetState<
    string[],
    DateInputProto
  >({
    getStateFromWidgetMgr,
    getDefaultStateFromProto,
    getCurrStateFromProto,
    updateWidgetMgrState,
    element,
    widgetMgr,
    fragmentId,
    queryParamBinding,
    formClearBehavior: "resetValueAndRunCallback",
    onFormCleared: handleFormCleared,
  })

  const {
    colors,
    fontSizes,
    fontWeights,
    lineHeights,
    spacing,
    sizes,
    zIndices,
  } = useEmotionTheme()

  const { locale } = useContext(LibConfigContext)
  const loadedLocale = useIntlLocale(locale)
  const firstDayOfWeek = useFirstDayOfWeek(locale)

  const minDateCalendar = useMemo(() => getMinDate(element), [element])
  const maxDateCalendar = useMemo(() => getMaxCalendarDate(element), [element])

  // Native Date form, needed only for the still-BaseWeb-backed range path's
  // Datepicker props.
  const minDate = useMemo(
    () => minDateCalendar.toDate(getLocalTimeZone()),
    [minDateCalendar]
  )
  const maxDate = useMemo(
    () => maxDateCalendar?.toDate(getLocalTimeZone()),
    [maxDateCalendar]
  )

  const enableQuickSelect = useMemo(() => {
    if (!element.isRange) {
      return false
    }

    // Since quick select allows to select ranges up to the past 2 years,
    // we should only enable it if the min date is older than 2 years ago.
    return isOlderThanTwoYears(minDateCalendar)
  }, [element.isRange, minDateCalendar])

  const clearable = element.default.length === 0 && !disabled

  // We need to extract the mask and format (date-fns notation) from the provided format string
  // The user configured date format is based on the momentJS notation and is only allowed to contain
  // one of YYYY/MM/DD, DD/MM/YYYY, or MM/DD/YYYY" and can also use a period (.) or hyphen (-) as separators.
  // We need to convert the provided format into a mask supported by the Baseweb datepicker
  // Thereby, we need to replace all letters with 9s which refers to any number.
  // Pure string manipulation — no date library needed, kept for the
  // still-BaseWeb-backed range path only.
  // (Using useMemo to avoid recomputing every time for now reason)
  const dateMask = useMemo(
    () => element.format.replaceAll(/[a-zA-Z]/g, "9"),
    [element.format]
  )

  // The Baseweb datepicker supports the date-fns notation for date formatting which is
  // slightly different from the momentJS notation. Therefore, we need to
  // convert the provided format into the date-fns notation, for the range
  // path's Datepicker formatString prop only:
  // (Using useMemo to avoid recomputing every time for now reason)
  const dateFormat = useMemo(
    () => element.format.replaceAll("Y", "y").replaceAll("D", "d"),
    [element.format]
  )

  // Date strings used for error messages — computed via dateInputUtils'
  // CalendarDate-based formatter (matching element.format's Y/M/D order)
  // rather than date-fns, so DateInput.tsx has no date-fns import at all.
  const minDateString = useMemo(
    () => formatCalendarDate(minDateCalendar, element.format),
    [minDateCalendar, element.format]
  )

  const maxDateString = useMemo(
    () =>
      maxDateCalendar
        ? formatCalendarDate(maxDateCalendar, element.format)
        : "",
    [maxDateCalendar, element.format]
  )

  const buildErrorMessage = useCallback(
    (errorType: DateValidationErrorType): string | null =>
      createDateErrorMessage(
        errorType,
        element.isRange,
        minDateString,
        maxDateString
      ),
    [element.isRange, minDateString, maxDateString]
  )

  // Range mode's change handler (still fed by BaseWeb's Datepicker). Dates
  // arrive as native `Date`s; converting to `CalendarDate` immediately (and
  // validating in that space) both drops the moment/date-fns dependency and
  // is what makes the old `normalizeToStartOfDay` workaround unnecessary —
  // see `dateToCalendarDate`'s docstring.
  const handleChange = useCallback(
    ({
      date,
    }: {
      date: Date | (Date | null | undefined)[] | null | undefined
    }): void => {
      resetError()

      if (isNullOrUndefined(date)) {
        setValueWithSource({ value: [], fromUi: true })
        setIsEmpty(true)
        return
      }

      const dates = Array.isArray(date) ? date : [date]
      let errorType: DateValidationErrorType = null
      const newIsoDates: string[] = []
      dates.forEach(d => {
        if (!d) return
        const calendarDate = dateToCalendarDate(d)
        const err = validateDate(
          calendarDate,
          minDateCalendar,
          maxDateCalendar
        )
        if (err) errorType = err
        newIsoDates.push(calendarDateToIso(calendarDate))
      })

      if (errorType) {
        setError(buildErrorMessage(errorType))
      }
      setValueWithSource({ value: newIsoDates, fromUi: true })
      setIsEmpty(newIsoDates.length === 0)
    },
    [
      buildErrorMessage,
      maxDateCalendar,
      minDateCalendar,
      resetError,
      setError,
      setValueWithSource,
    ]
  )

  // Single mode's change handler (fed by SingleDateInput's CalendarDate).
  const handleSingleChange = useCallback(
    (date: CalendarDate | null): void => {
      resetError()

      if (!date) {
        setValueWithSource({ value: [], fromUi: true })
        setIsEmpty(true)
        return
      }

      const errorType = validateDate(date, minDateCalendar, maxDateCalendar)
      if (errorType) {
        setError(buildErrorMessage(errorType))
      }
      setValueWithSource({ value: [calendarDateToIso(date)], fromUi: true })
      setIsEmpty(false)
    },
    [
      buildErrorMessage,
      maxDateCalendar,
      minDateCalendar,
      resetError,
      setError,
      setValueWithSource,
    ]
  )

  // Shared by both modes: revert to the default value if the popover closes
  // while the field is empty. `element.default` is already the ISO wire
  // format, so no conversion is needed here at all (unlike the old
  // `stringsToDates(element.default)` version).
  const handleClose = useCallback((): void => {
    if (!isEmpty && !error) return
    resetError()
    setValueWithSource({ value: element.default, fromUi: true })
    setIsEmpty(element.default.length === 0)
  }, [isEmpty, error, element.default, setValueWithSource, resetError])

  const singleValue = useMemo(
    () => isoToCalendarDate(value[0] ?? "") ?? null,
    [value]
  )

  // Keep the calendar's visible month in sync with `value` even when it
  // changes via direct segment editing rather than through the calendar
  // itself (prev/next, month/year pickers, or clicking a date all drive
  // `focusedValue` via `onFocusChange` already). Without this, e.g. typing
  // "02" into the month segment while the popover is open leaves the
  // calendar showing whatever month it last displayed instead of jumping
  // to February.
  useEffect(() => {
    if (!element.isRange && singleValue) {
      setFocusedValue(singleValue)
    }
  }, [element.isRange, singleValue])

  if (!element.isRange) {
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
            <WidgetLabelHelpIcon
              content={element.help}
              label={element.label}
            />
          )}
        </WidgetLabel>
        <SingleDateInput
          value={singleValue}
          onChange={handleSingleChange}
          minDate={minDateCalendar}
          maxDate={maxDateCalendar}
          format={element.format}
          disabled={disabled}
          clearable={clearable}
          label={element.label}
          error={error}
          locale={locale}
          firstDayOfWeek={firstDayOfWeek}
          isInSidebar={isInSidebar}
          focusedValue={focusedValue}
          onFocusChange={setFocusedValue}
          onClose={handleClose}
        />
      </div>
    )
  }

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
          <WidgetLabelHelpIcon content={element.help} label={element.label} />
        )}
      </WidgetLabel>
      <UIDatePicker
        locale={loadedLocale}
        density={DENSITY.high}
        formatString={dateFormat}
        mask={`${dateMask} – ${dateMask}`}
        placeholder={`${element.format} – ${element.format}`}
        disabled={disabled}
        onChange={handleChange}
        onClose={handleClose}
        quickSelect={enableQuickSelect}
        overrides={{
          Popover: {
            props: {
              ignoreBoundary: isInSidebar,
              placement: PLACEMENT.bottomLeft,
              popoverMargin: convertRemToPx(theme.spacing.twoXS),
              overrides: {
                Body: {
                  style: {
                    ...getPopoverContainerStyle(theme),
                    // Override: zero border in light mode because the
                    // calendar header's shaded background conflicts with
                    // the background-color border trick.
                    ...(hasLightBackgroundColor(theme) && {
                      borderWidth: theme.spacing.none,
                    }),
                  },
                },
              },
            },
          },
          CalendarContainer: {
            style: {
              fontSize: fontSizes.sm,
              paddingRight: spacing.xs,
              paddingLeft: spacing.xs,
              paddingBottom: spacing.xs,
              paddingTop: spacing.xs,
              // Remove default border
              borderWidth: theme.spacing.none,
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
              // $isHighlighted: Day is highlighted via mouse hover or keyboard navigation.
              $pseudoHighlighted,
              $pseudoSelected,
              $selected,
              $isHovered,
              $isHighlighted,
            }: {
              $pseudoHighlighted: boolean
              $pseudoSelected: boolean
              $selected: boolean
              $isHovered: boolean
              $isHighlighted: boolean
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
                // BaseWeb renders a ring border on ::after for all days by default.
                // Suppress it normally; restore it only when the day is highlighted
                // (hovered or keyboard-navigated) to show the hover ring indicator.
                borderColor: $isHighlighted
                  ? colors.primary
                  : colors.transparent,
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
                  <Icon content={ErrorOutline} size="base" />
                </Tooltip>
              ),

              overrides: {
                EndEnhancer: {
                  style: {
                    // Match text color with st.error in light and dark mode
                    color: colors.redTextColor,
                    backgroundColor: colors.transparent,
                  },
                },
                Root: {
                  style: ({ $isFocused }: { $isFocused: boolean }) => {
                    const borderColor = getBorderColor(colors, $isFocused)
                    return {
                      // Baseweb requires long-hand props, short-hand leads to weird bugs & warnings.
                      borderLeftWidth: sizes.borderWidth,
                      borderRightWidth: sizes.borderWidth,
                      borderTopWidth: sizes.borderWidth,
                      borderBottomWidth: sizes.borderWidth,
                      paddingRight: spacing.twoXS,

                      borderTopColor: borderColor,
                      borderRightColor: borderColor,
                      borderBottomColor: borderColor,
                      borderLeftColor: borderColor,

                      // Baseweb has an error prop for the input, but its coloring doesn't reconcile
                      // with our dark theme - we handle error state coloring manually here
                      ...(error && {
                        backgroundColor: colors.redBackgroundColor,
                      }),
                    }
                  },
                },
                ClearIcon: {
                  props: {
                    overrides: {
                      Svg: {
                        style: {
                          color: colors.grayTextColor,
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
                    // Input overlays Placeholder - position relative + zIndex ensures
                    // input is clickable above the absolutely positioned placeholder
                    position: "relative",
                    zIndex: zIndices.priority,
                    fontWeight: fontWeights.normal,
                    // Baseweb requires long-hand props, short-hand leads to weird bugs & warnings.
                    paddingRight: spacing.sm,
                    paddingLeft: `calc(${spacing.sm} + ${sizes.tagMarginInsideBorder})`,
                    paddingBottom: spacing.sm,
                    paddingTop: spacing.sm,
                    lineHeight: lineHeights.inputWidget,

                    "::placeholder": {
                      color: colors.fadedText60,
                    },

                    // Change input value text color in error state - matches st.error in light and dark mode
                    ...(error && {
                      color: colors.redTextColor,
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
                    height: sizes.minElementHeight,
                    // Baseweb requires long-hand props, short-hand leads to weird bugs & warnings.
                    borderLeftWidth: sizes.borderWidth,
                    borderRightWidth: sizes.borderWidth,
                    borderTopWidth: sizes.borderWidth,
                    borderBottomWidth: sizes.borderWidth,
                  },
                },
              },
            },
          },
        }}
        value={stringsToDates(value)}
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
): string[] | undefined {
  return widgetMgr.getStringArrayValue(element)
}

function getDefaultStateFromProto(element: DateInputProto): string[] {
  return element.default ?? []
}

function getCurrStateFromProto(element: DateInputProto): string[] {
  return element.value ?? []
}

function updateWidgetMgrState(
  element: DateInputProto,
  widgetMgr: WidgetStateManager,
  vws: ValueWithSource<string[]>,
  fragmentId: string | undefined
): void {
  const minDate = getMinDate(element)
  const maxDate = getMaxCalendarDate(element)

  // Check if date(s) outside of allowed min/max. Invalid values are never
  // written to WidgetStateManager — they still show an error tooltip (via
  // the local `error` state above) but must not reach the backend.
  const isValid = (vws.value || []).every(iso => {
    const calendarDate = isoToCalendarDate(iso)
    return !calendarDate || !validateDate(calendarDate, minDate, maxDate)
  })

  if (isValid) {
    widgetMgr.setStringArrayValue(
      element,
      vws.value,
      { fromUi: vws.fromUi },
      fragmentId
    )
  }
}

export default memo(DateInput)
