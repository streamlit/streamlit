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

import {
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
  LabelVisibility,
  streamlit,
} from "@streamlit/protobuf"

import { shouldWidthStretch } from "~lib/components/core/Layout/utils"
import BaseButton, {
  BaseButtonKind,
  BaseButtonProps,
  BaseButtonSize,
  DynamicButtonLabel,
} from "~lib/components/shared/BaseButton"
import { StyledButtonGroup } from "~lib/components/shared/BaseButton/styled-components"
import { Placement } from "~lib/components/shared/Tooltip"
import {
  WidgetLabel,
  WidgetLabelHelpIconInline,
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
  if (mode === ButtonGroupProto.ClickMode.MULTI_SELECT) {
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
      : BaseButtonKind.SEGMENTED_CONTROL
  const size = BaseButtonSize.MEDIUM

  return {
    element: (
      <DynamicButtonLabel
        icon={icon}
        label={content}
        iconSize="base"
        useSmallerFont
      />
    ),
    kind: kind,
    size: size,
  }
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
): React.CSSProperties {
  const baseStyle: React.CSSProperties = {
    flexWrap: "wrap",
    // maxWidth must be conditional:
    // - "100%" for stretch width: allows buttons to fill container
    // - "fit-content" for content width: prevents flexbox calculation errors
    //   that cause the last button to wrap incorrectly (gh-12067)
    maxWidth: containerWidth ? "100%" : "fit-content",
    // This ensures that the button group does not overflow the container
    // due to the negative margins that BaseWeb adds.
    margin: "0 0",
  }
  const width = containerWidth ? "100%" : "auto"

  switch (style) {
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
        width,
      }
    default:
      return baseStyle
  }
}

function createOptionChild(
  option: ButtonGroupProto.IOption,
  index: number,
  selected: number[],
  style: ButtonGroupProto.Style,
  containerWidth: boolean
): React.FunctionComponent {
  const isSelected = selected.includes(index)

  // we have to use forwardRef here because BasewebButtonGroup passes the ref down to its children
  // and we see a console.error otherwise
  return forwardRef(function BaseButtonGroup(
    // Accept only the props compatible with BaseButton to improve type safety
    props: Partial<BaseButtonProps>,
    _: Ref<BasewebButtonGroup>
  ): ReactElement {
    const { element, kind, size } = getContentElement(
      option.content ?? "",
      option.contentIcon ?? undefined,
      style
    )
    const buttonKind = getButtonKindAndSize(isSelected, kind)
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
  return element.default ?? []
}

function getCurrStateFromProto(element: ButtonGroupProto): ButtonGroupValue {
  return element.value ?? []
}

function ButtonGroup(props: Readonly<Props>): ReactElement {
  const { disabled, element, fragmentId, widgetMgr, widthConfig } = props
  const { clickMode, options, style, label, labelVisibility, help } = element
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

  const containerWidth = shouldWidthStretch(widthConfig)

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
          value,
          style,
          containerWidth
        )
        // TODO: Update to match React best practices
        // eslint-disable-next-line @eslint-react/no-array-index-key
        return <Element key={`${option.content}-${index}`} />
      }),
    [options, style, value, containerWidth]
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
            LabelVisibility.LabelVisibilityOptions.COLLAPSED
        )}
      >
        {help && (
          <WidgetLabelHelpIconInline
            content={help}
            placement={Placement.TOP}
            label={label}
          />
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
