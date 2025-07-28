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

import React, { ReactElement, ReactNode } from "react"

import { EmotionIcon } from "@emotion-icons/emotion-icon"

import { IconSize } from "~lib/theme"

import { StyledEmojiIcon, StyledIcon } from "./styled-components"

interface GetDefaultPropsArgs {
  size?: IconSize
  margin?: string
  padding?: string
  color?: string
}

interface DefaultProps {
  size: IconSize
  margin: string
  padding: string
  color: string | undefined
}

const getDefaultProps = ({
  size,
  margin,
  padding,
  color,
}: GetDefaultPropsArgs): DefaultProps => ({
  size: size || "md",
  margin: margin || "",
  padding: padding || "",
  color: color || undefined,
})

interface IconProps {
  content: EmotionIcon
  size?: IconSize
  color?: string
  margin?: string
  padding?: string
  testid?: string
}

const Icon = ({
  content,
  color,
  size,
  margin,
  padding,
  testid,
}: IconProps): ReactElement => (
  <StyledIcon
    as={content}
    aria-hidden="true"
    data-testid={testid}
    {...getDefaultProps({ size, margin, padding, color })}
  />
)

interface EmojiIconProps {
  size?: IconSize
  margin?: string
  padding?: string
  children: ReactNode
  testid?: string
  color?: string
}

export const EmojiIcon = ({
  size,
  margin,
  padding,
  children,
  color,
  testid,
}: EmojiIconProps): ReactElement => {
  // Handle the case where the emoji is prefixed with emoji:
  if (typeof children === "string") {
    children = children.replace(/^emoji:/, "")
  }

  return (
    <StyledEmojiIcon
      data-testid={testid || "stIconEmoji"}
      aria-hidden="true"
      {...getDefaultProps({ size, margin, padding, color })}
    >
      {children}
    </StyledEmojiIcon>
  )
}

export default Icon
