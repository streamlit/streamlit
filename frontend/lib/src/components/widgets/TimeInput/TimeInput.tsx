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

import { memo, ReactElement, useCallback, useContext } from "react"

import { ChevronDown } from "baseui/icon"
import { StyledClearIcon } from "baseui/input/styled-components"
import { TimePicker as UITimePicker } from "baseui/timepicker"

import { TimeInput as TimeInputProto } from "@streamlit/protobuf"

import IsSidebarContext from "~lib/components/core/IsSidebarContext"
import {
  getBorderColor,
  getPopoverContainerStyle,
} from "~lib/components/shared/Base/styled-components"
import { createHighlightListItem } from "~lib/components/shared/Highlight"
import { useWindowDimensionsContext } from "~lib/components/shared/WindowDimensions/useWindowDimensionsContext"
import {
  WidgetLabel,
  WidgetLabelHelpIcon,
} from "~lib/components/widgets/BaseWidget"
import {
  useBasicWidgetState,
  ValueWithSource,
} from "~lib/hooks/useBasicWidgetState"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { useScrollbarGutterSize } from "~lib/hooks/useScrollbarGutterSize"
import { convertRemToPx } from "~lib/theme"
import {
  isNullOrUndefined,
  labelVisibilityProtoValueToEnum,
} from "~lib/util/utils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import {
  StyledClearIconContainer,
  StyledTimeDropdownListItem,
} from "./styled-components"

const TimeDropdownListItem = createHighlightListItem(
  StyledTimeDropdownListItem
)

export interface Props {
  disabled: boolean
  element: TimeInputProto
  widgetMgr: WidgetStateManager
  fragmentId?: string
}

function TimeInput({
  disabled,
  element,
  widgetMgr,
  fragmentId,
}: Props): ReactElement {
  const [value, setValueWithSource] = useBasicWidgetState<
    string | null,
    TimeInputProto
  >({
    getStateFromWidgetMgr,
    getDefaultStateFromProto,
    getCurrStateFromProto,
    updateWidgetMgrState,
    element,
    widgetMgr,
    fragmentId,
    formClearBehavior: "resetValueOnly",
  })
  const isInSidebar = useContext(IsSidebarContext)
  const theme = useEmotionTheme()
  const scrollbarGutterSize = useScrollbarGutterSize()
  const { innerHeight: windowHeight } = useWindowDimensionsContext()

  // Calculate if the time dropdown will have a scrollbar
  const step = element.step ? Number(element.step) : 900 // step in seconds, defaults to 900s (15 minutes)
  const numTimeOptions = Math.ceil(86400 / step) // 86400 seconds in a day
  const itemHeight = convertRemToPx(theme.sizes.dropdownItemHeight)
  const maxDropdownHeight = Math.min(
    convertRemToPx(theme.sizes.maxDropdownHeight),
    windowHeight * 0.7 // 70vh constraint on popover body
  )
  const hasScrollbar = numTimeOptions * itemHeight > maxDropdownHeight
  const effectiveGutterSize = hasScrollbar ? scrollbarGutterSize : 0

  const clearable = isNullOrUndefined(element.default) && !disabled

  const selectOverrides = {
    Select: {
      props: {
        disabled,

        overrides: {
          ControlContainer: {
            style: ({ $isFocused }: { $isFocused: boolean }) => {
              const borderColor = getBorderColor(theme.colors, $isFocused)
              return {
                height: theme.sizes.minElementHeight,
                // Baseweb requires long-hand props, short-hand leads to weird bugs & warnings.
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
              // Baseweb requires long-hand props, short-hand leads to weird bugs & warnings.
              paddingRight: theme.spacing.sm,
              paddingLeft: theme.sizes.tagMarginInsideBorder,
              paddingBottom: theme.spacing.sm,
              paddingTop: theme.spacing.sm,
              marginLeft: theme.spacing.sm,
            }),
          },

          SingleValue: {
            style: {
              fontWeight: theme.fontWeights.normal,
              // Remove left margin that used to offset input (2px)
              marginLeft: theme.spacing.none,
            },
            props: {
              "data-testid": "stTimeInputTimeDisplay",
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
                    // Set CSS variable for adjustForGutter in list items
                    "--scrollbar-gutter-size": `${effectiveGutterSize}px`,
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
  }

  const handleChange = useCallback(
    (newDate: Date | null): void => {
      const newValue: string | null =
        newDate === null ? null : dateToString(newDate)

      setValueWithSource({ value: newValue, fromUi: true })
    },
    [setValueWithSource]
  )

  const handleClear = useCallback((): void => {
    handleChange(null)
  }, [handleChange])

  return (
    <div className="stTimeInput" data-testid="stTimeInput">
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
      <UITimePicker
        format="24"
        step={step} // step in seconds, defaults to 900s (15 minutes)
        value={isNullOrUndefined(value) ? undefined : stringToDate(value)}
        onChange={handleChange}
        overrides={selectOverrides}
        nullable={clearable}
        creatable
        aria-label={element.label}
      />
      {clearable && !isNullOrUndefined(value) && (
        // The time picker doesn't have a built-in clearable functionality.
        // Therefore, we are adding the clear button here.
        <StyledClearIconContainer
          onClick={handleClear}
          data-testid="stTimeInputClearButton"
        >
          <StyledClearIcon
            overrides={{
              Svg: {
                style: {
                  color: theme.colors.grayTextColor,
                  // setting this width and height makes the clear-icon align with dropdown arrows of other input fields
                  padding: theme.spacing.threeXS,
                  height: theme.sizes.clearIconSize,
                  width: theme.sizes.clearIconSize,
                  ":hover": {
                    fill: theme.colors.bodyText,
                  },
                },
              },
            }}
            $isFocusVisible={false}
          />
        </StyledClearIconContainer>
      )}
    </div>
  )
}

function getStateFromWidgetMgr(
  widgetMgr: WidgetStateManager,
  element: TimeInputProto
): string | null {
  return widgetMgr.getStringValue(element) ?? null
}

function getDefaultStateFromProto(element: TimeInputProto): string | null {
  return element.default ?? null
}

function getCurrStateFromProto(element: TimeInputProto): string | null {
  return element.value ?? null
}

function updateWidgetMgrState(
  element: TimeInputProto,
  widgetMgr: WidgetStateManager,
  vws: ValueWithSource<string | null>,
  fragmentId: string | undefined
): void {
  widgetMgr.setStringValue(
    element,
    vws.value,
    { fromUi: vws.fromUi },
    fragmentId
  )
}

function dateToString(value: Date): string {
  const hours = value.getHours().toString().padStart(2, "0")
  const minutes = value.getMinutes().toString().padStart(2, "0")

  return `${hours}:${minutes}`
}

function stringToDate(value: string | null): Date | null {
  if (value === null) {
    return null
  }
  const [hours, minutes] = value.split(":").map(Number)
  const date = new Date()

  date.setHours(hours)
  date.setMinutes(minutes)

  return date
}

export default memo(TimeInput)
