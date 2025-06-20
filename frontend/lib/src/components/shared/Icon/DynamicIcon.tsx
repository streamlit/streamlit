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

import React, { Suspense } from "react"

import { IconSize } from "~lib/theme"

import { EmojiIcon } from "./Icon"
import MaterialFontIcon from "./Material/MaterialFontIcon"
import { StyledDynamicIcon, StyledImageIcon } from "./styled-components"

interface IconPackEntry {
  pack: string
  icon: string
}

function parseIconPackEntry(iconName: string): IconPackEntry {
  // This is a regex to match icon pack and icon name from the strings of format
  // :pack/icon: like :material/settings_suggest:
  const matchResult = iconName.match(/^:(.+)\/(.+):$/)
  if (matchResult === null) {
    return { pack: "emoji", icon: iconName }
  }
  const iconPack = matchResult[1]
  const iconNameInPack = matchResult[2]
  return { pack: iconPack, icon: iconNameInPack }
}

/**
 * Returns true if the icon value is a material icon.
 */
export function isMaterialIcon(iconName: string): boolean {
  return parseIconPackEntry(iconName).pack === "material"
}

/**
 *
 * @returns returns an img tag with a yellow filled star icon svg as base64 data
 */
export function getFilledStarIconSrc(): string {
  return "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBjbGlwLXBhdGg9InVybCgjY2xpcDBfMTg2MF84NDMpIj48cGF0aCBkPSJNOS45OTk5NCAxNC4zOTE2TDEzLjQ1ODMgMTYuNDgzM0MxNC4wOTE2IDE2Ljg2NjYgMTQuODY2NiAxNi4zIDE0LjY5OTkgMTUuNTgzM0wxMy43ODMzIDExLjY1TDE2Ljg0MTYgOC45OTk5N0MxNy4zOTk5IDguNTE2NjMgMTcuMDk5OSA3LjU5OTk3IDE2LjM2NjYgNy41NDE2M0wxMi4zNDE2IDcuMTk5OTdMMTAuNzY2NiAzLjQ4MzNDMTAuNDgzMyAyLjgwODMgOS41MTY2MSAyLjgwODMgOS4yMzMyNyAzLjQ4MzNMNy42NTgyNyA3LjE5MTYzTDMuNjMzMjcgNy41MzMzQzIuODk5OTQgNy41OTE2MyAyLjU5OTk0IDguNTA4MyAzLjE1ODI3IDguOTkxNjNMNi4yMTY2MSAxMS42NDE2TDUuMjk5OTQgMTUuNTc1QzUuMTMzMjcgMTYuMjkxNiA1LjkwODI3IDE2Ljg1ODMgNi41NDE2MSAxNi40NzVMOS45OTk5NCAxNC4zOTE2WiIgZmlsbD0iI0ZBQ0EyQiIvPjwvZz48ZGVmcz48Y2xpcFBhdGggaWQ9ImNsaXAwXzE4NjBfODQzIj48cmVjdCB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIGZpbGw9IndoaXRlIi8+PC9jbGlwUGF0aD48L2RlZnM+PC9zdmc+"
}

export interface DynamicIconProps {
  iconValue: string
  size?: IconSize
  margin?: string
  padding?: string
  testid?: string
  color?: string
}

const DynamicIconDispatcher = ({
  iconValue,
  ...props
}: DynamicIconProps): React.ReactElement => {
  const { pack, icon } = parseIconPackEntry(iconValue)
  switch (pack) {
    case "material":
      switch (icon) {
        case "star_filled":
          return (
            <StyledDynamicIcon {...props}>
              <StyledImageIcon
                src={getFilledStarIconSrc()}
                data-testid={props.testid || "stImageIcon"}
              />
            </StyledDynamicIcon>
          )
        default:
          return (
            <StyledDynamicIcon {...props}>
              <MaterialFontIcon pack={pack} iconName={icon} {...props} />
            </StyledDynamicIcon>
          )
      }
    case "emoji":
    default:
      return (
        <StyledDynamicIcon {...props}>
          <EmojiIcon {...props}>{icon}</EmojiIcon>
        </StyledDynamicIcon>
      )
  }
}

export const DynamicIcon = (props: DynamicIconProps): React.ReactElement => (
  <Suspense
    fallback={
      <StyledDynamicIcon {...props}>
        <EmojiIcon {...props}>&nbsp;</EmojiIcon>
      </StyledDynamicIcon>
    }
    key={props.iconValue}
  >
    <DynamicIconDispatcher {...props} />
  </Suspense>
)
