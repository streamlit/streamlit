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

import React, { RefObject } from "react"
import { withTheme } from "@emotion/react"
import { ChatInput as ChatInputProto } from "src/lib/proto"
import { WidgetStateManager, Source } from "src/lib/WidgetStateManager"

import { Textarea as UITextArea } from "baseui/textarea"
import InputInstructions from "src/lib/components/shared/InputInstructions/InputInstructions"
import {
  StyledChatInputContainer,
  StyledChatInput,
  StyledSendIconContainer,
  StyledChatInputBackground,
  StyledSendIcon,
} from "./styled-components"
import Send from "./send.svg"
import { hasLightBackgroundColor, EmotionTheme } from "src/lib/theme"

const MIN_HEIGHT = 40.4 // 40.4 is the default height of a text input
const MAX_HEIGHT = 230

export interface Props {
  theme: EmotionTheme
  disabled: boolean
  element: ChatInputProto
  widgetMgr: WidgetStateManager
  width: number
}

interface State {
  /**
   * True if the user-specified state.value has not yet been synced to the WidgetStateManager.
   */
  dirty: boolean

  /**
   * The value specified by the user via the UI. If the user didn't touch this
   * widget's UI, the default value is used.
   */
  value: string

  /**
   * The value of the height of the textarea. It depends on a variety of factors
   * including the default height, and autogrowing
   */
  scrollHeight: number
}

class ChatInput extends React.PureComponent<Props, State> {
  // TODO(lukasmasuch): I assume we don't need to do this since chat_input is allowed in forms.
  // private readonly formClearHelper = new FormClearHelper()

  private chatInputRef: RefObject<HTMLTextAreaElement> = React.createRef()

  public state: State = {
    dirty: false,
    value: this.initialValue,
    scrollHeight: 0,
  }

  get initialValue(): string {
    // If WidgetStateManager knew a value for this widget, initialize to that.
    // Otherwise, use the default value from the widget protobuf.
    // TODO(lukasmasuch): Since it is a trigger value we probably don't need to do this.
    // const storedValue = this.props.widgetMgr.getStringValue(this.props.element)
    // return storedValue !== undefined ? storedValue : this.props.element.default
    return this.props.element.default
  }

  public componentDidMount(): void {
    this.maybeUpdateFromProtobuf()
    // else {
    //   this.commitWidgetValue({ fromUi: false })
    // }

    // TODO(lukasmasuch): This is super hacky, but we probably want to remove
    // the footer as soon as there is a floating chat input on the page.
    // const footerElements = document.getElementsByTagName("footer")
    // if (footerElements && footerElements.length === 1) {
    //   footerElements[0].remove()
    // }
  }

  public componentDidUpdate(): void {
    this.maybeUpdateFromProtobuf()
  }

  public componentWillUnmount(): void {
    // TODO(lukasmasuch): I assume we don't need to do this since chat_input is allowed in forms.
    // this.formClearHelper.disconnect()
  }

  private maybeUpdateFromProtobuf(): void {
    if (this.props.element.setValue) {
      const { value } = this.props.element
      this.props.element.setValue = false
      this.setState({ value, dirty: true }, () => {
        const scrollHeight = this.getScrollHeight()
        this.setState({ scrollHeight })
      })
    }
  }

  /** Commit state.value to the WidgetStateManager. */
  private commitWidgetValue = (source: Source): void => {
    this.props.widgetMgr.setStringTriggerValue(
      this.props.element,
      this.state.value,
      source
    )

    // Reset the value in the chat input to empty string:
    this.setState({ dirty: false, value: "", scrollHeight: 0 })
  }

  // TODO(lukasmasuch): I assume we don't need to do this since chat_input is allowed in forms:
  /**
   * If we're part of a clear_on_submit form, this will be called when our
   * form is submitted. Restore our default value and update the WidgetManager.
   */
  // private onFormCleared = (): void => {
  //   this.setState(
  //     (_, prevProps) => {
  //       return { value: prevProps.element.default }
  //     },
  //     () => this.commitWidgetValue({ fromUi: true })
  //   )
  // }

  private getScrollHeight = (): number => {
    let scrollHeight = 0
    const { current: textarea } = this.chatInputRef
    if (textarea) {
      textarea.style.height = "auto"
      scrollHeight = textarea.scrollHeight
      textarea.style.height = ""
    }

    return scrollHeight
  }

  private onChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    const { value } = e.target
    const { element } = this.props
    const { maxChars } = element

    if (maxChars !== 0 && value.length > maxChars) {
      return
    }

    const scrollHeight = this.getScrollHeight()
    this.setState({ dirty: true, value, scrollHeight })
  }

  isEnterKeyPressed = (
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ): boolean => {
    // TODO(lukasmasuch): keyCode is deprecated, is it still fine to use?
    const { keyCode, key } = event

    // Using keyCode as well due to some different behaviors on Windows
    // https://bugs.chromium.org/p/chromium/issues/detail?id=79407
    return key === "Enter" || keyCode === 13 || keyCode === 10
  }

  private onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    const { metaKey, ctrlKey, shiftKey } = e
    const isEnterKeyPressed = this.isEnterKeyPressed(e)
    const shouldSubmit = isEnterKeyPressed && !shiftKey && !ctrlKey && !metaKey

    if (shouldSubmit) {
      e.preventDefault()

      this.commitWidgetValue({ fromUi: true })
    }
  }

  private handleSubmit = (): void => {
    this.commitWidgetValue({ fromUi: true })
  }

  public render(): React.ReactNode {
    const { theme, element, disabled } = this.props
    const { value, dirty, scrollHeight } = this.state
    const { placeholder } = element

    const sticky = true

    const realHeight = Math.min(Math.max(scrollHeight, MIN_HEIGHT), MAX_HEIGHT)
    const lightTheme = hasLightBackgroundColor(theme)

    // TODO(lukasmasuch): I believe we can just remove manageFormClearListener since
    // we don't allow chat input in forms anyways (will show an exception triggered on Python side)
    // this.formClearHelper.manageFormClearListener(
    //   widgetMgr,
    //   element.formId,
    //   this.onFormCleared
    // )

    return (
      <>
        <StyledChatInputContainer
          className="stChatInputContainer"
          width={this.props.width}
          sticky={sticky}
        >
          <StyledChatInput>
            <UITextArea
              data-testid="stChatInput"
              inputRef={this.chatInputRef}
              value={value}
              placeholder={placeholder}
              onChange={this.onChange}
              onKeyDown={this.onKeyDown}
              aria-label={placeholder}
              disabled={disabled}
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
                    ":focus-within": {
                      border: `none`,
                    },
                  },
                },
                Input: {
                  style: {
                    lineHeight: "1.4",
                    height: `${realHeight - 2}px`,
                    minHeight: `${MIN_HEIGHT - 2}px`,
                    borderColor: lightTheme
                      ? theme.colors.gray20
                      : theme.colors.gray90,
                    backgroundColor: lightTheme
                      ? theme.colors.gray10
                      : theme.colors.gray90,
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
              type={"chat"}
            />
          </StyledChatInput>
          <StyledSendIconContainer
            height={`${realHeight}px`}
            onClick={this.handleSubmit}
          >
            <StyledSendIcon src={Send} alt="Send" />
          </StyledSendIconContainer>
        </StyledChatInputContainer>
        {/* Show a background overlaying the part underneath the floating chat input: */}
        {sticky && <StyledChatInputBackground width={this.props.width} />}
      </>
    )
  }
}

export default withTheme(ChatInput)
