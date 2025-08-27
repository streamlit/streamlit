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

import { Arrow } from "@streamlit/protobuf"

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

export const StyledTableBorder = styled.div<{ borderMode: Arrow.BorderMode }>(
  ({ theme, borderMode }) => ({
    // Add the enclosing border on an extra wrapper around the table. This ensures that
    // when the table scrolls horizontally on small windows, it still shows a border all
    // around the table and the table doesn't look cut off.
    border:
      borderMode === Arrow.BorderMode.ALL
        ? `${theme.sizes.borderWidth} solid ${theme.colors.dataframeBorderColor}`
        : "none",
    borderRadius: theme.radii.default,
    overflow: "auto",
  })
)

export const StyledTable = styled.table(({ theme }) => ({
  width: theme.sizes.full,
  color: theme.colors.bodyText,
  borderSpacing: 0,
}))

const styleCellFunction = (
  theme: EmotionTheme,
  border: Arrow.BorderMode = Arrow.BorderMode.ALL
): CSSObject => ({
  // Only have borders on the bottom and right of each cell.
  borderBottom:
    border !== Arrow.BorderMode.NONE
      ? `${theme.sizes.borderWidth} solid ${theme.colors.dataframeBorderColor}`
      : "none",
  "tbody tr:last-child &": {
    // For "all" borders, remove bottom border of last row to prevent double border with
    // table border. For "horizontal" borders, also remove bottom border of last row
    // since there's no content after it.
    borderBottom:
      border === Arrow.BorderMode.ALL || border === Arrow.BorderMode.HORIZONTAL
        ? "none"
        : undefined,
  },
  borderRight:
    border === Arrow.BorderMode.ALL
      ? `${theme.sizes.borderWidth} solid ${theme.colors.dataframeBorderColor}`
      : "none",
  "&:last-child": {
    borderRight: border === Arrow.BorderMode.ALL ? "none" : undefined,
    // Remove right padding from last cell when no borders, so that the table aligns
    // with the rest of the page.
    paddingRight: border === Arrow.BorderMode.NONE ? "0" : theme.spacing.xs,
  },
  verticalAlign: "middle",
  padding: `${theme.spacing.twoXS} ${theme.spacing.xs}`,
  // Increase the space between columns when there are no vertical borders.
  "&:not(:first-of-type)": {
    paddingLeft:
      border === Arrow.BorderMode.NONE ||
      border === Arrow.BorderMode.HORIZONTAL
        ? theme.spacing.lg
        : theme.spacing.xs,
  },
  // Remove left padding from first column when no borders, so that the table aligns
  // with the rest of the page.
  "&:first-of-type": {
    paddingLeft: border === Arrow.BorderMode.NONE ? "0" : theme.spacing.xs,
  },
  fontWeight: theme.fontWeights.normal,
})

export const StyledTableCell = styled.td<{ borderMode: Arrow.BorderMode }>(
  ({ theme, borderMode }) => styleCellFunction(theme, borderMode)
)
export const StyledTableCellHeader = styled.th<{
  borderMode: Arrow.BorderMode
}>(({ theme, borderMode }) => ({
  ...styleCellFunction(theme, borderMode),
  textAlign: "inherit",
  color: theme.colors.fadedText60,
  // Remove left padding from first cell when no borders, so that the table aligns
  // with the rest of the page.
  "&:first-of-type": {
    paddingLeft: borderMode === Arrow.BorderMode.NONE ? "0" : theme.spacing.sm,
  },
  // Increase the space between columns when there are no vertical borders.
  "&:not(:first-of-type)": {
    paddingLeft:
      borderMode === Arrow.BorderMode.NONE ||
      borderMode === Arrow.BorderMode.HORIZONTAL
        ? theme.spacing.lg
        : theme.spacing.sm,
  },
}))

export const StyledEmptyTableCell = styled(StyledTableCell)<{
  borderMode: Arrow.BorderMode
}>(({ theme }) => ({
  color: theme.colors.darkGray,
  fontStyle: "italic",
  fontSize: theme.fontSizes.md,
  textAlign: "center",
}))
