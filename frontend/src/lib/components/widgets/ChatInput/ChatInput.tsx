/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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
  useEffect,
  useRef,
  useState,
  ChangeEvent,
  KeyboardEvent,
} from "react"
import { useTheme } from "@emotion/react"
import { Send } from "@emotion-icons/material-rounded"
import { Textarea as UITextArea } from "baseui/textarea"

import { ChatInput as ChatInputProto } from "src/lib/proto"
import { WidgetStateManager } from "src/lib/WidgetStateManager"
import Icon from "src/lib/components/shared/Icon"
import InputInstructions from "src/lib/components/shared/InputInstructions/InputInstructions"
import { hasLightBackgroundColor } from "src/lib/theme"

import {
  StyledChatInputContainer,
  StyledChatInput,
  StyledFloatingChatInputContainer,
  StyledInputInstructionsContainer,
  StyledSendIconButton,
  StyledSendIconButtonContainer,
} from "./styled-components"

export interface Props {
  disabled: boolean
  element: ChatInputProto
  widgetMgr: WidgetStateManager
  width: number
}

const isEnterKeyPressed = (
  event: KeyboardEvent<HTMLTextAreaElement>
): boolean => {
  // Using keyCode as well due to some different behaviors on Windows
  // https://bugs.chromium.org/p/chromium/issues/detail?id=79407

  const { keyCode, key } = event
  return key === "Enter" || keyCode === 13 || keyCode === 10
}

function ChatInput({ width, element, widgetMgr }: Props): React.ReactElement {
  const theme = useTheme()
  // True if the user-specified state.value has not yet been synced to the WidgetStateManager.
  const [dirty, setDirty] = useState(false)
  // The value specified by the user via the UI. If the user didn't touch this widget's UI, the default value is used.
  const [value, setValue] = useState(element.default)
  // The value of the height of the textarea. It depends on a variety of factors including the default height, and autogrowing
  const [scrollHeight, setScrollHeight] = useState(0)
  const chatInputRef = useRef<HTMLTextAreaElement>(null)

  const getScrollHeight = (): number => {
    let scrollHeight = 0
    const { current: textarea } = chatInputRef
    if (textarea) {
      textarea.style.height = "auto"
      scrollHeight = textarea.scrollHeight
      textarea.style.height = ""
    }

    return scrollHeight
  }

  const handleSubmit = (): void => {
    if (!value) {
      return
    }

    widgetMgr.setStringTriggerValue(element, value, { fromUi: true })
    setDirty(false)
    setValue("")
    setScrollHeight(0)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    const { metaKey, ctrlKey, shiftKey } = e
    const shouldSubmit =
      isEnterKeyPressed(e) && !shiftKey && !ctrlKey && !metaKey

    if (shouldSubmit) {
      e.preventDefault()

      handleSubmit()
    }
  }

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>): void => {
    const { value } = e.target
    const { maxChars } = element

    if (maxChars !== 0 && value.length > maxChars) {
      return
    }

    const scrollHeight = getScrollHeight()
    setDirty(value !== "")
    setValue(value)
    setScrollHeight(scrollHeight)
  }

  useEffect(() => {
    if (element.setValue) {
      // We are intentionally setting this to avoid regularly calling this effect.
      element.setValue = false
      const val = element.value || ""
      setValue(val)
      setDirty(val !== "")
    }
  }, [element])

  useEffect(() => {
    const scrollHeight = getScrollHeight()
    setScrollHeight(scrollHeight)
  }, [value])

  // We want the Text Area to mimic the height of a text input
  // so we calculate the min and max height based on the font.
  const LINE_HEIGHT = 1.4
  // Rounding errors can arbitrarily create scrollbars. We add a rounding offset
  // to manage it better.
  const ROUNDING_OFFSET = 1

  // We want to show easily that there's scrolling so we deliberately choose
  // a half size.
  const MAX_VISIBLE_NUM_LINES = 9.5
  // We round up because we want to avoid more rounding issues and make things easier
  const MAX_HEIGHT = Math.ceil(
    LINE_HEIGHT * theme.fontSizes.mdPx * MAX_VISIBLE_NUM_LINES
  )
  const lightTheme = hasLightBackgroundColor(theme)

  const placeholderColor = lightTheme
    ? theme.colors.gray70
    : theme.colors.gray80

  return (
    <StyledFloatingChatInputContainer
      className="stChatFloatingInputContainer"
      width={width}
    >
      <StyledChatInputContainer
        className="stChatInputContainer"
        width={width}
        position={element.position}
      >
        <StyledChatInput>
          <UITextArea
            data-testid="stChatInput"
            inputRef={chatInputRef}
            value={value}
            placeholder={element.placeholder}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            aria-label={element.placeholder}
            disabled={element.disabled}
            rows={1}
            overrides={{
              Root: {
                style: {
                  outline: "none",
                  backgroundColor: theme.colors.transparent,
                  // Baseweb requires long-hand props, short-hand leads to weird bugs & warnings.
                  borderLeftWidth: "1px",
                  borderRightWidth: "1px",
                  borderTopWidth: "1px",
                  borderBottomWidth: "1px",
                },
              },
              InputContainer: {
                style: {
                  backgroundColor: theme.colors.transparent,
                },
              },
              Input: {
                style: {
                  lineHeight: `${LINE_HEIGHT}`,
                  backgroundColor: theme.colors.transparent,
                  "::placeholder": {
                    color: placeholderColor,
                  },
                  height: `${scrollHeight + ROUNDING_OFFSET}px`,
                  maxHeight: `${MAX_HEIGHT}px`,
                  // Baseweb requires long-hand props, short-hand leads to weird bugs & warnings.
                  paddingRight: "3rem",
                  paddingLeft: theme.spacing.sm,
                  paddingBottom: theme.spacing.sm,
                  paddingTop: theme.spacing.sm,
                },
              },
            }}
          />
          <StyledInputInstructionsContainer>
            <InputInstructions
              dirty={dirty}
              value={value}
              maxLength={element.maxChars}
              type="chat"
            />
          </StyledInputInstructionsContainer>
          <StyledSendIconButtonContainer>
            <StyledSendIconButton
              onClick={handleSubmit}
              disabled={!dirty}
              extended={value.indexOf("\n") !== -1}
            >
              <Icon content={Send} size="xl" color="inherit" />
            </StyledSendIconButton>
          </StyledSendIconButtonContainer>
        </StyledChatInput>
      </StyledChatInputContainer>
    </StyledFloatingChatInputContainer>
  )
}

export default ChatInput
