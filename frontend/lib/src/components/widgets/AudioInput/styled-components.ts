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

import styled from "@emotion/styled"
import { HEIGHT } from "./constants"
import { Theme, withTheme } from "@emotion/react"

export const Container = styled.div(({ theme }) => ({}))

export const StyledNoMicInputContainerDiv = styled.div(({ theme }) => ({
  width: "100%",
  textAlign: "center",
}))

export const StyledNoMicPermissionsErrorTextSpan = styled.span(
  ({ theme }) => ({})
)

export const StyledNoMicInputLearnMoreLink = styled.a(({ theme }) => ({}))

export const StyledPlaceholderContainerDiv = styled.div(() => ({
  height: `${HEIGHT}px`,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
}))

export const StyledPlaceholderDotsDiv = styled.div(
  ({ theme }: { theme: Theme }) => ({
    height: "10px",
    opacity: 0.2,
    width: "100%",
    backgroundImage: `radial-gradient(${theme.colors.fadedText10} 40%, transparent 40%)`,
    backgroundSize: "10px 10px",
    backgroundRepeat: "repeat",
  })
)
