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

export const StyledColorPicker = styled.div(({ theme }) => ({
  fontFamily: theme.genericFonts.bodyFont,
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
}))

export const StyledColorPreview = styled.div(({ theme }) => ({
  height: "1.8rem",
  borderRadius: theme.radii.md,
  borderColor: theme.colors.fadedText10,
  cursor: "pointer",
  boxShadow: "none",
  lineHeight: theme.lineHeights.base,
  "&:focus": {
    outline: "none",
  },
  display: "flex",
}))

export const StyledColorBlock = styled.div(({ theme }) => ({
  height: "1.8rem",
  width: "1.8rem",
  borderRadius: theme.radii.md,
  borderColor: theme.colors.fadedText10,
  borderWidth: "1px",
  borderStyle: "solid",
  padding: "2px 0.8rem",
  cursor: "pointer",
  lineHeight: theme.lineHeights.base,
  "&:focus": {
    outline: "none",
  },
}))

export const StyledColorValue = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  padding: "0 0.8rem",
  width: "95px",
}))
