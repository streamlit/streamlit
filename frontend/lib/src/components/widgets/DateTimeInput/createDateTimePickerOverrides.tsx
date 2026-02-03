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

import { ErrorOutline } from "@emotion-icons/material-outlined"
import type { DatepickerProps } from "baseui/datepicker"
import { ChevronDown } from "baseui/icon"
import { PLACEMENT } from "baseui/popover"

import { getBorderColor } from "~lib/components/shared/Base/styled-components"
import Icon from "~lib/components/shared/Icon"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown"
import Tooltip, { Placement } from "~lib/components/shared/Tooltip"
import { StyledTimeDropdownListItem } from "~lib/components/widgets/TimeInput/styled-components"
import {
  convertRemToPx,
  EmotionTheme,
  hasLightBackgroundColor,
} from "~lib/theme"

type DateTimePickerOverrides = NonNullable<DatepickerProps<Date>["overrides"]>

export interface CreateDateTimePickerOverridesArgs {
  theme: EmotionTheme
  isInSidebar: boolean
  step: number
  minTime?: Date
  maxTime?: Date
  disabled: boolean
  clearable: boolean
  error: string | null
  scrollbarGutterSize: number
  windowHeight: number
}

export const createDateTimePickerOverrides = ({
  theme,
  isInSidebar,
  step,
  minTime,
  maxTime,
  disabled,
  clearable,
  error,
  scrollbarGutterSize,
  windowHeight,
}: CreateDateTimePickerOverridesArgs): DateTimePickerOverrides => {
  const lightBackground = hasLightBackgroundColor(theme)

  // Calculate if the time dropdown will have a scrollbar
  const numTimeOptions = Math.ceil(86400 / step) // 86400 seconds in a day
  const itemHeight = convertRemToPx(theme.sizes.dropdownItemHeight)
  const maxDropdownHeight = Math.min(
    convertRemToPx(theme.sizes.maxDropdownHeight),
    windowHeight * 0.7 // 70vh constraint on popover body
  )
  const hasScrollbar = numTimeOptions * itemHeight > maxDropdownHeight

  return {
    Popover: {
      props: {
        ignoreBoundary: isInSidebar,
        placement: PLACEMENT.bottomLeft,
        popoverMargin: convertRemToPx(theme.spacing.twoXS),
        overrides: {
          Body: {
            style: {
              boxSizing: "border-box",

              borderTopLeftRadius: theme.radii.default,
              borderTopRightRadius: theme.radii.default,
              borderBottomRightRadius: theme.radii.default,
              borderBottomLeftRadius: theme.radii.default,

              // No border in light mode, border in dark mode
              borderWidth: lightBackground
                ? theme.spacing.none
                : theme.sizes.borderWidth,
              borderStyle: "solid",
              borderColor: theme.colors.borderColor,

              // Only show shadow in light mode
              boxShadow: lightBackground
                ? theme.shadows.popover
                : theme.shadows.none,
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
        paddingBottom: theme.spacing.none,
        paddingTop: theme.spacing.sm,
        // Remove default border
        borderWidth: theme.spacing.none,
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
        endEnhancer: error && (
          <Tooltip
            content={<StreamlitMarkdown source={error} allowHTML={false} />}
            placement={Placement.TOP_RIGHT}
            error
          >
            <Icon content={ErrorOutline} size="lg" />
          </Tooltip>
        ),
        overrides: {
          EndEnhancer: {
            style: {
              color: error
                ? theme.colors.redTextColor
                : theme.colors.grayTextColor,
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
                ...(error && {
                  backgroundColor: theme.colors.redBackgroundColor,
                }),
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
              paddingLeft: `calc(${theme.spacing.sm} + ${theme.spacing.xs} - ${theme.sizes.borderWidth})`,
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
              "data-testid": "stDateTimeInputField",
            },
          },
        },
      },
    },
    TimeSelectContainer: {
      style: {
        paddingTop: theme.spacing.none,
        paddingBottom: theme.spacing.none,
      },
    },
    TimeSelectFormControl: {
      style: {
        marginBottom: theme.spacing.none,
      },
      props: {
        overrides: {
          Label: {
            component: () => null,
          },
        },
      },
    },
    TimeSelect: {
      props: {
        step,
        format: "24" as const,
        disabled,
        nullable: clearable,
        minTime,
        maxTime,
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
                    paddingLeft: `calc(${theme.spacing.sm} + ${theme.spacing.xs} - ${theme.sizes.borderWidth})`,
                    paddingBottom: theme.spacing.sm,
                    paddingTop: theme.spacing.sm,
                  }),
                },
                SingleValue: {
                  style: {
                    fontWeight: theme.fontWeights.normal,
                    // Remove left margin that used to offset input (2px)
                    marginLeft: theme.spacing.none,
                  },
                  props: {
                    "data-testid": "stDateTimeInputTimeDisplay",
                  },
                },
                Dropdown: {
                  style: () =>
                    ({
                      paddingTop: theme.spacing.none,
                      paddingBottom: theme.spacing.none,
                      paddingLeft: theme.spacing.none,
                      paddingRight: theme.spacing.none,
                      boxShadow: "none",
                      maxHeight: theme.sizes.maxDropdownHeight,
                      // Pass scrollbar gutter size to children via CSS custom property
                      "--scrollbar-gutter-size": hasScrollbar
                        ? `${scrollbarGutterSize}px`
                        : "0px",
                    }) as React.CSSProperties,
                },
                DropdownContainer: {
                  style: ({ $width }: { $width: number | null }) => {
                    // Subtract border width from both sides
                    const borderAdjustment =
                      2 * parseFloat(theme.sizes.borderWidth)
                    return {
                      width: $width
                        ? `${$width - borderAdjustment}px`
                        : undefined,
                    }
                  },
                },
                DropdownListItem: {
                  component: StyledTimeDropdownListItem,
                },
                Popover: {
                  props: {
                    ignoreBoundary: isInSidebar,
                    popoverMargin: convertRemToPx(theme.spacing.twoXS),
                    overrides: {
                      Body: {
                        style: () => ({
                          maxHeight: "70vh",
                          overflow: "auto",
                          boxSizing: "border-box",

                          borderTopLeftRadius: theme.radii.default,
                          borderTopRightRadius: theme.radii.default,
                          borderBottomRightRadius: theme.radii.default,
                          borderBottomLeftRadius: theme.radii.default,

                          borderWidth: theme.sizes.borderWidth,
                          borderStyle: "solid",
                          borderColor: lightBackground
                            ? theme.colors.bgColor
                            : theme.colors.borderColor,

                          // Only show shadow in light mode
                          boxShadow: lightBackground
                            ? theme.shadows.popover
                            : theme.shadows.none,
                        }),
                      },
                    },
                  },
                },
                Placeholder: {
                  style: () => ({
                    color: theme.colors.fadedText60,
                    // Position absolute so Input can overlay it
                    position: "absolute",
                  }),
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
        },
      },
    },
  }
}
