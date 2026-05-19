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

import { memo, ReactElement, useCallback } from "react"

import { Checkbox as CheckboxProto } from "@streamlit/protobuf"

import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown/StreamlitMarkdown"
import { Placement } from "~lib/components/shared/Tooltip/Tooltip"
import { WidgetLabelHelpIconInline } from "~lib/components/widgets/BaseWidget/WidgetLabelHelpIconInline"
import {
  useBasicWidgetState,
  ValueWithSource,
} from "~lib/hooks/useBasicWidgetState"
import { labelVisibilityProtoValueToEnum } from "~lib/util/utils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import {
  StyledCheckbox,
  StyledCheckboxIndicator,
  StyledCheckboxRoot,
  StyledContent,
  StyledSwitchRoot,
  StyledToggleThumb,
  StyledToggleTrack,
} from "./styled-components"

export interface Props {
  disabled: boolean
  element: CheckboxProto
  widgetMgr: WidgetStateManager
  fragmentId?: string
}

function Checkbox({
  element,
  disabled,
  widgetMgr,
  fragmentId,
}: Readonly<Props>): ReactElement {
  const queryParamBinding = element.queryParamKey
    ? {
        paramKey: element.queryParamKey,
        valueType: "bool_value" as const,
        clearable: false,
      }
    : undefined

  const [value, setValueWithSource] = useBasicWidgetState<
    boolean,
    CheckboxProto
  >({
    getStateFromWidgetMgr,
    getDefaultStateFromProto,
    getCurrStateFromProto,
    updateWidgetMgrState,
    element,
    widgetMgr,
    fragmentId,
    formClearBehavior: "resetValueOnly",
    queryParamBinding,
  })

  const handleChange = useCallback(
    (isSelected: boolean): void => {
      setValueWithSource({ value: isSelected, fromUi: true })
    },
    [setValueWithSource]
  )

  const isToggle = element.type === CheckboxProto.StyleType.TOGGLE
  const labelVisibility = labelVisibilityProtoValueToEnum(
    element.labelVisibility?.value
  )

  const labelContent = (
    <StyledContent visibility={labelVisibility} data-testid="stWidgetLabel">
      <StreamlitMarkdown source={element.label} allowHTML={false} isLabel />
      {element.help && (
        <WidgetLabelHelpIconInline
          content={element.help}
          placement={Placement.TOP_RIGHT}
          label={element.label}
        />
      )}
    </StyledContent>
  )

  if (isToggle) {
    return (
      <StyledCheckbox
        className="row-widget stCheckbox"
        data-testid="stCheckbox"
      >
        <StyledSwitchRoot
          isSelected={value}
          isDisabled={disabled}
          onChange={handleChange}
          aria-label={element.label}
        >
          {({ isSelected, isHovered, isDisabled: isDisab }) => (
            <>
              <StyledToggleTrack
                $isSelected={isSelected}
                $isHovered={isHovered}
                $isDisabled={isDisab}
              >
                <StyledToggleThumb
                  $isSelected={isSelected}
                  $isDisabled={isDisab}
                />
              </StyledToggleTrack>
              {labelContent}
            </>
          )}
        </StyledSwitchRoot>
      </StyledCheckbox>
    )
  }

  return (
    <StyledCheckbox className="row-widget stCheckbox" data-testid="stCheckbox">
      <StyledCheckboxRoot
        isSelected={value}
        isDisabled={disabled}
        onChange={handleChange}
        aria-label={element.label}
      >
        {({ isSelected, isFocusVisible, isDisabled: isDisab }) => (
          <>
            <StyledCheckboxIndicator
              $isSelected={isSelected}
              $isFocusVisible={isFocusVisible}
              $isDisabled={isDisab}
            >
              {isSelected && (
                <svg viewBox="0 0 10 8" aria-hidden="true">
                  <polyline points="1 4 4 7 9 1" />
                </svg>
              )}
            </StyledCheckboxIndicator>
            {labelContent}
          </>
        )}
      </StyledCheckboxRoot>
    </StyledCheckbox>
  )
}

function getStateFromWidgetMgr(
  widgetMgr: WidgetStateManager,
  element: CheckboxProto
): boolean | undefined {
  return widgetMgr.getBoolValue(element)
}

function getDefaultStateFromProto(element: CheckboxProto): boolean {
  return element.default ?? false
}

function getCurrStateFromProto(element: CheckboxProto): boolean {
  return element.value ?? false
}

function updateWidgetMgrState(
  element: CheckboxProto,
  widgetMgr: WidgetStateManager,
  vws: ValueWithSource<boolean>,
  fragmentId: string | undefined
): void {
  widgetMgr.setBoolValue(
    element,
    vws.value,
    { fromUi: vws.fromUi },
    fragmentId
  )
}

export default memo(Checkbox)
