/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
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

import { styled } from "styletron-react"
import { colors, fontStyles } from "lib/widgetTheme"
import { mkenum } from "lib/utils"

export const Kind = mkenum({
  SECONDARY: "secondary",
  DANGER: "danger",
})
type Kind = typeof Kind[keyof typeof Kind]

interface TextProps {
  kind?: Kind
}

export const Small = styled("small", ({ kind }: TextProps) => ({
  color: kind ? colors[kind] : colors.grayDark,
  fontSize: fontStyles.fontSizeSm,
  height: fontStyles.fontSizeSm,
  lineHeight: fontStyles.fontSizeSm,
  display: "flex",
  alignItems: "center",
}))
