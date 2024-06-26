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
import { EmotionTheme, IconSize } from "@streamlit/lib/src/theme"

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
  if (mode == ButtonGroupProto.ClickMode.MULTI_SELECT) {
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

function getContent(
  option: string,
  isMaterialIcon: boolean,
  fontSize: IconSize
): ReactElement {
  if (isMaterialIcon) {
    return <DynamicIcon size={fontSize} iconValue={option} />
  }

  return (
    <StreamlitMarkdown
      source={option}
      allowHTML={true}
      style={{ marginBottom: 0, width: iconSizes[fontSize] }}
    />
  )
}

function showAsSelected(
  selectionMode: ButtonGroupProto.SelectionHighlight,
  clickMode: ButtonGroupProto.ClickMode,
  selected: number[],
  index: number
): boolean {
  if (selected.indexOf(index) > -1) {
    return true
  }

  if (clickMode !== ButtonGroupProto.ClickMode.SINGLE_SELECT) {
    return false
  }

  if (selectionMode === ButtonGroupProto.SelectionHighlight.ONLY_SELECTED) {
    return false
  }

  return selected.length > 0 && index < selected[0]
}

function BaseButtonWithCustomKind(props: any): any {
  return (
    <BaseButton
      {...props}
      key={props.parsedOption}
      size={BaseButtonSize.SMALL}
      // we have to override kind here with a custom prop, because kind itself will
      // be passed from ButtonGroup and the type is unfortunately narrow
      kind={props._kind}
      additionalStyle={props.additionalStyle}
    >
      {props.content}
    </BaseButton>
  )
}

function ButtonGroup(props: Readonly<Props>): ReactElement {
  const { disabled, element, fragmentId, widgetMgr } = props
  const {
    clickMode,
    default: defaultValues,
    options,
    setValue,
    value,
    selectionHighlight,
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

  return (
    <BasewebButtonGroup
      disabled={disabled}
      mode={mode}
      onClick={onClick}
      selected={
        clickMode === ButtonGroupProto.ClickMode.MULTI_SELECT
          ? selected
          : getRadioSelection(selected)
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
      {options.map((option, index) => {
        console.log("option", option)
        const parsedOption = option
        const key = parsedOption

        const isShownAsSelected = showAsSelected(
          selectionHighlight,
          clickMode,
          selected,
          index
        )

        const kind = BaseButtonKind.BUTTON_GROUP
        const shownOption =
          isShownAsSelected && parsedOption.selectedContent
            ? parsedOption.selectedContent
            : parsedOption.content || ""
        const matchedIconName = getMaterialIcon(shownOption)
        const additionalStyle =
          isShownAsSelected && !parsedOption.selectedContent
            ? { backgroundColor: theme.colors.lightGray }
            : undefined

        const isMaterialIcon = !!matchedIconName

        const element = getContent(shownOption, isMaterialIcon, "lg")
        return (
          <BaseButtonWithCustomKind
            key={key}
            parsedOption={parsedOption}
            _kind={kind}
            content={element}
            additionalStyle={additionalStyle}
          />
        )
      })}
    </BasewebButtonGroup>
  )
}

export default ButtonGroup
