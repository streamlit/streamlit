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

export const StyledDocSummary = styled.span(({ theme }) => ({
  "& > *": {
    marginRight: theme.spacing.sm,
  },
}))

export const StyledDocName = styled.span(({ theme }) => ({
  fontWeight: theme.fontWeights.codeBold,
}))

export const StyledDocType = styled.span(({ theme }) => ({
  color: theme.colors.codeTextColor,
}))

export const StyledDocValue = styled.span()

export const StyledDocContainer = styled.span(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  borderRadius: theme.radii.default,
  border: `${theme.sizes.borderWidth} solid ${theme.colors.borderColor}`,
  fontFamily: theme.genericFonts.codeFont,
  fontSize: theme.fontSizes.codeFontSize,
  fontWeight: theme.fontWeights.code,
}))

export const StyledDocHeader = styled.div(({ theme }) => ({
  padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
  backgroundColor: theme.colors.bgMix,
  borderBottom: `${theme.sizes.borderWidth} solid ${theme.colors.borderColor}`,
  // Add rounded corners to the top of the container to prevent the background
  // color from bleeding into the surrounding area.
  borderTopLeftRadius: theme.radii.default,
  borderTopRightRadius: theme.radii.default,
  fontSize: theme.fontSizes.codeFontSize,
  overflow: "auto",
}))

export const StyledDocString = styled.div(({ theme }) => ({
  whiteSpace: "pre",
  overflow: "auto",
  maxHeight: "30.5rem", // The extra 0.5rem is to show a little of the overflowing line.
  padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
  fontSize: theme.fontSizes.codeFontSize,

  "&:not(:last-child)": {
    borderBottom: `${theme.sizes.borderWidth} solid ${theme.colors.borderColor}`,
  },
}))

export const StyledMembersTable = styled.table(({ theme }) => ({
  width: "100%",
  fontSize: theme.fontSizes.codeFontSize,
  backgroundColor: theme.colors.bgMix,
  tableLayout: "fixed", // Fix table to container's boundaries.
  borderCollapse: "collapse",
  // Add rounded corners to the bottom of the table to match container
  borderBottomLeftRadius: theme.radii.default,
  borderBottomRightRadius: theme.radii.default,
}))

export const StyledMembersRow = styled.tr(({ theme }) => ({
  "&:not(:last-child)": {
    borderBottom: `${theme.sizes.borderWidth} solid ${theme.colors.borderColor}`,
  },
}))

export const StyledMembersSummaryCell = styled.td(({ theme }) => ({
  width: "30%",
  overflow: "auto",
  padding: `${theme.spacing.sm} ${theme.spacing.lg}`,

  "& > *": {
    marginRight: theme.spacing.sm,
  },
}))

export const StyledMembersDetailsCell = styled.td(({ theme }) => ({
  width: "70%",
  overflow: "auto",
  padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
}))
