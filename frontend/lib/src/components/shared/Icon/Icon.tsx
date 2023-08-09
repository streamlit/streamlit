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
import { EmotionIcon } from "@emotion-icons/emotion-icon"
import { Check, ErrorOutline } from "@emotion-icons/material-outlined"
import { IconSize, ThemeColor, isPresetTheme } from "@streamlit/lib/src/theme"
import { LibContext } from "@streamlit/lib/src/components/core/LibContext"

import {
  StyledIcon,
  StyledEmojiIcon,
  StyledSpinner,
} from "./styled-components"

interface GetDefaultPropsArgs {
  size?: IconSize
  margin?: string
  padding?: string
}

interface DefaultProps {
  size: IconSize
  margin: string
  padding: string
}

const getDefaultProps = ({
  size,
  margin,
  padding,
}: GetDefaultPropsArgs): DefaultProps => ({
  size: size || "md",
  margin: margin || "",
  padding: padding || "",
})

interface IconProps {
  content: EmotionIcon
  size?: IconSize
  color?: ThemeColor
  margin?: string
  padding?: string
}

const Icon = ({
  content,
  color,
  size,
  margin,
  padding,
}: IconProps): ReactElement => (
  <StyledIcon
    as={content}
    color={color || "inherit"}
    aria-hidden="true"
    {...getDefaultProps({ size, margin, padding })}
  />
)

interface EmojiIconProps {
  size?: IconSize
  margin?: string
  padding?: string
  children: ReactNode
}

export const EmojiIcon = ({
  size,
  margin,
  padding,
  children,
}: EmojiIconProps): ReactElement => (
  <StyledEmojiIcon
    aria-hidden="true"
    {...getDefaultProps({ size, margin, padding })}
  >
    {children}
  </StyledEmojiIcon>
)

export interface CombinedIconProps {
  icon: string
  size?: IconSize
  color?: ThemeColor
  margin?: string
  padding?: string
}

export const CombinedIcon = (props: CombinedIconProps): ReactElement => {
  const { icon } = props
  const { activeTheme } = React.useContext(LibContext)

  if (icon === "spinner") {
    const usingCustomTheme = !isPresetTheme(activeTheme)
    return (
      <StyledSpinner
        usingCustomTheme={usingCustomTheme}
        {...getDefaultProps({ ...props })}
      />
    )
  } else if (icon === "check") {
    return <Icon content={Check} {...getDefaultProps({ ...props })} />
  } else if (icon === "error") {
    return <Icon content={ErrorOutline} {...getDefaultProps({ ...props })} />
  }
  // Interpret the icon as an emoji as a fallback:
  return <EmojiIcon {...getDefaultProps({ ...props })}>{icon}</EmojiIcon>
}

export default Icon
