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

import React, { memo, ReactElement, useCallback, useContext } from "react"

import { ChevronDown } from "baseui/icon"
import { StyledClearIcon } from "baseui/input/styled-components"
import { TimePicker as UITimePicker } from "baseui/timepicker"

import { TimeInput as TimeInputProto } from "@streamlit/protobuf"

import IsSidebarContext from "~lib/components/core/IsSidebarContext"
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
import {
  isNullOrUndefined,
  labelVisibilityProtoValueToEnum,
} from "~lib/util/utils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import {
  StyledClearIconContainer,
  StyledTimeDropdownListItem,
} from "./styled-components"

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
  })
  const isInSidebar = useContext(IsSidebarContext)

  const clearable = isNullOrUndefined(element.default) && !disabled
  const theme = useEmotionTheme()

  const selectOverrides = {
    Select: {
      props: {
        disabled,

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
              "data-testid": "stTimeInputTimeDisplay",
            },
          },

          Dropdown: {
            style: () => ({
              paddingTop: theme.spacing.none,
              paddingBottom: theme.spacing.none,
              // Somehow this adds an additional shadow, even though we already have
              // one on the popover, so we need to remove it here.
              boxShadow: "none",
              maxHeight: theme.sizes.maxDropdownHeight,
            }),
          },

          DropdownListItem: {
            component: StyledTimeDropdownListItem,
          },

          // Nudge the dropdown menu by 1px so the focus state doesn't get cut off
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
          <StyledWidgetLabelHelp>
            <TooltipIcon
              content={element.help}
              placement={Placement.TOP_RIGHT}
            />
          </StyledWidgetLabelHelp>
        )}
      </WidgetLabel>
      <UITimePicker
        format="24"
        step={element.step ? Number(element.step) : 900} // step in seconds, defaults to 900s (15 minutes)
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
  fragmentId?: string
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
