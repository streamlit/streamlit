/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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
  forwardRef,
  memo,
  ReactElement,
  Ref,
  useCallback,
  useMemo,
} from "react"

import { useTheme } from "@emotion/react"
import { ButtonGroup as BasewebButtonGroup, MODE } from "baseui/button-group"

import StreamlitMarkdown from "@streamlit/lib/src/components/shared/StreamlitMarkdown/StreamlitMarkdown"
import BaseButton, {
  BaseButtonKind,
  BaseButtonSize,
} from "@streamlit/lib/src/components/shared/BaseButton"
import { DynamicIcon } from "@streamlit/lib/src/components/shared/Icon"
import { EmotionTheme } from "@streamlit/lib/src/theme"
import {
  ButtonGroup as ButtonGroupProto,
  LabelVisibilityMessage,
} from "@streamlit/lib/src/proto"
import { WidgetStateManager } from "@streamlit/lib/src/WidgetStateManager"
import {
  StyledWidgetLabelHelpInline,
  WidgetLabel,
} from "@streamlit/lib/src/components/widgets/BaseWidget"
import TooltipIcon from "@streamlit/lib/src/components/shared/TooltipIcon"
import { Placement } from "@streamlit/lib/src/components/shared/Tooltip"
import { labelVisibilityProtoValueToEnum } from "@streamlit/lib/src/util/utils"
import {
  useBasicWidgetState,
  ValueWSource,
} from "@streamlit/lib/src/useBasicWidgetState"

export interface Props {
  disabled: boolean
  element: ButtonGroupProto
  widgetMgr: WidgetStateManager
  fragmentId?: string
}

function handleMultiSelection(
  index: number,
  currentSelection: number[]
): number[] {
  if (!currentSelection.includes(index)) {
    return [...currentSelection, index]
  }
  return currentSelection.filter(value => value !== index)
}

function handleSelection(
  mode: ButtonGroupProto.ClickMode,
  style: ButtonGroupProto.Style,
  index: number,
  currentSelection?: number[]
): number[] {
  if (mode == ButtonGroupProto.ClickMode.MULTI_SELECT) {
    return handleMultiSelection(index, currentSelection ?? [])
  }

  // unselect if item is already selected
  return style !== ButtonGroupProto.Style.TRIGGERS &&
    currentSelection?.includes(index)
    ? []
    : [index]
}

function getSingleSelection(currentSelection: number[]): number {
  if (currentSelection.length === 0) {
    return -1
  }
  return currentSelection[0]
}

function syncWithWidgetManager(
  element: ButtonGroupProto,
  widgetMgr: WidgetStateManager,
  valueWithSource: ValueWSource<ButtonGroupValue>,
  fragmentId?: string
): void {
  console.log(valueWithSource.value)
  if (
    element.style === ButtonGroupProto.Style.TRIGGERS &&
    valueWithSource.value?.length
  ) {
    widgetMgr.setStringTriggerValue(
      element,
      String(valueWithSource.value),
      { fromUi: valueWithSource.fromUi },
      fragmentId
    )
  } else {
    widgetMgr.setIntArrayValue(
      element,
      valueWithSource.value,
      { fromUi: valueWithSource.fromUi },
      fragmentId
    )
  }
}

export function getContentElement(
  content: string,
  icon?: string,
  style?: ButtonGroupProto.Style
): { element: ReactElement; kind: BaseButtonKind; size: BaseButtonSize } {
  let kind = BaseButtonKind.BORDERLESS_ICON
  switch (style) {
    case ButtonGroupProto.Style.PILLS:
      kind = BaseButtonKind.PILLS
      break
    case ButtonGroupProto.Style.BORDERLESS:
      kind = BaseButtonKind.BORDERLESS_ICON
      break
    case ButtonGroupProto.Style.SEGMENTED_CONTROL:
      kind = BaseButtonKind.SEGMENTED_CONTROL
      break
    case ButtonGroupProto.Style.TRIGGERS:
      kind = BaseButtonKind.TRIGGERS
  }
  const size =
    style === ButtonGroupProto.Style.BORDERLESS
      ? BaseButtonSize.XSMALL
      : BaseButtonSize.MEDIUM

  const iconSize = style === ButtonGroupProto.Style.BORDERLESS ? "lg" : "base"

  return {
    element: (
      <>
        {icon && <DynamicIcon size={iconSize} iconValue={icon} />}
        {content && <StreamlitMarkdown source={content} allowHTML={false} />}
      </>
    ),
    kind: kind,
    size: size,
  }
}

/**
 * Returns true if the element should be shown as selected (even though its technically not).
 * This is used, for example, to show all elements as selected that come before the actually selected element.
 *
 * @param selectionVisualization sets the visualization mode
 * @param clickMode either SINGLE_SELECT or MULTI_SELECT
 * @param selected list of selected indices. Since only SINGLE_SELECT is considered, this list will always have a length of 1.
 * @param index of the current element
 * @returns true if the element is the selected one, or if click_mode is SINGLE_SELECT and selectionVisualization is set to
 *  ALL_UP_TO_SELECTED and the index of the element is smaller than the index of the selected element, false otherwise.
 */
function showAsSelected(
  selectionVisualization: ButtonGroupProto.SelectionVisualization,
  clickMode: ButtonGroupProto.ClickMode,
  selected: number[],
  index: number
): boolean {
  if (selected.indexOf(index) > -1) {
    return true
  }

  if (
    clickMode !== ButtonGroupProto.ClickMode.SINGLE_SELECT ||
    selectionVisualization !==
      ButtonGroupProto.SelectionVisualization.ALL_UP_TO_SELECTED
  ) {
    return false
  }

  return selected.length > 0 && index < selected[0]
}

function getButtonKindAndSize(
  isVisuallySelected: boolean,
  buttonKind: BaseButtonKind
): BaseButtonKind {
  if (isVisuallySelected) {
    buttonKind = `${buttonKind}Active` as BaseButtonKind
  }

  return buttonKind
}

function getButtonGroupOverridesStyle(
  style: ButtonGroupProto.Style,
  theme: EmotionTheme
): Record<string, any> {
  const baseStyle = {
    flexWrap: "wrap",
    maxWidth: "fit-content",
    columnGap: theme.spacing.threeXS,
    rowGap: theme.spacing.threeXS,
  }

  switch (style) {
    case ButtonGroupProto.Style.PILLS:
      return {
        ...baseStyle,
        columnGap: theme.spacing.twoXS,
        rowGap: theme.spacing.twoXS,
      }
    case ButtonGroupProto.Style.SEGMENTED_CONTROL:
      return {
        ...baseStyle,
        columnGap: theme.spacing.none,
        rowGap: theme.spacing.twoXS,
        // Adding an empty pseudo-element after the last button in the group.
        // This will make buttons only as big as needed without stretching to the whole container width (aka let them 'hug' to the side)
        "::after": {
          content: "''",
          flex: 10000,
        },
      }
    default:
      return baseStyle
  }
}

function createOptionChild(
  option: ButtonGroupProto.IOption,
  index: number,
  selectionVisualization: ButtonGroupProto.SelectionVisualization,
  clickMode: ButtonGroupProto.ClickMode,
  selected: number[],
  style: ButtonGroupProto.Style
): React.FunctionComponent {
  const isVisuallySelected = showAsSelected(
    selectionVisualization,
    clickMode,
    selected,
    index
  )

  let content = option.content
  let icon = option.contentIcon
  if (isVisuallySelected) {
    content = option.selectedContent ? option.selectedContent : content
    icon = option.selectedContentIcon ? option.selectedContentIcon : icon
  }

  // we have to use forwardRef here because BasewebButtonGroup passes the ref down to its children
  // and we see a console.error otherwise
  return forwardRef(function BaseButtonGroup(
    props: any,
    _: Ref<BasewebButtonGroup>
  ): ReactElement {
    const { element, kind, size } = getContentElement(
      content ?? "",
      icon ?? undefined,
      style
    )
    const buttonKind = getButtonKindAndSize(
      !!(
        isVisuallySelected &&
        !option.selectedContent &&
        !option.selectedContentIcon
      ),
      kind
    )
    return (
      <BaseButton {...props} size={size} kind={buttonKind}>
        {element}
      </BaseButton>
    )
  })
}

type ButtonGroupValue = number[]

function getInitialValue(
  widgetMgr: WidgetStateManager,
  element: ButtonGroupProto
): ButtonGroupValue | undefined {
  return widgetMgr.getIntArrayValue(element)
}

function getDefaultStateFromProto(
  element: ButtonGroupProto
): ButtonGroupValue {
  return element.default ?? null
}

function getCurrStateFromProto(element: ButtonGroupProto): ButtonGroupValue {
  return element.value ?? null
}

function ButtonGroup(props: Readonly<Props>): ReactElement {
  const { disabled, element, fragmentId, widgetMgr } = props
  const {
    clickMode,
    options,
    selectionVisualization,
    style,
    label,
    labelVisibility,
    help,
  } = element
  const theme: EmotionTheme = useTheme()

  const [value, setValueWSource] = useBasicWidgetState<
    ButtonGroupValue,
    ButtonGroupProto
  >({
    getStateFromWidgetMgr: getInitialValue,
    getDefaultStateFromProto,
    getCurrStateFromProto,
    updateWidgetMgrState: syncWithWidgetManager,
    element,
    widgetMgr,
    fragmentId,
  })

  const onClick = (
    _event: React.SyntheticEvent<HTMLButtonElement>,
    index: number
  ): void => {
    const newSelected = handleSelection(clickMode, style, index, value)
    setValueWSource({ value: newSelected, fromUi: true })
  }

  let mode = undefined
  if (clickMode === ButtonGroupProto.ClickMode.SINGLE_SELECT) {
    mode = MODE.radio
  } else if (clickMode === ButtonGroupProto.ClickMode.MULTI_SELECT) {
    mode = MODE.checkbox
  }

  const optionElements = useMemo(
    () =>
      options.map((option, index) => {
        const Element = createOptionChild(
          option,
          index,
          selectionVisualization,
          clickMode,
          value,
          style
        )
        return <Element key={`${option.content}-${index}`} />
      }),
    [clickMode, options, selectionVisualization, style, value]
  )

  return (
    <div className="stButtonGroup" data-testid="stButtonGroup">
      <WidgetLabel
        label={label}
        disabled={disabled}
        labelVisibility={labelVisibilityProtoValueToEnum(
          labelVisibility?.value ??
            LabelVisibilityMessage.LabelVisibilityOptions.COLLAPSED
        )}
      >
        {help && (
          <StyledWidgetLabelHelpInline>
            <TooltipIcon content={help} placement={Placement.TOP} />
          </StyledWidgetLabelHelpInline>
        )}
      </WidgetLabel>
      <BasewebButtonGroup
        disabled={disabled}
        mode={mode}
        onClick={onClick}
        selected={
          clickMode === ButtonGroupProto.ClickMode.MULTI_SELECT
            ? value
            : getSingleSelection(value)
        }
        overrides={{
          Root: {
            style: useCallback(
              () => getButtonGroupOverridesStyle(style, theme.spacing),
              [style, theme.spacing]
            ),
          },
        }}
      >
        {optionElements}
      </BasewebButtonGroup>
    </div>
  )
}

export default memo(ButtonGroup)
