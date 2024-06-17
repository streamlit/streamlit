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

import React, { ReactElement, useState } from "react"

import { Button as BasewebButton } from "baseui/button"
import { ButtonGroup as BasewebButtonGroup, MODE } from "baseui/button-group"

import { ButtonGroup as ButtonGroupProto } from "@streamlit/lib/src/proto"
import { WidgetStateManager } from "@streamlit/lib/src/WidgetStateManager"
import StreamlitMarkdown from "@streamlit/lib/src/components/shared/StreamlitMarkdown"

export interface Props {
  disabled: boolean
  element: ButtonGroupProto
  widgetMgr: WidgetStateManager
  fragmentId?: string
}

function handleCheckboxSelection(
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
  if (mode == ButtonGroupProto.ClickMode.CHECKBOX) {
    return handleCheckboxSelection(index, currentSelection ?? [])
  }
  return [index]
}

function getRadioSelection(currentSelection: number[]): number {
  if (currentSelection.length === 0) {
    return -1
  }
  return currentSelection[0]
}

function syncValue(
  mode: ButtonGroupProto.ClickMode,
  selected: number[],
  element: ButtonGroupProto,
  widgetMgr: WidgetStateManager,
  fragmentId?: string
): void {
  const source = { fromUi: true }
  if (mode === ButtonGroupProto.ClickMode.BUTTON) {
    widgetMgr.setStringTriggerValue(
      element,
      JSON.stringify(selected),
      source,
      fragmentId
    )
    return
  }

  widgetMgr.setIntArrayValue(element, selected, source, fragmentId)
}

function ButtonGroup(props: Props): ReactElement {
  const { disabled, element, fragmentId, widgetMgr } = props
  const { clickMode, default: defaultValues, options } = element
  console.log(defaultValues)
  const [selected, setSelected] = useState<number[]>(
    defaultValues ? defaultValues.filter(d => d).map((d, i) => i) : []
  )

  const textDecoder = new TextDecoder("utf-8")

  const onClick = (
    _event: React.SyntheticEvent<HTMLButtonElement>,
    index: number
  ): void => {
    const newSelected = handleSelection(clickMode, index, selected)
    setSelected(newSelected)
    syncValue(clickMode, newSelected, element, widgetMgr, fragmentId)
  }

  let mode = undefined
  if (clickMode === ButtonGroupProto.ClickMode.RADIO) {
    mode = MODE.radio
  } else if (clickMode === ButtonGroupProto.ClickMode.CHECKBOX) {
    mode = MODE.checkbox
  }

  console.log("IN BUTTONGROUP", mode)

  return (
    <BasewebButtonGroup
      disabled={disabled}
      mode={mode}
      onClick={onClick}
      selected={
        clickMode === ButtonGroupProto.ClickMode.CHECKBOX
          ? selected
          : getRadioSelection(selected)
        //   : clickMode === ButtonGroupProto.ClickMode.RADIO
        //   ? getRadioSelection(selected)
        //   : undefined
      }
    >
      {options.map(option => {
        const parsedOption = textDecoder.decode(option)
        return (
          <BasewebButton key={parsedOption}>
            <StreamlitMarkdown
              source={parsedOption}
              allowHTML={false}
            ></StreamlitMarkdown>
          </BasewebButton>
        )
      })}
    </BasewebButtonGroup>
  )
}

export default ButtonGroup
