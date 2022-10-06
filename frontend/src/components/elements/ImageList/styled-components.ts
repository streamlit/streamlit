/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

export const StyledImageList = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  flexWrap: "wrap",
  // Not supported in Safari, but at least it's not a regression for those users:
  rowGap: theme.spacing.lg,
}))

export const StyledImageContainer = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  width: "auto",
  flexGrow: 0,
}))

export const StyledCaption = styled.div(({ theme }) => ({
  fontFamily: theme.genericFonts.bodyFont,
  fontSize: theme.fontSizes.sm,
  color: theme.colors.fadedText60,
  textAlign: "center",
  marginTop: theme.spacing.xs,
  wordWrap: "break-word",
  padding: "0.125rem",
}))
