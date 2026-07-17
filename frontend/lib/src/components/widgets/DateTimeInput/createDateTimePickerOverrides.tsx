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

import {
  getBorderColor,
  getPopoverContainerStyle,
} from "~lib/components/shared/Base/styled-components"
import { createHighlightListItem } from "~lib/components/shared/Highlight/createHighlightListItem"
import Icon from "~lib/components/shared/Icon/Icon"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown/StreamlitMarkdown"
import Tooltip, { Placement } from "~lib/components/shared/Tooltip/Tooltip"
import { StyledTimeDropdownListItem } from "~lib/components/widgets/TimeInput/styled-components"
import { hasLightBackgroundColor } from "~lib/theme/getColors"
import type { EmotionTheme } from "~lib/theme/types"
import { convertRemToPx } from "~lib/theme/utils"

const TimeDropdownListItem = createHighlightListItem(
  StyledTimeDropdownListItem
)

type DateTimePickerOverrides = NonNullable<DatepickerProps<Date>["overrides"]>

interface CreateDateTimePickerOverridesArgs {
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
        fontSize: theme.fontSizes.sm,
        paddingRight: theme.spacing.xs,
        paddingLeft: theme.spacing.xs,
        paddingBottom: theme.spacing.none,
        paddingTop: theme.spacing.xs,
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
        $isHighlighted,
      }: {
        $pseudoHighlighted: boolean
        $pseudoSelected: boolean
        $selected: boolean
        $isHovered: boolean
        $isHighlighted: boolean
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
          // BaseWeb renders a ring border on ::after for all days by default.
          // Suppress it normally; restore it only when the day is highlighted
          // (hovered or keyboard-navigated) to show the hover ring indicator.
          borderColor: $isHighlighted
            ? theme.colors.primary
            : theme.colors.transparent,
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
            <Icon content={ErrorOutline} size="base" />
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
              paddingLeft: `calc(${theme.spacing.sm} + ${theme.sizes.tagMarginInsideBorder})`,
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
                    paddingLeft: `calc(${theme.spacing.sm} + ${theme.sizes.tagMarginInsideBorder})`,
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
                  style: () => ({
                    paddingTop: theme.spacing.none,
                    paddingBottom: theme.spacing.none,
                    paddingLeft: theme.spacing.none,
                    paddingRight: theme.spacing.none,
                    // Shadow is on DropdownContainer, remove from dropdown
                    boxShadow: "none",
                    // Dropdown handles scrolling so baseui can scroll to
                    // the selected item on open via its rootRef
                    maxHeight: `min(${theme.sizes.maxDropdownHeight}, 70vh)`,
                    // Pass scrollbar gutter size to children via CSS custom property
                    "--scrollbar-gutter-size": hasScrollbar
                      ? `${scrollbarGutterSize}px`
                      : "0px",
                  }),
                },
                DropdownContainer: {
                  style: () => ({
                    ...getPopoverContainerStyle(theme),

                    // Clip children (scrollbar) to border-radius
                    overflow: "hidden",
                  }),
                },
                DropdownListItem: {
                  component: TimeDropdownListItem,
                },
                Popover: {
                  props: {
                    ignoreBoundary: isInSidebar,
                    popoverMargin: convertRemToPx(theme.spacing.twoXS),
                    overrides: {
                      Body: {
                        style: () => ({
                          overflow: "hidden",
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
                Input: {
                  style: {
                    // Input overlays Placeholder - position relative + zIndex ensures
                    // input is clickable above the absolutely positioned placeholder
                    position: "relative",
                    zIndex: theme.zIndices.priority,
                  },
                },
                SelectArrow: {
                  component: ChevronDown,
                  props: {
                    overrides: {
                      Svg: {
                        style: () => ({
                          width: theme.iconSizes.lg,
                          height: theme.iconSizes.lg,
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
