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
    widgetMgr.setIntArrayValue(element, selected, source, fragmentId)
    return
  }
  console.log("selected", selected)
  widgetMgr.setIntArrayValue(element, selected, source, fragmentId)
}

function getMaterialIcon(option: string): string | undefined {
  const materialIconMatch = materialIconRegexp.exec(option)
  return materialIconMatch ? materialIconMatch[1] : undefined
}

function getContent(option: string, isMaterialIcon: boolean): ReactElement {
  if (isMaterialIcon) {
    return (
      <DynamicIcon
        size="lg"
        iconValue={option}
        // color={theme.colors.bodyText}
      />
    )
  }

  return <StreamlitMarkdown source={option} allowHTML={false} />
}

function BaseButtonWithCustomKind(props: any): any {
  console.log(props)

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

const textDecoder = new TextDecoder("utf-8")

function ButtonGroup(props: Readonly<Props>): ReactElement {
  const { disabled, element, fragmentId, widgetMgr } = props
  const {
    clickMode,
    default: defaultValues,
    options,
    setValue,
    value,
  } = element
  console.log(defaultValues)
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
    console.log("onClick", index)
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
      // kind={BaseButtonKind.LINK}
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
        let parsedOption = textDecoder.decode(option)
        const key = parsedOption
        const kind = BaseButtonKind.ELEMENT_TOOLBAR
        let matchedIconName = getMaterialIcon(parsedOption)
        const additionalStyle: any = {}
        if (
          ButtonGroupProto.ClickMode.RADIO &&
          matchedIconName === "star_rate"
        ) {
          if (selected.length > 0 && index <= selected[0]) {
            parsedOption = "⭐"
            matchedIconName = undefined
          }
        } else if (selected.indexOf(index) !== -1) {
          additionalStyle.backgroundColor = theme.colors.lightGray
        }

        const element = getContent(parsedOption, !!matchedIconName)
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
