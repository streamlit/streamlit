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

export const StyledDocSummary = styled.span(({ theme }) => ({
  "& > *": {
    marginRight: theme.spacing.sm,
  },
}))

export const StyledDocName = styled.span(({ theme }) => ({
  fontWeight: theme.fontWeights.bold,
}))

export const StyledDocType = styled.span(({ theme }) => ({
  color: theme.colors.docStringTypeText,
}))

export const StyledDocValue = styled.span()

export interface StyledDocContainerProps {
  width: number
}

export const StyledDocContainer = styled.span<StyledDocContainerProps>(
  ({ theme }) => ({
    display: "flex",
    flexDirection: "column",
    borderRadius: theme.radii.default,
    border: `${theme.sizes.borderWidth} solid ${theme.colors.borderColorLight}`,
    fontFamily: theme.genericFonts.codeFont,
    fontSize: theme.fontSizes.sm,
  })
)

export const StyledDocHeader = styled.div(({ theme }) => ({
  padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
  backgroundColor: theme.colors.docStringContainerBackground,
  borderBottom: `${theme.sizes.borderWidth} solid ${theme.colors.borderColorLight}`,
  fontSize: theme.fontSizes.sm,
  overflow: ["auto", "overlay"],
}))

export const StyledDocString = styled.div(({ theme }) => ({
  whiteSpace: "pre",
  overflow: ["auto", "overlay"],
  maxHeight: "30.5rem", // The extra 0.5rem is to show a little of the overflowing line.
  padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
  fontSize: theme.fontSizes.sm,

  "&:not(:last-child)": {
    borderBottom: `${theme.sizes.borderWidth} solid ${theme.colors.borderColorLight}`,
  },
}))

export const StyledMembersTable = styled.table(({ theme }) => ({
  width: "100%",
  fontSize: theme.fontSizes.twoSm,
  backgroundColor: theme.colors.docStringContainerBackground,
  tableLayout: "fixed", // Fix table to container's boundaries.
  borderCollapse: "collapse",
}))

export const StyledMembersRow = styled.tr(({ theme }) => ({
  "&:not(:last-child)": {
    borderBottom: `${theme.sizes.borderWidth} dotted ${theme.colors.borderColorLight}`,
  },
}))

export const StyledMembersSummaryCell = styled.td(({ theme }) => ({
  width: "30%",
  overflow: ["auto", "overlay"],
  padding: `${theme.spacing.sm} ${theme.spacing.lg}`,

  "& > *": {
    marginRight: theme.spacing.sm,
  },
}))

export const StyledMembersDetailsCell = styled.td(({ theme }) => ({
  width: "70%",
  overflow: ["auto", "overlay"],
  padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
}))
