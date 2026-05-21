/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import { PropsWithChildren } from "react"

import type { CSSObject } from "@emotion/react"
import styled from "@emotion/styled"

import { createThemeCssVariables } from "~lib/theme/getThemeCssVariables"
import type { EmotionTheme } from "~lib/theme/types"

type StyledThemeCssVariablesProps = {
  cssVariables: CSSObject
}

// Nested themes need a real DOM ancestor for CSS variable inheritance, but
// `display: contents` keeps the wrapper layout-neutral. Portaled surfaces need
// to stamp the same variables onto their portal container separately.
const StyledThemeCssVariables = styled.div<StyledThemeCssVariablesProps>(
  ({ cssVariables }) => ({
    ...cssVariables,
    display: "contents",
  })
)

interface ThemeCssVariablesProps extends PropsWithChildren {
  theme: EmotionTheme
}

function ThemeCssVariables({
  theme,
  children,
}: ThemeCssVariablesProps): JSX.Element {
  const cssVariables = createThemeCssVariables(theme)

  return (
    <StyledThemeCssVariables cssVariables={cssVariables}>
      {children}
    </StyledThemeCssVariables>
  )
}

export default ThemeCssVariables
