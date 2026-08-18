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

import { useResolvedWrap } from "~lib/components/shared/BaseButton/useResolvedWrap"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown/StreamlitMarkdown"
import { Placement } from "~lib/components/shared/Tooltip/Tooltip"
import { WidgetLabelHelpIconInline } from "~lib/components/widgets/BaseWidget/WidgetLabelHelpIconInline"
import {
  useBasicWidgetState,
  ValueWithSource,
} from "~lib/hooks/useBasicWidgetState"
import { useLabelTitleTooltip } from "~lib/hooks/useLabelTitleTooltip"
import { labelVisibilityProtoValueToEnum } from "~lib/util/utils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import {
  StyledCheckbox,
  StyledCheckboxIndicator,
  StyledCheckboxRoot,
  StyledContent,
  StyledLabelText,
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

  // wrap=None resolves from layout: no-wrap in horizontal containers, wrap otherwise.
  // When truncated, a native title on the label reveals the full label on hover.
  // Unlike a button (whose help tooltip covers the whole control), help here lives
  // on a separate icon, so the title and help never compete and both stay enabled.
  const wrap = useResolvedWrap(element.wrap)
  const truncate = !wrap
  const { titleRef, labelTextRef } = useLabelTitleTooltip(
    truncate,
    element.label
  )

  const labelContent = (
    <StyledContent
      visibility={labelVisibility}
      $truncate={truncate}
      data-testid="stWidgetLabel"
    >
      {/* The title is scoped to the label (not the help icon) so hovering the
          help icon shows only its tooltip. The inner `display: contents` span
          lets us read the label's plain text without adding a box. */}
      <StyledLabelText ref={titleRef} $truncate={truncate}>
        <span ref={labelTextRef} style={{ display: "contents" }}>
          <StreamlitMarkdown
            source={element.label}
            allowHTML={false}
            isLabel
            truncate={truncate}
          />
        </span>
      </StyledLabelText>
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
          $truncate={truncate}
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
        $truncate={truncate}
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
