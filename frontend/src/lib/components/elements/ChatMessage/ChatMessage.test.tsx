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
import { render } from "src/lib/test_util"
import { Block as BlockProto } from "src/lib/proto"

import ChatMessage, { Props as ChatMessageProps } from "./ChatMessage"

const getProps = (props?: Partial<ChatMessageProps>): ChatMessageProps =>
  Object({
    label: "user",
    avatarType: BlockProto.ChatMessage.AvatarType.ICON,
    avatar: "user",
    ...props,
  })

describe("Chat message container", () => {
  it("renders without crashing", () => {
    const props = getProps()
    const rtlResults = render(<ChatMessage {...props} />)
    expect(rtlResults).toBeDefined()
  })
  // TODO(lukasmasuch): Implement tests
})
