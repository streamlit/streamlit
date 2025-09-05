/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import { screen } from "@testing-library/react"

import { Block as BlockProto } from "@streamlit/protobuf"

import { mockEndpoints } from "~lib/mocks/mocks"
import { render, renderWithContexts } from "~lib/test_util"

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
  endpoints: mockEndpoints({
    buildMediaURL: vi.fn().mockImplementation(url => url),
  }),
})

describe("ChatMessage", () => {
  it("renders without crashing", () => {
    const props = getProps()
    render(<ChatMessage {...props} />)

    const chatMessage = screen.getByTestId("stChatMessage")
    expect(chatMessage).toBeInTheDocument()
    expect(chatMessage).toHaveClass("stChatMessage")
  })

  it("renders message children content", () => {
    const props = getProps()
    render(<ChatMessage {...props}>Hello, world!</ChatMessage>)
    expect(screen.getByLabelText("Chat message from user").textContent).toBe(
      "Hello, world!"
    )
  })

  it("renders with an emoji avatar", () => {
    const props = getProps({
      avatar: "😃",
      avatarType: BlockProto.ChatMessage.AvatarType.EMOJI,
    })
    render(<ChatMessage {...props} />)
    expect(screen.getByText("😃")).toBeTruthy()
  })

  describe("image avatar", () => {
    it("renders with an image avatar", () => {
      const props = getProps({
        avatar: "http://example.com/avatar.jpg",
        avatarType: BlockProto.ChatMessage.AvatarType.IMAGE,
      })
      render(<ChatMessage {...props} />)
      const chatAvatar = screen.getByAltText("user avatar")
      expect(chatAvatar).toHaveAttribute(
        "src",
        "http://example.com/avatar.jpg"
      )
    })

    describe("crossOrigin attribute", () => {
      const scenarios = [
        {
          backendBaseUrl: undefined,
          description: "without BACKEND_BASE_URL",
        },
        {
          backendBaseUrl: "http://localhost:8501",
          description: "with BACKEND_BASE_URL",
        },
      ]

      afterEach(() => {
        // Clean up window.__streamlit after each test
        if (window.__streamlit) {
          delete window.__streamlit.BACKEND_BASE_URL
        }
      })

      it.each(scenarios)(
        "sets crossOrigin attribute when resourceCrossOriginMode is configured ($description)",
        ({ backendBaseUrl }) => {
          // Setup window.__streamlit.BACKEND_BASE_URL if specified
          if (backendBaseUrl) {
            window.__streamlit = window.__streamlit || {}
            window.__streamlit.BACKEND_BASE_URL = backendBaseUrl
          }

          const props = getProps({
            avatar: "avatar.jpg",
            avatarType: BlockProto.ChatMessage.AvatarType.IMAGE,
          })
          renderWithContexts(<ChatMessage {...props} />, {
            libConfig: { resourceCrossOriginMode: "anonymous" },
          })

          const chatAvatar = screen.getByAltText("user avatar")
          if (backendBaseUrl) {
            // When BACKEND_BASE_URL is set, crossOrigin should be set for relative URLs
            expect(chatAvatar).toHaveAttribute("crossOrigin", "anonymous")
          } else {
            // When BACKEND_BASE_URL is not set, crossOrigin should not be set for relative URLs (same-origin)
            expect(chatAvatar).not.toHaveAttribute("crossOrigin")
          }
        }
      )

      it.each(scenarios)(
        "does not set crossOrigin attribute when resourceCrossOriginMode is undefined ($description)",
        ({ backendBaseUrl }) => {
          // Setup window.__streamlit.BACKEND_BASE_URL if specified
          if (backendBaseUrl) {
            window.__streamlit = window.__streamlit || {}
            window.__streamlit.BACKEND_BASE_URL = backendBaseUrl
          }

          const props = getProps({
            avatar: "avatar.jpg",
            avatarType: BlockProto.ChatMessage.AvatarType.IMAGE,
          })
          renderWithContexts(<ChatMessage {...props} />, {
            libConfig: { resourceCrossOriginMode: undefined },
          })

          const chatAvatar = screen.getByAltText("user avatar")
          expect(chatAvatar).not.toHaveAttribute("crossOrigin")
        }
      )
    })
  })

  it("renders with a name label character as fallback", () => {
    const props = getProps({
      avatar: undefined,
      avatarType: undefined,
      name: "test",
    })
    render(<ChatMessage {...props} />)
    expect(screen.getByText("T")).toBeTruthy()
  })

  it("renders with a 'user' icon avatar", () => {
    const props = getProps({
      avatar: "user",
      avatarType: BlockProto.ChatMessage.AvatarType.ICON,
      name: "foo",
    })
    render(<ChatMessage {...props} />)

    const userAvatarIcon = screen.getByTestId("stChatMessageAvatarUser")
    expect(userAvatarIcon).toBeInTheDocument()
  })

  it("renders with a 'assistant' icon avatar", () => {
    const props = getProps({
      avatar: "assistant",
      avatarType: BlockProto.ChatMessage.AvatarType.ICON,
      name: "foo",
    })
    render(<ChatMessage {...props} />)

    const assistantAvatarIcon = screen.getByTestId(
      "stChatMessageAvatarAssistant"
    )
    expect(assistantAvatarIcon).toBeInTheDocument()
  })

  it("renders with a grey background when name is 'user'", () => {
    const props = getProps()
    render(<ChatMessage {...props} />)
    const chatMessage = screen.getByTestId("stChatMessage")
    expect(chatMessage).toHaveStyle(
      "background-color: rgba(240, 242, 246, 0.5)"
    )
  })

  it("sets an aria label on the chat message", () => {
    const props = getProps()
    render(<ChatMessage {...props} />)

    const chatMessageContent = screen.getByTestId("stChatMessageContent")
    expect(chatMessageContent.getAttribute("aria-label")).toEqual(
      "Chat message from user"
    )
  })
})
