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

import React, { ReactElement, ReactNode } from "react"
import { Face, Try } from "@emotion-icons/material-outlined"

import { Block as BlockProto } from "src/lib/proto"
import Icon from "src/lib/components/shared/Icon"
import { useTheme } from "@emotion/react"

import { EmotionTheme } from "src/lib/theme"

import {
  StyledChatMessageContainer,
  StyledMessageContent,
  StyledAvatarImage,
  StyledAvatarIcon,
  StyledAvatarEmoji,
} from "./styled-components"

export interface Props {
  avatar: string
  avatarType: BlockProto.ChatMessage.AvatarType
  background: string
  label: string
  children: ReactNode
}

function ChatMessage(props: Props): ReactElement {
  const theme: EmotionTheme = useTheme()
  const { avatar, avatarType, background, label, children } = props

  let avatarElement
  if (avatarType === BlockProto.ChatMessage.AvatarType.IMAGE) {
    avatarElement = <StyledAvatarImage src={avatar} alt={`${label} avatar`} />
  } else if (avatarType === BlockProto.ChatMessage.AvatarType.EMOJI) {
    avatarElement = <StyledAvatarEmoji>{avatar}</StyledAvatarEmoji>
  } else if (avatarType === BlockProto.ChatMessage.AvatarType.ICON) {
    if (avatar === "user") {
      avatarElement = (
        <StyledAvatarIcon background={theme.colors.red60}>
          <Icon content={Face} size="lg" />
        </StyledAvatarIcon>
      )
    } else {
      avatarElement = (
        <StyledAvatarIcon background={theme.colors.orange60}>
          <Icon content={Try} size="lg" />
        </StyledAvatarIcon>
      )
    }
  }

  return (
    <StyledChatMessageContainer background={background}>
      {avatarElement}
      <StyledMessageContent>{children}</StyledMessageContent>
    </StyledChatMessageContainer>
  )
}

export default ChatMessage
