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
  // Remove bottom border of last tbody row to prevent double border.
  // This works both when there's a tfoot (where tfoot has top border) and
  // when there's no tfoot (to prevent double border with table border).
  "tbody tr:last-child &": {
    borderBottom: "none",
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
  color: theme.colors.gray70,
  fontStyle: "italic",
  fontSize: theme.fontSizes.md,
  textAlign: "center",
}))

// Footer cell styling - similar to header cells but for summary row
export const StyledTableCellFooter = styled.td<{
  borderMode: Arrow.BorderMode
}>(({ theme, borderMode }) => ({
  padding: `${theme.spacing.twoXS} ${theme.spacing.xs}`,
  verticalAlign: "bottom",
  textAlign: "right",
  // Footer row should have top border when table has horizontal or all borders
  borderTop:
    borderMode !== Arrow.BorderMode.NONE
      ? `${theme.sizes.borderWidth} solid ${theme.colors.dataframeBorderColor}`
      : "none",
  // Remove bottom border for footer cells
  borderBottom: "none",
  // Right border for ALL mode
  borderRight:
    borderMode === Arrow.BorderMode.ALL
      ? `${theme.sizes.borderWidth} solid ${theme.colors.dataframeBorderColor}`
      : "none",
  "&:last-child": {
    borderRight: borderMode === Arrow.BorderMode.ALL ? "none" : undefined,
    paddingRight:
      borderMode === Arrow.BorderMode.NONE ? "0" : theme.spacing.xs,
  },
  // Remove left padding from first cell when no borders
  "&:first-of-type": {
    paddingLeft: borderMode === Arrow.BorderMode.NONE ? "0" : theme.spacing.sm,
  },
  // Increase the space between columns when there are no vertical borders
  "&:not(:first-of-type)": {
    paddingLeft:
      borderMode === Arrow.BorderMode.NONE ||
      borderMode === Arrow.BorderMode.HORIZONTAL
        ? theme.spacing.lg
        : theme.spacing.sm,
  },
}))

// Container for summary value and truncation icon
export const StyledSummaryContent = styled.span(({ theme }) => ({
  display: "inline-flex",
  alignItems: "baseline",
  gap: theme.spacing.twoXS,
}))

// Summary label styling (e.g., "Avg", "Sum")
export const StyledSummaryLabel = styled.span(({ theme }) => ({
  fontSize: theme.fontSizes.sm,
  color: theme.colors.fadedText40,
}))

// Summary value styling
export const StyledSummaryValue = styled.span(({ theme }) => ({
  fontSize: theme.fontSizes.md,
  color: theme.colors.fadedText60,
}))

// Container for stacked items that maintains width of the widest
export const StyledStackedContainer = styled.span({
  display: "inline-grid",
  justifyItems: "end", // Right-align all items within the grid
  "& > *": {
    gridArea: "1 / 1", // Stack all children in the same grid cell
  },
})

// Hidden item used to maintain width but not visible
export const StyledHiddenItem = styled.span({
  visibility: "hidden",
})

// Truncation info icon styling
export const StyledTruncationIcon = styled.span(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  alignSelf: "center",
  justifyContent: "center",
  color: theme.colors.fadedText40,
  fontSize: theme.fontSizes.sm,
  cursor: "help",
  "& svg": {
    width: theme.fontSizes.sm,
    height: theme.fontSizes.sm,
  },
}))

// Summary dropdown button container
export const StyledSummaryDropdownContainer = styled.div({
  position: "relative",
  display: "inline-flex",
})

// Summary dropdown button styling
export const StyledSummaryDropdownButton = styled.button(({ theme }) => ({
  display: "inline-flex",
  alignItems: "baseline",
  gap: theme.spacing.twoXS,
  background: "none",
  border: "none",
  padding: 0,
  cursor: "pointer",
  fontFamily: "inherit",
  "&:hover": {
    opacity: 0.8,
  },
  "&:focus": {
    outline: "none",
  },
}))

// Dropdown arrow icon
export const StyledDropdownArrow = styled.span(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  alignSelf: "center",
  color: theme.colors.fadedText60,
  "& svg": {
    width: theme.fontSizes.md,
    height: theme.fontSizes.md,
  },
}))

// Summary dropdown menu styling (used with portal, positioned via inline styles)
export const StyledSummaryDropdownMenu = styled.div(({ theme }) => ({
  position: "fixed",
  backgroundColor: theme.colors.bgColor,
  border: `${theme.sizes.borderWidth} solid ${theme.colors.borderColor}`,
  borderRadius: theme.radii.default,
  zIndex: theme.zIndices.popup,
  minWidth: theme.sizes.minMenuWidth,
  overflow: "hidden",
}))

// Summary dropdown menu item styling
// Matches st.dataframe column menu item styling
export const StyledSummaryDropdownItem = styled.button<{
  isSelected?: boolean
  isFocused?: boolean
}>(({ theme, isSelected, isFocused }) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: theme.spacing.lg,
  width: "100%",
  padding: `${theme.spacing.twoXS} ${theme.spacing.sm}`,
  textAlign: "left",
  background: isSelected
    ? theme.colors.darkenedBgMix15
    : isFocused
      ? theme.colors.darkenedBgMix15
      : "none",
  border: "none",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: theme.fontSizes.sm,
  color: theme.colors.bodyText,
  fontWeight: theme.fontWeights.normal,
  whiteSpace: "nowrap",
  "&:hover": {
    backgroundColor: theme.colors.darkenedBgMix15,
  },
  "&:focus": {
    outline: "none",
    backgroundColor: theme.colors.darkenedBgMix15,
  },
}))

// Label part of dropdown item
export const StyledDropdownItemLabel = styled.span(({ theme }) => ({
  color: theme.colors.fadedText40,
}))

// Value part of dropdown item
export const StyledDropdownItemValue = styled.span(({ theme }) => ({
  color: theme.colors.fadedText60,
}))
