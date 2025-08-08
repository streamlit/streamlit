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
  forwardRef,
  memo,
  ReactElement,
  Ref,
  useCallback,
  useMemo,
} from "react"

import { ButtonGroup as BasewebButtonGroup, MODE } from "baseui/button-group"

import {
  ButtonGroup as ButtonGroupProto,
  LabelVisibilityMessage,
  streamlit,
} from "@streamlit/protobuf"

import { shouldChildrenStretch } from "~lib/components/core/Layout/utils"
import BaseButton, {
  BaseButtonKind,
  BaseButtonSize,
  DynamicButtonLabel,
} from "~lib/components/shared/BaseButton"
import { StyledButtonGroup } from "~lib/components/shared/BaseButton/styled-components"
import { Placement } from "~lib/components/shared/Tooltip"
import TooltipIcon from "~lib/components/shared/TooltipIcon"
import {
  StyledWidgetLabelHelpInline,
  WidgetLabel,
} from "~lib/components/widgets/BaseWidget"
import {
  useBasicWidgetState,
  ValueWithSource,
} from "~lib/hooks/useBasicWidgetState"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { EmotionTheme } from "~lib/theme"
import { labelVisibilityProtoValueToEnum } from "~lib/util/utils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

export interface Props {
  disabled: boolean
  element: ButtonGroupProto
  widgetMgr: WidgetStateManager
  fragmentId?: string
  widthConfig: streamlit.IWidthConfig | undefined | null
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
  index: number,
  currentSelection?: number[]
): number[] {
  if (mode == ButtonGroupProto.ClickMode.MULTI_SELECT) {
    return handleMultiSelection(index, currentSelection ?? [])
  }

  // unselect if item is already selected
  return currentSelection?.includes(index) ? [] : [index]
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
  valueWithSource: ValueWithSource<ButtonGroupValue>,
  fragmentId?: string
): void {
  widgetMgr.setIntArrayValue(
    element,
    valueWithSource.value,
    { fromUi: valueWithSource.fromUi },
    fragmentId
  )
}

export function getContentElement(
  content: string,
  icon?: string,
  style?: ButtonGroupProto.Style
): { element: ReactElement; kind: BaseButtonKind; size: BaseButtonSize } {
  const kind =
    style === ButtonGroupProto.Style.PILLS
      ? BaseButtonKind.PILLS
      : style === ButtonGroupProto.Style.BORDERLESS
        ? BaseButtonKind.BORDERLESS_ICON
        : BaseButtonKind.SEGMENTED_CONTROL
  const size =
    style === ButtonGroupProto.Style.BORDERLESS
      ? BaseButtonSize.XSMALL
      : BaseButtonSize.MEDIUM

  // Use smaller font if kind is pills or segmented control
  const useSmallerFont =
    kind === BaseButtonKind.PILLS || kind === BaseButtonKind.SEGMENTED_CONTROL

  const iconSize = style === ButtonGroupProto.Style.BORDERLESS ? "lg" : "base"

  return {
    element: (
      <DynamicButtonLabel
        icon={icon}
        label={content}
        iconSize={iconSize}
        useSmallerFont={useSmallerFont}
      />
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
  spacing: EmotionTheme["spacing"],
  containerWidth: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
): Record<string, any> {
  const baseStyle = {
    flexWrap: "wrap",
    maxWidth: "100%",
    // This ensures that the button
    // group does not overflow the container due
    // to the negative margins that BaseWeb adds.
    // When maxWidth is set to 100%, without this,
    // the buttons will wrap to the next line.
    margin: "0 0",
  }
  const width = containerWidth ? "100%" : "auto"
  const segmentedControlNoStretch = containerWidth
    ? {}
    : {
        content: "''",
        flex: 10000,
      }

  switch (style) {
    case ButtonGroupProto.Style.BORDERLESS:
      return {
        ...baseStyle,
        columnGap: spacing.threeXS,
        rowGap: spacing.threeXS,
      }
    case ButtonGroupProto.Style.PILLS:
      return {
        ...baseStyle,
        columnGap: spacing.twoXS,
        rowGap: spacing.twoXS,
        width,
      }
    case ButtonGroupProto.Style.SEGMENTED_CONTROL:
      return {
        ...baseStyle,
        columnGap: spacing.none,
        rowGap: spacing.twoXS,
        // Adding an empty pseudo-element after the last button in the group.
        // This will make buttons only as big as needed without stretching to the whole container width (aka let them 'hug' to the side)
        // This is only needed if the button group has content width.
        "::after": segmentedControlNoStretch,
        width,
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
  style: ButtonGroupProto.Style,
  containerWidth: boolean
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
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
      <BaseButton
        {...props}
        size={size}
        kind={buttonKind}
        containerWidth={containerWidth}
      >
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
  const { disabled, element, fragmentId, widgetMgr, widthConfig } = props
  const {
    clickMode,
    options,
    selectionVisualization,
    style,
    label,
    labelVisibility,
    help,
  } = element
  const theme = useEmotionTheme()

  const [value, setValueWithSource] = useBasicWidgetState<
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

  const containerWidth = shouldChildrenStretch(widthConfig)

  const onClick = (
    _event: React.SyntheticEvent<HTMLButtonElement>,
    index: number
  ): void => {
    const newSelected = handleSelection(clickMode, index, value)
    setValueWithSource({ value: newSelected, fromUi: true })
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
          style,
          containerWidth
        )
        // TODO: Update to match React best practices
        // eslint-disable-next-line @eslint-react/no-array-index-key
        return <Element key={`${option.content}-${index}`} />
      }),
    [clickMode, options, selectionVisualization, style, value, containerWidth]
  )

  return (
    <StyledButtonGroup
      className="stButtonGroup"
      data-testid="stButtonGroup"
      containerWidth={containerWidth}
    >
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
              () =>
                getButtonGroupOverridesStyle(
                  style,
                  theme.spacing,
                  containerWidth
                ),
              [style, theme.spacing, containerWidth]
            ),
          },
        }}
      >
        {optionElements}
      </BasewebButtonGroup>
    </StyledButtonGroup>
  )
}

export default memo(ButtonGroup)
