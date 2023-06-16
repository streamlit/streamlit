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

import React, { ReactElement } from "react"
import { Face, SmartToy } from "@emotion-icons/material-outlined"

import { Block as BlockProto } from "src/lib/proto"
import Icon from "src/lib/components/shared/Icon"
import { useTheme } from "@emotion/react"

import { EmotionTheme } from "src/lib/theme"

import {
  StyledChatMessageContainer,
  StyledMessageContent,
  StyledAvatarImage,
  StyledAvatarIcon,
  StyledAvatarBackground,
} from "./styled-components"

interface ChatMessageAvatarProps {
  label: string
  avatar?: string
  avatarType?: BlockProto.ChatMessage.AvatarType
}

function ChatMessageAvatar(props: ChatMessageAvatarProps): ReactElement {
  const { avatar, avatarType, label } = props
  const theme: EmotionTheme = useTheme()

  if (avatar) {
    switch (avatarType) {
      case BlockProto.ChatMessage.AvatarType.IMAGE:
        return <StyledAvatarImage src={avatar} alt={`${label} avatar`} />
      case BlockProto.ChatMessage.AvatarType.EMOJI:
        return <StyledAvatarBackground>{avatar}</StyledAvatarBackground>
      case BlockProto.ChatMessage.AvatarType.ICON:
        if (avatar === "user") {
          return (
            <StyledAvatarIcon background={theme.colors.red60}>
              <Icon content={Face} size="lg" />
            </StyledAvatarIcon>
          )
        } else if (avatar === "assistant") {
          return (
            <StyledAvatarIcon background={theme.colors.orange60}>
              <Icon content={SmartToy} size="lg" />
            </StyledAvatarIcon>
          )
        }
    }
  }

  // Fallback to first character of the label if nothing else can be matched:
  return (
    <StyledAvatarBackground>
      {label.length > 0 ? label.charAt(0).toUpperCase() : "🧑‍💻"}
    </StyledAvatarBackground>
  )
}

export interface ChatMessageProps {
  element: BlockProto.ChatMessage
}

const ChatMessage: React.FC<ChatMessageProps> = ({
  element,
  children,
}): ReactElement => {
  const { avatar, avatarType, background, label } = element

  return (
    <StyledChatMessageContainer background={background === "grey"}>
      <ChatMessageAvatar
        label={label}
        avatar={avatar}
        avatarType={avatarType}
        data-testid="stChatMessageAvatar"
      />
      <StyledMessageContent aria-label={`Chat message from ${label}`}>
        {children}
      </StyledMessageContent>
    </StyledChatMessageContainer>
  )
}

export default ChatMessage
