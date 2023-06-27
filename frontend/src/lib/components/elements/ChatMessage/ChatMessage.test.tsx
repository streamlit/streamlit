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

import React from "react"
import "@testing-library/jest-dom"

import { render } from "src/lib/test_util"
import { Block as BlockProto } from "src/lib/proto"

import ChatMessage, { ChatMessageProps } from "./ChatMessage"

const getProps = (
  elementProps: Partial<BlockProto.ChatMessage> = {}
): ChatMessageProps => ({
  element: BlockProto.ChatMessage.create({
    name: "user",
    avatarType: BlockProto.ChatMessage.AvatarType.ICON,
    avatar: "user",
    ...elementProps,
  }),
})

describe("ChatMessage", () => {
  it("renders without crashing", () => {
    const props = getProps()
    const rtlResults = render(<ChatMessage {...props} />)
    expect(rtlResults).toBeDefined()
  })

  it("renders message children content", () => {
    const props = getProps()
    const { getByLabelText } = render(
      <ChatMessage {...props}>Hello, world!</ChatMessage>
    )
    expect(getByLabelText("Chat message from user").textContent).toBe(
      "Hello, world!"
    )
  })

  it("renders with an emoji avatar", () => {
    const props = getProps({
      avatar: "😃",
      avatarType: BlockProto.ChatMessage.AvatarType.EMOJI,
    })
    const rtlResults = render(<ChatMessage {...props} />)
    expect(rtlResults.getByText("😃")).toBeTruthy()
  })

  it("renders with an image avatar", () => {
    const props = getProps({
      avatar: "http://example.com/avatar.jpg",
      avatarType: BlockProto.ChatMessage.AvatarType.IMAGE,
    })
    const { container } = render(<ChatMessage {...props} />)
    const images = container.getElementsByTagName("img")
    expect(images.length).toEqual(1)
    expect(images[0].src).toBe("http://example.com/avatar.jpg")
  })

  it("renders with a name label character as fallback", () => {
    const props = getProps({
      avatar: undefined,
      avatarType: undefined,
      name: "test",
    })
    const { getByText } = render(<ChatMessage {...props} />)
    expect(getByText("T")).toBeTruthy()
  })

  it("renders with a 'user' icon avatar", () => {
    const props = getProps({
      avatar: "user",
      avatarType: BlockProto.ChatMessage.AvatarType.ICON,
      name: "foo",
    })
    const { container } = render(<ChatMessage {...props} />)

    const svgs = container.getElementsByTagName("svg")
    expect(svgs.length).toEqual(1)
  })

  it("renders with a 'assistant' icon avatar", () => {
    const props = getProps({
      avatar: "assistant",
      avatarType: BlockProto.ChatMessage.AvatarType.ICON,
      name: "foo",
    })
    const { container } = render(<ChatMessage {...props} />)

    const svgs = container.getElementsByTagName("svg")
    expect(svgs.length).toEqual(1)
  })

  it("renders with a grey background when name is 'user'", () => {
    const props = getProps({
      name: "user",
    })
    const { container } = render(<ChatMessage {...props} />)
    const messageContainer = container.firstChild
    expect(messageContainer).toHaveStyle(
      "background-color: rgba(240, 242, 246, 0.5)"
    )
  })

  it("sets an aria label on the chat message", () => {
    const props = getProps()
    const { getByTestId } = render(<ChatMessage {...props} />)

    const chatMessageContent = getByTestId("stChatMessageContent")
    expect(chatMessageContent.getAttribute("aria-label")).toEqual(
      "Chat message from user"
    )
  })
})
