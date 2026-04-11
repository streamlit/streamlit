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
} from "~lib/components/shared/BaseButton/BaseButton"
import { DynamicButtonLabel } from "~lib/components/shared/BaseButton/DynamicButtonLabel"
import { StyledButtonGroup } from "~lib/components/shared/BaseButton/styled-components"
import { Placement } from "~lib/components/shared/Tooltip/Tooltip"
import { WidgetLabel } from "~lib/components/widgets/BaseWidget/WidgetLabel"
import { WidgetLabelHelpIconInline } from "~lib/components/widgets/BaseWidget/WidgetLabelHelpIconInline"
import {
  useBasicWidgetState,
  ValueWithSource,
} from "~lib/hooks/useBasicWidgetState"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import type { EmotionTheme } from "~lib/theme/types"
import { labelVisibilityProtoValueToEnum } from "~lib/util/utils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

export interface Props {
  disabled: boolean
  element: ButtonGroupProto
  widgetMgr: WidgetStateManager
  fragmentId?: string
  widthConfig: streamlit.IWidthConfig | undefined | null
}

/**
 * Get the base content string for an option.
 */
function getOptionBaseContent(option: ButtonGroupProto.IOption): string {
  const icon = option.contentIcon
  const content = option.content ?? ""
  return icon ? `${icon} ${content}`.trim() : content
}

/**
 * Find the index of an option by its content string.
 * Returns the last matching index (to match backend "last wins" behavior
 * for duplicate labels), or -1 if not found.
 */
function findOptionIndex(
  options: ButtonGroupProto.IOption[],
  content: string
): number {
  // Iterate backwards to return the last match, matching the backend's
  // "last wins" behavior when building formatted_option_to_option_index
  for (let i = options.length - 1; i >= 0; i--) {
    if (getOptionBaseContent(options[i]) === content) {
      return i
    }
  }
  return -1
}

/**
 * Convert content strings to indices based on current options.
 */
function contentStringsToIndices(
  options: ButtonGroupProto.IOption[],
  contentStrings: string[]
): number[] {
  const indices: number[] = []
  for (const content of contentStrings) {
    const index = findOptionIndex(options, content)
    if (index >= 0) {
      indices.push(index)
    }
  }
  return indices
}

function handleMultiSelection(
  clickedContent: string,
  currentSelection: string[]
): string[] {
  if (!currentSelection.includes(clickedContent)) {
    return [...currentSelection, clickedContent]
  }
  return currentSelection.filter(c => c !== clickedContent)
}

function handleSelection(
  mode: ButtonGroupProto.ClickMode,
  clickedContent: string,
  currentSelection: string[],
  required: boolean
): string[] {
  if (mode === ButtonGroupProto.ClickMode.MULTI_SELECT) {
    return handleMultiSelection(clickedContent, currentSelection)
  }

  // Prevent deselection when required
  if (required && currentSelection.includes(clickedContent)) {
    return currentSelection
  }

  return currentSelection.includes(clickedContent) ? [] : [clickedContent]
}

function getSelectionMode(
  clickMode: ButtonGroupProto.ClickMode
): typeof MODE.radio | typeof MODE.checkbox | undefined {
  switch (clickMode) {
    case ButtonGroupProto.ClickMode.SINGLE_SELECT:
      return MODE.radio
    case ButtonGroupProto.ClickMode.MULTI_SELECT:
      return MODE.checkbox
    default:
      return undefined
  }
}

function getSingleSelection(currentSelection: number[]): number {
  if (currentSelection.length === 0) {
    return -1
  }
  return currentSelection[0]
}

/**
 * The value stored in React state: array of content strings (like Radio).
 * E.g., ["Apple", "Banana"]
 *
 * This matches the pattern used by Radio/Selectbox/Multiselect.
 * When options change, useMemo automatically recalculates indices.
 */
type ButtonGroupValue = string[]

function getInitialValue(
  widgetMgr: WidgetStateManager,
  element: ButtonGroupProto
): ButtonGroupValue | undefined {
  // Get string values directly
  return widgetMgr.getStringArrayValue(element)
}

function getDefaultStateFromProto(
  element: ButtonGroupProto
): ButtonGroupValue {
  const defaultIndices = element.default ?? []
  // Convert default indices to content strings
  return defaultIndices
    .map(index => {
      const option = element.options[index]
      return option ? getOptionBaseContent(option) : ""
    })
    .filter(s => s !== "")
}

function getCurrStateFromProto(element: ButtonGroupProto): ButtonGroupValue {
  // Get raw values directly
  return element.rawValues ?? []
}

function syncWithWidgetManager(
  element: ButtonGroupProto,
  widgetMgr: WidgetStateManager,
  valueWithSource: ValueWithSource<ButtonGroupValue>,
  fragmentId: string | undefined
): void {
  // Store content strings directly (no index suffix needed)
  widgetMgr.setStringArrayValue(
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

  return {
    element: (
      <DynamicButtonLabel
        icon={icon}
        label={content}
        iconSize="base"
        useSmallerFont
      />
    ),
    kind,
    size: BaseButtonSize.MEDIUM,
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

function ButtonGroup(props: Readonly<Props>): ReactElement {
  const { disabled, element, fragmentId, widgetMgr, widthConfig } = props
  const { clickMode, options, style, label, labelVisibility, help, required } =
    element
  const theme = useEmotionTheme()

  const queryParamBinding = element.queryParamKey
    ? {
        paramKey: element.queryParamKey,
        valueType: "string_array_value" as const,
        clearable: true,
        urlFormat: "repeated" as const,
      }
    : undefined

  // State stores base content strings (e.g., ["Apple", "Banana"])
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
    formClearBehavior: "resetValueOnly",
    queryParamBinding,
  })

  // Derive indices from content strings + current options (like Radio)
  // When options change, React re-renders and useMemo recalculates indices
  const selectedIndices = useMemo(
    () => contentStringsToIndices(options, value),
    [options, value]
  )

  const containerWidth = shouldWidthStretch(widthConfig)

  const onClick = useCallback(
    (_event: React.SyntheticEvent<HTMLButtonElement>, index: number): void => {
      const clickedContent = getOptionBaseContent(options[index])
      const newSelected = handleSelection(
        clickMode,
        clickedContent,
        value,
        required
      )
      // Skip state update if selection didn't change (e.g., clicking already-selected
      // option when required=true). This prevents unnecessary backend reruns.
      if (newSelected === value) {
        return
      }
      setValueWithSource({ value: newSelected, fromUi: true })
    },
    [clickMode, options, value, required, setValueWithSource]
  )

  const mode = getSelectionMode(clickMode)

  const optionElements = useMemo(
    () =>
      options.map((option, index) => {
        const Element = createOptionChild(
          option,
          index,
          selectedIndices,
          style,
          containerWidth
        )
        // TODO: Update to match React best practices
        // eslint-disable-next-line @eslint-react/no-array-index-key
        return <Element key={`${option.content}-${index}`} />
      }),
    [options, style, selectedIndices, containerWidth]
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
            ? selectedIndices
            : getSingleSelection(selectedIndices)
        }
        overrides={{
          Root: {
            props: {
              "aria-required": required || undefined,
            },
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
