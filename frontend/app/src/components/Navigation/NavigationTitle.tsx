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

import { FC, memo } from "react"

import styled from "@emotion/styled"
import { transparentize } from "color2k"

import {
  EmotionTheme,
  hasLightBackgroundColor,
  StreamlitMarkdown,
  useEmotionTheme,
} from "@streamlit/lib"

export interface NavigationTitleProps {
  /**
   * Title text which may contain markdown
   */
  title: string
  /**
   * Whether the title is for an active page
   */
  isActive?: boolean
  /**
   * Whether this is being rendered in the top navigation
   */
  isTopNav?: boolean
  /**
   * Whether navigation is disabled
   */
  disabled?: boolean
}

// Port over getNavTextColor from styled-components
const getNavTextColor = (
  theme: EmotionTheme,
  isActive: boolean,
  disabled: boolean = false,
  isTopNav?: boolean
): string => {
  if (disabled) {
    return theme.colors.fadedText40
  }

  if (isTopNav) {
    return theme.colors.bodyText
  }

  const isLightTheme = hasLightBackgroundColor(theme)

  if (isActive) {
    return theme.colors.bodyText
  }
  return isLightTheme
    ? transparentize(theme.colors.bodyText, 0.2)
    : transparentize(theme.colors.bodyText, 0.25)
}

const StyledStreamlitMarkdown = styled(StreamlitMarkdown)<{
  theme: EmotionTheme
  isActive: boolean
  isTopNav?: boolean
  disabled?: boolean
}>(({ theme, isActive, isTopNav, disabled }) => ({
  "& > div > p": {
    fontSize: theme.fontSizes.sm,
    fontFamily: "inherit",
    margin: 0,
    padding: 0,
    color: getNavTextColor(theme, isActive, disabled, isTopNav),
    fontWeight: isActive ? theme.fontWeights.bold : theme.fontWeights.normal,

    // Handle ellipsis
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",

    // Remove bottom margin added by markdown
    "&:last-child": {
      marginBottom: 0,
    },
  },
}))

/**
 * Component that renders page titles in navigation with markdown support.
 * Handles color states for active/inactive and disabled states.
 */

const NavigationTitle: FC<NavigationTitleProps> = ({
  title,
  isActive = false,
  isTopNav = false,
  disabled = false,
}): JSX.Element => {
  // Get current theme for styled component
  const theme = useEmotionTheme()

  return (
    <StyledStreamlitMarkdown
      source={title}
      allowHTML={false}
      isLabel={true}
      disableLinks={true}
      inheritFont={true}
      style={{ display: "inline" }}
      theme={theme}
      isActive={isActive}
      isTopNav={isTopNav}
      disabled={disabled}
    />
  )
}

export default memo(NavigationTitle)
