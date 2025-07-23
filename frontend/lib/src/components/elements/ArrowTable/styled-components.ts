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

import styled, { CSSObject } from "@emotion/styled"

import { EmotionTheme } from "~lib/theme"

export const StyledTableContainer = styled.div(({ theme }) => ({
  fontSize: theme.fontSizes.md,
  fontFamily: theme.genericFonts.bodyFont,
  lineHeight: theme.lineHeights.small,
  captionSide: "bottom",
}))

export const StyledTableCaption = styled.div(({ theme }) => ({
  fontFamily: theme.genericFonts.bodyFont,
  fontSize: theme.fontSizes.sm,
  paddingTop: theme.spacing.sm,
  paddingBottom: 0,
  color: theme.colors.fadedText60,
  textAlign: "left",
  wordWrap: "break-word",
  display: "inline-block",
}))

export const StyledTableBorder = styled.div(({ theme }) => ({
  // Add the enclosing border on an extra wrapper around the table. This ensures that
  // when the table scrolls horizontally on small windows, it still shows a border all
  // around the table and the table doesn't look cut off.
  border: `${theme.sizes.borderWidth} solid ${theme.colors.dataframeBorderColor}`,
  borderRadius: theme.radii.default,
  overflow: "auto",
}))

export const StyledTable = styled.table(({ theme }) => ({
  width: theme.sizes.full,
  color: theme.colors.bodyText,
  borderSpacing: 0,
}))

const styleCellFunction = (theme: EmotionTheme): CSSObject => ({
  // Only have borders on the bottom and right of each cell. And remove the borders
  // of the last row and column to prevent double borders together with the enclosing
  // border from `StyledTableBorder`.
  borderBottom: `${theme.sizes.borderWidth} solid ${theme.colors.dataframeBorderColor}`,
  "tbody tr:last-child &": {
    borderBottom: "none",
  },
  borderRight: `${theme.sizes.borderWidth} solid ${theme.colors.dataframeBorderColor}`,
  "&:last-child": {
    borderRight: "none",
  },
  verticalAlign: "middle",
  padding: `${theme.spacing.twoXS} ${theme.spacing.xs}`,
  fontWeight: theme.fontWeights.normal,
})

export const StyledTableCell = styled.td(({ theme }) =>
  styleCellFunction(theme)
)
export const StyledTableCellHeader = styled.th(({ theme }) => ({
  ...styleCellFunction(theme),
  textAlign: "inherit",
  color: theme.colors.fadedText60,
  paddingLeft: theme.spacing.sm,
}))

export const StyledEmptyTableCell = styled(StyledTableCell)(({ theme }) => ({
  color: theme.colors.darkGray,
  fontStyle: "italic",
  fontSize: theme.fontSizes.md,
  textAlign: "center",
}))
