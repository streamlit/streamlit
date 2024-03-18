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

import React, { ReactElement, ReactNode } from "react"
import { EmotionIcon } from "@emotion-icons/emotion-icon"
import { IconSize, ThemeColor } from "@streamlit/lib/src/theme"
import { StyledIcon, StyledEmojiIcon } from "./styled-components"
import * as MaterialIcons from "@emotion-icons/material"
import * as MaterialIconsOutlined from "@emotion-icons/material-outlined"

interface DefaultProps {
  size: IconSize
  margin: string
  padding: string
  color: ThemeColor
}

const getDefaultProps = ({
  size,
  margin,
  padding,
  color,
}: Partial<DefaultProps>): DefaultProps => ({
  size: size || "md",
  margin: margin || "",
  padding: padding || "",
  color: color || "inherit",
})

interface MaterialIconProps {
  iconName: string
  size?: IconSize
  color?: ThemeColor
  margin?: string
  padding?: string
  testid?: string
}

export const MaterialIcon = ({
  size,
  margin,
  padding,
  testid,
  iconName,
}: MaterialIconProps): ReactElement => {
  console.log("MAMA MAMA JAN")
  const re = /^:(.*):(.*):$/
  const matchResult = iconName.match(re)
  let packName = ""
  let icon = ""
  if (matchResult !== null) {
    packName = matchResult[1]
    icon = matchResult[2]

    console.log("BBBBBBB")
    console.log(packName)
    console.log(icon)
  }
  let content: EmotionIcon
  if (packName === "material") {
    content = MaterialIcons[icon as keyof typeof MaterialIcons]
  } else if (packName === "material-outlined") {
    content = MaterialIconsOutlined[icon as keyof typeof MaterialIconsOutlined]
  } else {
    throw new Error(`Unexpected icon pack: ${packName}`)
  }
  console.log("JJJJJJJJJ")
  console.log(content)
  return (
    <StyledIcon
      as={content}
      data-testid={testid}
      aria-hidden="true"
      {...getDefaultProps({ size, margin, padding })}
    ></StyledIcon>
  )
}

export default MaterialIcon
