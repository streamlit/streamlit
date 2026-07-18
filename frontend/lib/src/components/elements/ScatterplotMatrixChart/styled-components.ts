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

import styled from "@emotion/styled"

export const StyledScatterplotMatrixChart = styled.div(({ theme }) => ({
  width: "100%",
  height: "100%",
  minHeight: "17.5rem",
  position: "relative",
  overflow: "hidden",
  borderRadius: theme.radii.default,
}))

export interface StyledScatterplotMatrixCanvasProps {
  isDisabled: boolean
}

export const StyledScatterplotMatrixCanvas =
  styled.canvas<StyledScatterplotMatrixCanvasProps>(({ isDisabled }) => ({
    display: "block",
    width: "100%",
    height: "100%",
    touchAction: "none",
    outline: "none",
    pointerEvents: isDisabled ? "none" : "auto",
  }))
