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
  ReactElement,
  Ref,
  useEffect,
  useMemo,
  useState,
} from "react"

import { useTheme } from "@emotion/react"
import isEqual from "lodash/isEqual"
import { ButtonGroup as BasewebButtonGroup, MODE } from "baseui/button-group"

import StreamlitMarkdown from "@streamlit/lib/src/components/shared/StreamlitMarkdown/StreamlitMarkdown"
import BaseButton, {
  BaseButtonKind,
  BaseButtonSize,
} from "@streamlit/lib/src/components/shared/BaseButton"
import {
  DynamicIcon,
  ICON_REGEXP,
} from "@streamlit/lib/src/components/shared/Icon"
import { EmotionTheme } from "@streamlit/lib/src/theme"
import { ButtonGroup as ButtonGroupProto } from "@streamlit/lib/src/proto"
import { WidgetStateManager } from "@streamlit/lib/src/WidgetStateManager"
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
  selected: number[],
  element: ButtonGroupProto,
  widgetMgr: WidgetStateManager,
  fragmentId?: string,
  fromUi = true
): void {
  widgetMgr.setIntArrayValue(element, selected, { fromUi: fromUi }, fragmentId)
}

function getContentElement(content: string): ReactElement {
  if (content.match(ICON_REGEXP) === null) {
    return <StreamlitMarkdown source={content} allowHTML={false} />
  }
  return <DynamicIcon size="lg" iconValue={content} />
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
  selected: number[],
  style: ButtonGroupProto.Style
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

  // we have to use forwardRef here because BasewebButtonGroup passes the ref down to its children
  // and we see a console.error otherwise
  return forwardRef(function BaseButtonGroup(
    props: any,
    _: Ref<BasewebButtonGroup>
  ): ReactElement {
    const contentElement = getContentElement(content)

    // const buttonKind =
    //   contentElement.type === StreamlitMarkdown &&
    //   (!isVisuallySelected || option.selectedContent || false)
    //     ? BaseButtonKind.ICON
    //     : !isVisuallySelected || option.selectedContent || false
    //     ? BaseButtonKind.BORDERLESS_ICON
    //     : BaseButtonKind.BORDERLESS_ICON_ACTIVE

    let buttonKind = BaseButtonKind.ICON
    console.log("contentElement", contentElement, style)
    if (contentElement.type === StreamlitMarkdown) {
      if (style === ButtonGroupProto.Style.PILLS) {
        buttonKind = BaseButtonKind.PILLS

        if (isVisuallySelected || option.selectedContent) {
          buttonKind = BaseButtonKind.PILLS_ACTIVE
        }
      } else if (isVisuallySelected || option.selectedContent) {
        buttonKind = BaseButtonKind.ICON_ACTIVE
      }
    } else if (contentElement.type === DynamicIcon) {
      if (isVisuallySelected) {
        buttonKind = BaseButtonKind.BORDERLESS_ICON_ACTIVE
      } else {
        buttonKind = BaseButtonKind.BORDERLESS_ICON
      }
    }

    return (
      <BaseButton {...props} size={BaseButtonSize.XSMALL} kind={buttonKind}>
        {contentElement}
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
    style,
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
    if (element.setValue) {
      // We are intentionally setting this to avoid regularly calling this effect.
      element.setValue = false
      const val = element.value || []
      setSelected(val)
    }
  }, [element])

  useEffect(() => {
    const parsedValue = JSON.parse(valueString)
    console.log("useEffect", parsedValue, elementRef.current.setValue)
    // if (elementRef.current.setValue) {
    //   setSelected(parsedValue)
    //   syncWithWidgetManager(
    //     selected,
    //     elementRef.current,
    //     widgetMgr,
    //     fragmentId,
    //     false
    //   )
    //   elementRef.current.setValue = false
    // } else {
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
    // }
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
      selected,
      style
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
            display: "inline-flex",
            flexWrap: "wrap",
            gap: theme.spacing.xs,
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
