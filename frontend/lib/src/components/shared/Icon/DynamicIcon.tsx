/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import { IconSize, ThemeColor } from "@streamlit/lib/src/theme"
import { EmojiIcon } from "./Icon"
import MaterialFontIcon from "./Material/MaterialFontIcon"
import { StyledDynamicIcon } from "./styled-components"

interface IconPackEntry {
  pack: string
  icon: string
}

function parseIconPackEntry(iconName: string): IconPackEntry {
  // This is a regex to match icon pack and icon name from the strings of format
  // :pack/icon: like :material/settings_suggest:
  const iconRegexp = /^:(.+)\/(.+):$/
  const matchResult = iconName.match(iconRegexp)
  if (matchResult === null) {
    return { pack: "emoji", icon: iconName }
  }
  const iconPack = matchResult[1]
  const iconNameInPack = matchResult[2]
  return { pack: iconPack, icon: iconNameInPack }
}

export function isMaterialIcon(option: string): boolean {
  const materialIconRegexp = /^:material\/(.+):$/
  const materialIconMatch = materialIconRegexp.exec(option)
  return materialIconMatch !== null
}

export interface DynamicIconProps {
  iconValue: string
  size?: IconSize
  margin?: string
  padding?: string
  testid?: string
  color?: ThemeColor
}

const DynamicIconDispatcher = ({
  iconValue,
  ...props
}: DynamicIconProps): React.ReactElement => {
  const { pack, icon } = parseIconPackEntry(iconValue)
  switch (pack) {
    case "material":
      return (
        <StyledDynamicIcon {...props}>
          <MaterialFontIcon pack={pack} iconName={icon} {...props} />
        </StyledDynamicIcon>
      )
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
