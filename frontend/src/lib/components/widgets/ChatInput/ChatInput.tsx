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

import {
  StyledChatInputContainer,
  StyledChatInput,
  StyledSendIconContainer,
  // StyledChatInputBackground,
} from "./styled-components"

const MIN_HEIGHT = 40.4 // 40.4 is the default height of a text input
const MAX_HEIGHT = 230

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
  const [value, setValue] = useState("")
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
    widgetMgr.setStringTriggerValue(element, value, { fromUi: true })
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
    setDirty(true)
    setValue(value)
    setScrollHeight(scrollHeight)
  }

  useEffect(() => {
    if (element.setValue) {
      const { value } = element
      element.setValue = false
      setValue(value)
      setDirty(true)
    }
  }, [element])

  useEffect(() => {
    const scrollHeight = getScrollHeight()
    setScrollHeight(scrollHeight)
  }, [value])

  const realHeight = Math.min(Math.max(scrollHeight, MIN_HEIGHT), MAX_HEIGHT)

  return (
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
                // Baseweb requires long-hand props, short-hand leads to weird bugs & warnings.
                borderLeftWidth: 0,
                borderTopWidth: 0,
                borderRightWidth: 0,
                borderBottomWidth: 0,
                borderLeftStyle: "none",
                borderTopStyle: "none",
                borderRightStyle: "none",
                borderBottomStyle: "none",
                outline: "none",
                borderBottomLeftRadius: theme.radii.md,
                borderBottomRightRadius: theme.radii.md,
                borderTopLeftRadius: theme.radii.md,
                borderTopRightRadius: theme.radii.md,
                backgroundColor: theme.colors.transparent,
                ":focus-within": {
                  border: `none`,
                },
              },
            },
            InputContainer: {
              style: {
                backgroundColor: theme.colors.transparent,
              },
            },
            Input: {
              style: {
                lineHeight: "1.4",
                height: `${realHeight}px`,
                minHeight: `${MIN_HEIGHT - 2}px`,
                backgroundColor: theme.colors.transparent,
                "::placeholder": {
                  opacity: "0.7",
                },
                // Baseweb requires long-hand props, short-hand leads to weird bugs & warnings.
                paddingRight: theme.spacing.sm,
                paddingLeft: theme.spacing.sm,
                paddingBottom: theme.spacing.sm,
                paddingTop: theme.spacing.sm,
              },
            },
          }}
        />
        <InputInstructions
          dirty={dirty}
          value={value}
          maxLength={element.maxChars}
          // TODO: Refactor InputInstructions to be more semantic
          type="single"
        />
      </StyledChatInput>
      <StyledSendIconContainer
        height={`${realHeight}px`}
        onClick={handleSubmit}
      >
        <Icon content={Send} size="lg" />
      </StyledSendIconContainer>
    </StyledChatInputContainer>
  )

  // {element.position === "bottom" && (
  //   // Show a background overlaying the part underneath the floating chat input:
  //   <StyledChatInputBackground width={this.props.width} />
  // )}
}

export default ChatInput
