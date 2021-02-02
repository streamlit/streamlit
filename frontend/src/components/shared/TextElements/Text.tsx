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

import styled from "@emotion/styled"

export enum Kind {
  SECONDARY = "secondary",
  DANGER = "danger",
}

interface TextProps {
  kind?: Kind
}

export const Small = styled.small<TextProps>(({ kind, theme }) => {
  const secondaryColor = kind === Kind.SECONDARY && theme.colors.secondary
  const dangerColor = kind === Kind.DANGER && theme.colors.danger

  return {
    color: dangerColor || secondaryColor || theme.colors.darkGray,
    fontSize: theme.fontSizes.smDefault,
    height: theme.fontSizes.smDefault,
    lineHeight: theme.fontSizes.smDefault,
    display: "flex",
    alignItems: "center",
  }
})
