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

export const StyledColorPicker = styled.div(({ theme }) => ({
  fontFamily: theme.genericFonts.bodyFont,
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
}))

// We need this to override the default font-family: 'Menlo' rule,
// Which causes the font to change to a serif one in Windows
export const StyledChromePicker = styled.div(({ theme }) => ({
  div: {
    fontFamily: `${theme.genericFonts.bodyFont} !important`,
  },
}))

export const StyledColorPreview = styled.div(({ theme }) => ({
  height: theme.sizes.minElementHeight,
  borderRadius: theme.radii.default,
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
  width: theme.sizes.minElementHeight,
  height: theme.sizes.minElementHeight,
  borderRadius: theme.radii.default,
  borderColor: theme.colors.fadedText10,
  borderWidth: theme.sizes.borderWidth,
  borderStyle: "solid",
  padding: "2px 0.8rem",
  cursor: "pointer",
  lineHeight: theme.lineHeights.base,
  "&:focus": {
    outline: "none",
  },
}))

export const StyledColorValue = styled.div(() => ({
  display: "flex",
  alignItems: "center",
  padding: "0 0.8rem",
  width: "95px",
}))
