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
} from "react"

import { Datepicker as UIDatePicker } from "baseui/datepicker"
import { PLACEMENT } from "baseui/popover"
import moment from "moment"

import { DateTimeInput as DateTimeInputProto } from "@streamlit/protobuf"

import IsSidebarContext from "~lib/components/core/IsSidebarContext"
import { getBorderColor } from "~lib/components/shared/Base/styled-components"
import { Placement } from "~lib/components/shared/Tooltip"
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

import { StyledTimeDropdownListItem } from "src/components/widgets/TimeInput/styled-components"

const DATE_FORMAT = "YYYY/MM/DD"
const DATE_TIME_FORMAT = "YYYY/MM/DD HH:mm"

export interface Props {
  disabled: boolean
  element: DateTimeInputProto
  widgetMgr: WidgetStateManager
  fragmentId?: string
}

function DateTimeInput({
  disabled,
  element,
  widgetMgr,
  fragmentId,
}: Props): ReactElement {
  const [value, setValueWithSource] = useBasicWidgetState<
    string | null,
    DateTimeInputProto
  >({
    getStateFromWidgetMgr,
    getDefaultStateFromProto,
    getCurrStateFromProto,
    updateWidgetMgrState,
    element,
    widgetMgr,
    fragmentId,
  })

  const theme = useEmotionTheme()
  const isInSidebar = useContext(IsSidebarContext)

  const step = useMemo(
    () => (element.step ? Number(element.step) : 900),
    [element.step]
  )

  const minDateTime = useMemo(() => stringsToDate(element.min), [element.min])
  const maxDateTime = useMemo(() => stringsToDate(element.max), [element.max])

  const selectedDate = useMemo(() => stringToDate(value), [value])

  const minDate = useMemo(() => minDateTime ?? undefined, [minDateTime])
  const maxDate = useMemo(() => maxDateTime ?? undefined, [maxDateTime])

  const minTimeForSelection = useMemo(() => {
    if (!selectedDate || !minDateTime) {
      return undefined
    }

    return isSameDay(selectedDate, minDateTime)
      ? combineDateAndTime(selectedDate, minDateTime)
      : undefined
  }, [selectedDate, minDateTime])

  const maxTimeForSelection = useMemo(() => {
    if (!selectedDate || !maxDateTime) {
      return undefined
    }

    return isSameDay(selectedDate, maxDateTime)
      ? combineDateAndTime(selectedDate, maxDateTime)
      : undefined
  }, [selectedDate, maxDateTime])

  const dateMask = useMemo(
    () => element.format.replaceAll(/[a-zA-Z]/g, "9"),
    [element.format]
  )

  const dateFormat = useMemo(
    () => element.format.replaceAll("Y", "y").replaceAll("D", "d"),
    [element.format]
  )

  const formatString = useMemo(() => `${dateFormat} HH:mm`, [dateFormat])

  const mask = useMemo(() => `${dateMask} 99:99`, [dateMask])

  const placeholder = useMemo(
    () => `${element.format} HH:MM`,
    [element.format]
  )

  const defaultValue = element.default ?? ""
  const clearable = defaultValue.length === 0 && !disabled

  const handleChange = useCallback(
    ({
      date,
    }: {
      date: Date | (Date | null | undefined)[] | null | undefined
    }): void => {
      const normalizedDate = normalizeDateValue(date)
      const newValue = normalizedDate
        ? moment(normalizedDate).format(DATE_TIME_FORMAT)
        : null

      setValueWithSource({ value: newValue, fromUi: true })
    },
    [setValueWithSource]
  )

  const inputOverrides = useMemo(
    () => ({
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
          fontSize: theme.fontSizes.sm,
          paddingRight: theme.spacing.sm,
          paddingLeft: theme.spacing.sm,
          paddingBottom: theme.spacing.sm,
          paddingTop: theme.spacing.sm,
        },
      },
      Week: {
        style: {
          fontSize: theme.fontSizes.sm,
        },
      },
      Day: {
        style: ({
          $pseudoHighlighted,
          $pseudoSelected,
          $selected,
          $isHovered,
        }: {
          $pseudoHighlighted: boolean
          $pseudoSelected: boolean
          $selected: boolean
          $isHovered: boolean
        }) => ({
          fontSize: theme.fontSizes.sm,
          lineHeight: theme.lineHeights.base,
          "::before": {
            backgroundColor:
              $selected || $pseudoSelected || $pseudoHighlighted || $isHovered
                ? `${theme.colors.darkenedBgMix15} !important`
                : theme.colors.transparent,
          },
          "::after": {
            borderColor: theme.colors.transparent,
          },
          ...(hasLightBackgroundColor(theme) &&
          $isHovered &&
          $pseudoSelected &&
          !$selected
            ? {
                color: theme.colors.secondaryBg,
              }
            : {}),
        }),
      },
      PrevButton: {
        style: () => ({
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          ":active": {
            backgroundColor: theme.colors.transparent,
          },
          ":focus": {
            backgroundColor: theme.colors.transparent,
            outline: 0,
          },
        }),
      },
      NextButton: {
        style: () => ({
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          ":active": {
            backgroundColor: theme.colors.transparent,
          },
          ":focus": {
            backgroundColor: theme.colors.transparent,
            outline: 0,
          },
        }),
      },
      Input: {
        props: {
          maskChar: null,
          overrides: {
            EndEnhancer: {
              style: {
                color: theme.colors.grayTextColor,
                backgroundColor: theme.colors.transparent,
              },
            },
            Root: {
              style: ({ $isFocused }: { $isFocused: boolean }) => {
                const borderColor = getBorderColor(theme.colors, $isFocused)
                return {
                  borderLeftWidth: theme.sizes.borderWidth,
                  borderRightWidth: theme.sizes.borderWidth,
                  borderTopWidth: theme.sizes.borderWidth,
                  borderBottomWidth: theme.sizes.borderWidth,
                  paddingRight: theme.spacing.twoXS,
                  borderTopColor: borderColor,
                  borderRightColor: borderColor,
                  borderBottomColor: borderColor,
                  borderLeftColor: borderColor,
                }
              },
            },
            ClearIcon: {
              props: {
                overrides: {
                  Svg: {
                    style: {
                      color: theme.colors.grayTextColor,
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
            InputContainer: {
              style: {
                backgroundColor: "transparent",
              },
            },
            Input: {
              style: {
                fontWeight: theme.fontWeights.normal,
                paddingRight: theme.spacing.sm,
                paddingLeft: theme.spacing.md,
                paddingBottom: theme.spacing.sm,
                paddingTop: theme.spacing.sm,
                lineHeight: theme.lineHeights.inputWidget,
                "::placeholder": {
                  color: theme.colors.fadedText60,
                },
              },
              props: {
                "data-testid": "stDateTimeInputField",
              },
            },
          },
        },
      },
      TimeSelectContainer: {
        style: {
          paddingTop: theme.spacing.sm,
          paddingBottom: theme.spacing.none,
        },
      },
      TimeSelectFormControl: {
        style: {
          marginBottom: theme.spacing.none,
        },
      },
      TimeSelect: {
        props: {
          step,
          format: "24" as const,
          disabled,
          nullable: clearable,
          minTime: minTimeForSelection,
          maxTime: maxTimeForSelection,
          overrides: {
            Select: {
              props: {
                disabled,
                overrides: {
                  ControlContainer: {
                    style: ({ $isFocused }: { $isFocused: boolean }) => {
                      const borderColor = getBorderColor(
                        theme.colors,
                        $isFocused
                      )
                      return {
                        height: theme.sizes.minElementHeight,
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
                      lineHeight: theme.lineHeights.inputWidget,
                      paddingRight: theme.spacing.sm,
                      paddingLeft: theme.spacing.md,
                      paddingBottom: theme.spacing.sm,
                      paddingTop: theme.spacing.sm,
                    }),
                  },
                  Dropdown: {
                    style: () => ({
                      paddingTop: theme.spacing.none,
                      paddingBottom: theme.spacing.none,
                      boxShadow: "none",
                      maxHeight: theme.sizes.maxDropdownHeight,
                    }),
                  },
                  DropdownListItem: {
                    component: StyledTimeDropdownListItem,
                  },
                },
              },
            },
          },
        },
      },
    }),
    [
      theme,
      isInSidebar,
      step,
      minTimeForSelection,
      maxTimeForSelection,
      disabled,
      clearable,
    ]
  )

  return (
    <div className="stDateTimeInput" data-testid="stDateTimeInput">
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
        value={selectedDate ?? null}
        onChange={handleChange}
        minDate={minDate}
        maxDate={maxDate}
        disabled={disabled}
        timeSelectStart
        formatString={formatString}
        mask={mask}
        placeholder={placeholder}
        clearable={clearable}
        overrides={inputOverrides}
        aria-label={element.label}
      />
    </div>
  )
}

function getStateFromWidgetMgr(
  widgetMgr: WidgetStateManager,
  element: DateTimeInputProto
): string | null {
  return widgetMgr.getStringValue(element) ?? null
}

function getDefaultStateFromProto(element: DateTimeInputProto): string | null {
  return element.default?.length ? element.default : null
}

function getCurrStateFromProto(element: DateTimeInputProto): string | null {
  return element.value?.length ? element.value : null
}

function updateWidgetMgrState(
  element: DateTimeInputProto,
  widgetMgr: WidgetStateManager,
  vws: ValueWithSource<string | null>,
  fragmentId?: string
): void {
  widgetMgr.setStringValue(
    element,
    vws.value,
    { fromUi: vws.fromUi },
    fragmentId
  )
}

function stringToDate(value: string | null): Date | null {
  if (isNullOrUndefined(value) || value === "") {
    return null
  }
  const parsed = moment(value, DATE_TIME_FORMAT, true)
  if (!parsed.isValid()) {
    return null
  }
  const dateValue = parsed.toDate()
  dateValue.setSeconds(0, 0)
  return dateValue
}

function stringsToDate(value: string | undefined): Date | null {
  if (!value) {
    return null
  }
  const parsed = moment(value, DATE_TIME_FORMAT, true)
  if (!parsed.isValid()) {
    return null
  }
  const dateValue = parsed.toDate()
  dateValue.setSeconds(0, 0)
  return dateValue
}

function normalizeDateValue(
  date: Date | (Date | null | undefined)[] | null | undefined
): Date | null {
  if (Array.isArray(date)) {
    const firstValid = date.find((d): d is Date => d instanceof Date)
    return normalizeSingleDate(firstValid)
  }
  return normalizeSingleDate(date)
}

function normalizeSingleDate(date: Date | null | undefined): Date | null {
  if (!date || Number.isNaN(date.getTime())) {
    return null
  }
  const normalized = new Date(date.getTime())
  normalized.setSeconds(0, 0)
  return normalized
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function combineDateAndTime(dateValue: Date, timeSource: Date): Date {
  const merged = new Date(dateValue.getTime())
  merged.setHours(timeSource.getHours(), timeSource.getMinutes(), 0, 0)
  return merged
}

export default memo(DateTimeInput)
