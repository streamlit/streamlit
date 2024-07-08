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
  ReactElement,
  useEffect,
  useState,
  forwardRef,
  Ref,
  useMemo,
} from "react"

import { useTheme } from "@emotion/react"
import isEqual from "lodash/isEqual"

import { ButtonGroup as BasewebButtonGroup, MODE } from "baseui/button-group"

import BaseButton, {
  BaseButtonKind,
  BaseButtonSize,
} from "@streamlit/lib/src/components/shared/BaseButton"
import {
  DynamicIcon,
  isMaterialIcon,
} from "@streamlit/lib/src/components/shared/Icon"
import { EmotionTheme } from "@streamlit/lib/src/theme"

import { ButtonGroup as ButtonGroupProto } from "@streamlit/lib/src/proto"
import { WidgetStateManager } from "@streamlit/lib/src/WidgetStateManager"
import StreamlitMarkdown from "@streamlit/lib/src/components/shared/StreamlitMarkdown"
import { iconSizes } from "@streamlit/lib/src/theme/primitives"
import { FormClearHelper } from "@streamlit/lib/src/components/widgets/Form/FormClearHelper"

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

function syncWithWidgetManager(
  selected: number[],
  element: ButtonGroupProto,
  widgetMgr: WidgetStateManager,
  fragmentId?: string,
  fromUi = true
): void {
  widgetMgr.setIntArrayValue(element, selected, { fromUi: fromUi }, fragmentId)
}

function getContentElement(content: string): ReactElement {
  const fontSize = "lg"
  if (isMaterialIcon(content)) {
    return <DynamicIcon size={fontSize} iconValue={content} />
  }

  return (
    <StreamlitMarkdown
      source={content}
      allowHTML={true}
      style={{
        marginBottom: 0,
        width: iconSizes[fontSize],
        display: "inline-flex",
      }}
    />
  )
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

function createOptionChild(
  option: ButtonGroupProto.IOption,
  index: number,
  selectionVisualization: ButtonGroupProto.SelectionVisualization,
  clickMode: ButtonGroupProto.ClickMode,
  selected: number[]
  // theme: EmotionTheme
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

  // we have to use forwardRef here becaused BasewebButtonGroup passes it down to its children
  const buttonKind =
    !isVisuallySelected || option.selectedContent || false
      ? BaseButtonKind.BORDERLESS_ICON
      : BaseButtonKind.BORDERLESS_ICON_ACTIVE
  return forwardRef(function BaseButtonGroup(
    props: any,
    _: Ref<BasewebButtonGroup>
  ): ReactElement {
    return (
      <BaseButton {...props} size={BaseButtonSize.XSMALL} kind={buttonKind}>
        {getContentElement(content)}
      </BaseButton>
    )
  })
}

function getInitialValue(
  widgetMgr: WidgetStateManager,
  element: ButtonGroupProto
): number[] {
  const storedValue = widgetMgr.getIntArrayValue(element)
  return storedValue ?? element.default
}

function ButtonGroup(props: Readonly<Props>): ReactElement {
  const { disabled, element, fragmentId, widgetMgr } = props
  const {
    clickMode,
    default: defaultValues,
    options,
    value,
    selectionVisualization,
  } = element

  const theme: EmotionTheme = useTheme()

  const [selected, setSelected] = useState<number[]>(
    getInitialValue(widgetMgr, element) || []
  )

  const elementRef = React.useRef(element)
  // set to undefined for the first render so we know when its mounted
  const selectedRef = React.useRef<number[] | undefined>(undefined)

  // This is required for the form clearing functionality:
  useEffect(() => {
    if (!element.formId) {
      // We don't need the form clear functionality if its not in a form
      // or if selections are not activated.
      return
    }

    const formClearHelper = new FormClearHelper()
    // On form clear, reset the selections (in chart & widget state)
    formClearHelper.manageFormClearListener(widgetMgr, element.formId, () => {
      setSelected(defaultValues)
    })

    return () => {
      formClearHelper.disconnect()
    }
  }, [element.formId, widgetMgr, defaultValues])

  const valueString = useMemo(() => JSON.stringify(value), [value])
  useEffect(() => {
    const parsedValue = JSON.parse(valueString)
    if (elementRef.current.setValue) {
      setSelected(parsedValue)
      syncWithWidgetManager(
        selected,
        elementRef.current,
        widgetMgr,
        fragmentId,
        false
      )
      elementRef.current.setValue = false
    } else {
      // only commit to the backend if the value has changed
      if (isEqual(selected, selectedRef.current)) {
        return
      }
      const fromUi = selectedRef.current === undefined ? false : true
      syncWithWidgetManager(
        selected,
        elementRef.current,
        widgetMgr,
        fragmentId,
        fromUi
      )
    }
    selectedRef.current = selected
  }, [selected, widgetMgr, fragmentId, valueString])

  const onClick = (
    _event: React.SyntheticEvent<HTMLButtonElement>,
    index: number
  ): void => {
    const newSelected = handleSelection(clickMode, index, selected)
    setSelected(newSelected)
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
      selected
    )
    return <Element key={`${option.content}-${index}`} />
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
          props: {
            "data-testid": "stButtonGroup",
          },
        },
      }}
    >
      {optionElements}
    </BasewebButtonGroup>
  )
}

export default ButtonGroup
