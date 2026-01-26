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
import { EmotionTheme, hasLightBackgroundColor } from "~lib/theme"

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
}: CreateDateTimePickerOverridesArgs): DateTimePickerOverrides => ({
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
      paddingBottom: theme.spacing.none,
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
              SingleValue: {
                style: {
                  fontWeight: theme.fontWeights.normal,
                },
                props: {
                  "data-testid": "stDateTimeInputTimeDisplay",
                },
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
              Popover: {
                props: {
                  ignoreBoundary: isInSidebar,
                  overrides: {
                    Body: {
                      style: () => ({
                        marginTop: theme.spacing.px,
                      }),
                    },
                  },
                },
              },
              Placeholder: {
                style: () => ({
                  color: theme.colors.fadedText60,
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
})
