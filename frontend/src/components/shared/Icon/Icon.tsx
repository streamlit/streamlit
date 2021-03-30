/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { ReactElement } from "react"
import { EmotionIcon } from "@emotion-icons/emotion-icon"
import { IconSize, ThemeColor } from "src/theme"
import { StyledIcon } from "./styled-components"

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
    size={size || "md"}
    color={color || "inherit"}
    margin={margin || ""}
    padding={padding || ""}
    aria-hidden="true"
  />
)

export default Icon
