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
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { ErrorOutline } from "@emotion-icons/material-outlined"
import { DENSITY, Datepicker as UIDatePicker } from "baseui/datepicker"
import type DatepickerClass from "baseui/datepicker/datepicker"
import { ChevronDown } from "baseui/icon"
import { PLACEMENT } from "baseui/popover"
import { format } from "date-fns"
import moment from "moment"

import { DatetimeInput as DatetimeInputProto } from "@streamlit/protobuf"

import IsSidebarContext from "~lib/components/core/IsSidebarContext"
import { LibConfigContext } from "~lib/components/core/LibConfigContext"
import { getBorderColor } from "~lib/components/shared/Base/styled-components"
import Icon from "~lib/components/shared/Icon"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown"
import Tooltip, { Placement } from "~lib/components/shared/Tooltip"
import TooltipIcon from "~lib/components/shared/TooltipIcon"
import {
  StyledWidgetLabelHelp,
  WidgetLabel,
} from "~lib/components/widgets/BaseWidget"
import { useIntlLocale } from "~lib/components/widgets/DateInput/useIntlLocale"
import { StyledTimeDropdownListItem } from "~lib/components/widgets/TimeInput/styled-components"
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

export interface Props {
  disabled: boolean
  element: DatetimeInputProto
  widgetMgr: WidgetStateManager
  fragmentId?: string
}

const DATETIME_PROTO_FORMAT = "YYYY/MM/DD HH:mm:ss"

function DatetimeInput({
  disabled,
  element,
  widgetMgr,
  fragmentId,
}: Props): ReactElement {
  const theme = useEmotionTheme()
  const isInSidebar = useContext(IsSidebarContext)
  const datepickerRef = useRef<DatepickerClass<Date> | null>(null)

  const [value, setValueWithSource] = useBasicWidgetState<
    string | null,
    DatetimeInputProto
  >({
    getStateFromWidgetMgr,
    getDefaultStateFromProto,
    getCurrStateFromProto,
    updateWidgetMgrState,
    element,
    widgetMgr,
    fragmentId,
  })

  const [error, setError] = useState<string | null>(null)

  const { locale } = useContext(LibConfigContext)
  const loadedLocale = useIntlLocale(locale)

  const minDate = useMemo(
    () => moment(element.min, DATETIME_PROTO_FORMAT).toDate(),
    [element.min]
  )
  const maxDate = useMemo(
    () => moment(element.max, DATETIME_PROTO_FORMAT).toDate(),
    [element.max]
  )

  const clearable = !element.default && !disabled
  const committedDate = useMemo(() => stringToDate(value), [value])
  const [pendingDate, setPendingDate] = useState<Date | null>(committedDate)

  useEffect(() => {
    setPendingDate(committedDate)
  }, [committedDate])

  const dateMask = useMemo(() => {
    const datePartMask = element.format.replaceAll(/[a-zA-Z]/g, "9")
    return `${datePartMask}, 99:99`
  }, [element.format])

  const dateFormat = useMemo(
    () => `${element.format.replaceAll("Y", "y").replaceAll("D", "d")}, HH:mm`,
    [element.format]
  )

  const placeholder = useMemo(
    () => `${element.format}, HH:MM`,
    [element.format]
  )

  const minDateString = useMemo(
    () => format(minDate, dateFormat, { locale: loadedLocale }),
    [minDate, dateFormat, loadedLocale]
  )
  const maxDateString = useMemo(
    () => format(maxDate, dateFormat, { locale: loadedLocale }),
    [maxDate, dateFormat, loadedLocale]
  )

  const timeSelectOverrides = useMemo(
    () => ({
      Select: {
        props: {
          disabled,
          overrides: {
            ControlContainer: {
              style: ({ $isFocused }: { $isFocused: boolean }) => {
                const borderColor = getBorderColor(theme.colors, $isFocused)
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
              style: {
                paddingRight: theme.spacing.sm,
              },
            },
            ValueContainer: {
              style: {
                lineHeight: theme.lineHeights.inputWidget,
                paddingRight: theme.spacing.sm,
                paddingLeft: theme.spacing.md,
                paddingBottom: theme.spacing.sm,
                paddingTop: theme.spacing.sm,
              },
            },
            SingleValue: {
              style: {
                fontWeight: theme.fontWeights.normal,
              },
            },
            Dropdown: {
              style: {
                paddingTop: theme.spacing.none,
                paddingBottom: theme.spacing.none,
                boxShadow: "none",
                maxHeight: theme.sizes.maxDropdownHeight,
              },
            },
            DropdownListItem: {
              component: StyledTimeDropdownListItem,
            },
            Popover: {
              props: {
                ignoreBoundary: isInSidebar,
                overrides: {
                  Body: {
                    style: {
                      marginTop: theme.spacing.px,
                    },
                  },
                },
              },
            },
            Placeholder: {
              style: {
                color: theme.colors.fadedText60,
              },
            },
            SelectArrow: {
              component: ChevronDown,
              props: {
                overrides: {
                  Svg: {
                    style: {
                      width: theme.iconSizes.xl,
                      height: theme.iconSizes.xl,
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
    [disabled, isInSidebar, theme]
  )

  const createErrorMessage = useCallback(
    (errorType: "min" | "max" | null): string | null => {
      if (!errorType) {
        return null
      }

      const direction = errorType === "min" ? "after" : "before"
      const boundary = errorType === "min" ? minDateString : maxDateString
      return `**Error**: Datetime set outside allowed range. Please select a datetime ${direction} ${boundary}.`
    },
    [minDateString, maxDateString]
  )

  const stepSeconds = element.step || 900

  const handleChange = useCallback(
    ({
      date,
    }: {
      date: Date | (Date | null | undefined)[] | null | undefined
    }): void => {
      setError(null)

      if (isNullOrUndefined(date)) {
        setPendingDate(null)
        return
      }

      const nextDate = Array.isArray(date) ? date[0] : date
      if (!nextDate) {
        setPendingDate(null)
        return
      }

      const normalizedDate = normalizeToMinute(nextDate)
      const snappedDate = snapToStep(normalizedDate, stepSeconds)
      const errorType = validateDatetime(snappedDate, minDate, maxDate)

      if (errorType) {
        setError(createErrorMessage(errorType))
      }

      setPendingDate(snappedDate)

      datepickerRef.current?.open?.()
    },
    [createErrorMessage, maxDate, minDate, stepSeconds]
  )

  const handleClose = useCallback((): void => {
    const nextValue = pendingDate ? dateToString(pendingDate) : null
    const hasChanged = nextValue !== value

    if (hasChanged) {
      setValueWithSource({
        value: nextValue,
        fromUi: true,
      })
    }
  }, [pendingDate, setValueWithSource, value])

  return (
    <div className="stDatetimeInput" data-testid="stDatetimeInput">
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
        ref={datepickerRef}
        locale={loadedLocale}
        density={DENSITY.high}
        formatString={dateFormat}
        mask={dateMask}
        placeholder={placeholder}
        disabled={disabled}
        onChange={handleChange}
        onClose={handleClose}
        clearable={clearable}
        value={pendingDate}
        minDate={minDate}
        maxDate={maxDate}
        timeSelectStart
        aria-label={element.label}
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
          TimeSelectFormControl: {
            props: {
              label: "",
            },
          },
          TimeSelect: {
            props: {
              format: "24",
              overrides: timeSelectOverrides,
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
            }: Record<string, boolean>) => ({
              fontSize: theme.fontSizes.sm,
              lineHeight: theme.lineHeights.base,

              "::before": {
                backgroundColor:
                  $selected ||
                  $pseudoSelected ||
                  $pseudoHighlighted ||
                  $isHovered
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
            style: {
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
            },
          },
          Input: {
            props: {
              maskChar: null,
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
                    color: theme.colors.redTextColor,
                    backgroundColor: theme.colors.transparent,
                  },
                },
                Root: {
                  style: ({ $isFocused }: { $isFocused: boolean }) => {
                    const borderColor = getBorderColor(
                      theme.colors,
                      $isFocused
                    )
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
                      ...(error && {
                        backgroundColor: theme.colors.redBackgroundColor,
                      }),
                    }
                  },
                },
                InputContainer: {
                  style: {
                    backgroundColor: theme.colors.transparent,
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
                    ...(error && {
                      color: theme.colors.redTextColor,
                    }),
                  },
                  props: {
                    "data-testid": "stDatetimeInputField",
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
              },
            },
          },
        }}
      />
    </div>
  )
}

function getStateFromWidgetMgr(
  widgetMgr: WidgetStateManager,
  element: DatetimeInputProto
): string | null {
  return widgetMgr.getStringValue(element) ?? (element.default || null)
}

function getDefaultStateFromProto(element: DatetimeInputProto): string | null {
  return element.default || null
}

function getCurrStateFromProto(element: DatetimeInputProto): string | null {
  return element.value || null
}

function updateWidgetMgrState(
  element: DatetimeInputProto,
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

function dateToString(date: Date): string {
  return moment(date).format(DATETIME_PROTO_FORMAT)
}

function stringToDate(value: string | null): Date | null {
  if (!value) {
    return null
  }
  return moment(value, DATETIME_PROTO_FORMAT).toDate()
}

function normalizeToMinute(date: Date): Date {
  const normalized = new Date(date.getTime())
  normalized.setSeconds(0, 0)
  return normalized
}

function snapToStep(date: Date, stepSeconds: number): Date {
  if (stepSeconds <= 0) {
    return date
  }

  const snappedTimestamp =
    Math.floor(date.getTime() / (stepSeconds * 1000)) * stepSeconds * 1000
  return new Date(snappedTimestamp)
}

function validateDatetime(
  date: Date,
  minDate: Date,
  maxDate: Date
): "min" | "max" | null {
  if (date < minDate) {
    return "min"
  }
  if (date > maxDate) {
    return "max"
  }
  return null
}

export default memo(DatetimeInput)
