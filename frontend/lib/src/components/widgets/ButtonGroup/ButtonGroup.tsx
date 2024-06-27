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

import React, { ReactElement, useEffect, useState } from "react"

import { useTheme } from "@emotion/react"

import { ButtonGroup as BasewebButtonGroup, MODE } from "baseui/button-group"

import BaseButton, {
  BaseButtonKind,
  BaseButtonSize,
} from "@streamlit/lib/src/components/shared/BaseButton"
import { DynamicIcon } from "@streamlit/lib/src/components/shared/Icon"
import { EmotionTheme } from "@streamlit/lib/src/theme"

import { ButtonGroup as ButtonGroupProto } from "@streamlit/lib/src/proto"
import { WidgetStateManager } from "@streamlit/lib/src/WidgetStateManager"
import StreamlitMarkdown from "@streamlit/lib/src/components/shared/StreamlitMarkdown"
import { iconSizes } from "@streamlit/lib/src/theme/primitives"

const materialIconRegexp = /^:material\/(.+):$/

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
  index: number,
  currentSelection?: number[]
): number[] {
  if (mode == ButtonGroupProto.ClickMode.MULTI_SELECT) {
    return handleMultiSelection(index, currentSelection ?? [])
  }
  return [index]
}

function getSingleSelection(currentSelection: number[]): number {
  if (currentSelection.length === 0) {
    return -1
  }
  return currentSelection[0]
}

function syncValue(
  selected: number[],
  element: ButtonGroupProto,
  widgetMgr: WidgetStateManager,
  fragmentId?: string
): void {
  widgetMgr.setIntArrayValue(element, selected, { fromUi: true }, fragmentId)
}

function getMaterialIcon(option: string): string | undefined {
  const materialIconMatch = materialIconRegexp.exec(option)
  return materialIconMatch ? materialIconMatch[1] : undefined
}

function getContentElement(content: string): ReactElement {
  const fontSize = "md"
  const isMaterialIcon = !!getMaterialIcon(content)
  if (isMaterialIcon) {
    return <DynamicIcon size={fontSize} iconValue={content} />
  }

  return (
    <StreamlitMarkdown
      source={content}
      allowHTML={true}
      style={{
        marginBottom: 0,
        width: iconSizes[fontSize],
      }}
    />
  )
}

/**
 * Returns true if the element should be shown as selected (even though its technically not).
 * This is used, for example, to show all elements as selected that come before the actually selected element.
 * This returns false if mode is not SINGLE_SELECT or if SELECTION_MODE is set
 *
 * @param selectionMode
 * @param clickMode
 * @param selected list of selected indices. Since only SINGLE_SELECT is considered, this list will always have a length of 1.
 * @param index of the current element
 * @returns false if the click mode is set to SINGLE_SELECT or if the button style is not set to MINIMAL_FILL_UP; true otherwise for elements whose index is less or equal than the selected element
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

function getContent(
  isVisuallySelected: boolean,
  fallbackContent: string,
  selectionContent?: string | undefined | null
): string {
  if (isVisuallySelected && selectionContent) {
    return selectionContent
  }

  return fallbackContent
}

function getSelectedStyle(
  isVisuallySelected: boolean,
  isSelectionHighlightDisabled: boolean,
  theme: EmotionTheme
): Record<string, string> | undefined {
  if (!isVisuallySelected || isSelectionHighlightDisabled) {
    return undefined
  }

  return {
    backgroundColor: theme.colors.lightGray,
  }
}

function createOptionChild(
  option: ButtonGroupProto.IOption,
  index: number,
  selectionVisualization: ButtonGroupProto.SelectionVisualization,
  clickMode: ButtonGroupProto.ClickMode,
  selected: number[],
  theme: EmotionTheme
): React.FunctionComponent {
  const isVisuallySelected = showAsSelected(
    selectionVisualization,
    clickMode,
    selected,
    index
  )
  const content = getContent(
    isVisuallySelected,
    option.content ?? "",
    option.selectedContent
  )
  const style = getSelectedStyle(
    isVisuallySelected,
    option.disableSelectionHighlight || false,
    theme
  )
  return function BaseButtonGroup(props: any): ReactElement {
    return (
      <BaseButton
        {...props}
        key={content}
        size={BaseButtonSize.SMALL}
        kind={BaseButtonKind.BUTTON_GROUP}
        style={style}
      >
        {getContentElement(content)}
      </BaseButton>
    )
  }
}

function ButtonGroup(props: Readonly<Props>): ReactElement {
  const { disabled, element, fragmentId, widgetMgr } = props
  const {
    clickMode,
    default: defaultValues,
    options,
    setValue,
    value,
    selectionVisualization,
  } = element
  const theme: EmotionTheme = useTheme()

  const [selected, setSelected] = useState<number[]>(defaultValues || [])

  useEffect(() => {
    if (setValue) {
      setSelected(value)
    }
  }, [value, setValue])

  const onClick = (
    _event: React.SyntheticEvent<HTMLButtonElement>,
    index: number
  ): void => {
    const newSelected = handleSelection(clickMode, index, selected)
    setSelected(newSelected)
    syncValue(newSelected, element, widgetMgr, fragmentId)
  }

  let mode = undefined
  if (clickMode === ButtonGroupProto.ClickMode.SINGLE_SELECT) {
    mode = MODE.radio
  } else if (clickMode === ButtonGroupProto.ClickMode.MULTI_SELECT) {
    mode = MODE.checkbox
  }

  const optionElements = options.map((option, index) => {
    const Element = createOptionChild(
      option,
      index,
      selectionVisualization,
      clickMode,
      selected,
      theme
    )
    return <Element key={option.content} />
  })
  return (
    <BasewebButtonGroup
      disabled={disabled}
      mode={mode}
      onClick={onClick}
      selected={
        clickMode === ButtonGroupProto.ClickMode.MULTI_SELECT
          ? selected
          : getSingleSelection(selected)
      }
      overrides={{
        Root: {
          style: {
            flexWrap: "wrap",
            gap: theme.spacing.threeXS,
          },
        },
      }}
    >
      {optionElements}
    </BasewebButtonGroup>
  )
}

export default ButtonGroup
