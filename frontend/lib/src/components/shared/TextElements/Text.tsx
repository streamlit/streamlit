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

import styled from "@emotion/styled"

export enum Kind {
  DANGER = "danger",
}

interface TextProps {
  kind?: Kind
  disabled?: boolean
}

export const Small = styled.small<TextProps>(({ kind, disabled, theme }) => {
  const { danger, fadedText60, fadedText40 } = theme.colors

  let color = fadedText60
  if (disabled) {
    color = fadedText40
  }
  if (kind === Kind.DANGER) {
    color = danger
  }

  return {
    color,
    fontSize: theme.fontSizes.sm,
    lineHeight: theme.lineHeights.tight,
  }
})
