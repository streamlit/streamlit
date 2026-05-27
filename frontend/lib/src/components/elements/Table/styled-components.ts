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

import styled, { CSSObject } from "@emotion/styled"

import { Table } from "@streamlit/protobuf"

import { StyledStreamlitMarkdown } from "~lib/components/shared/StreamlitMarkdown/styled-components"
import type { EmotionTheme } from "~lib/theme/types"

export const StyledTableContainer = styled.div(({ theme }) => ({
  fontSize: theme.fontSizes.md,
  fontFamily: theme.genericFonts.bodyFont,
  lineHeight: theme.lineHeights.small,
  captionSide: "bottom",
  // Ensure height constraints from parent are inherited
  height: "100%",
  // Constrain width to parent to prevent overflow from pushing parent containers wider
  width: "100%",
  maxWidth: "100%",
  // Use clip to strictly contain overflow and prevent affecting parent scrollWidth
  overflow: "clip",
  // Use block display to let table expand naturally
  display: "block",
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

export const StyledTableBorder = styled.div<{
  borderMode: Table.BorderMode
  hasScrollableHeight?: boolean
}>(({ theme, borderMode, hasScrollableHeight }) => ({
  // Add the enclosing border on an extra wrapper around the table. This ensures that
  // when the table scrolls horizontally on small windows, it still shows a border all
  // around the table and the table doesn't look cut off.
  border:
    borderMode === Table.BorderMode.ALL
      ? `${theme.sizes.borderWidth} solid ${theme.colors.dataframeBorderColor}`
      : "none",
  borderRadius: theme.radii.default,
  overflow: "auto",
  // Constrain width to parent to prevent overflow from pushing parent containers wider.
  // This ensures horizontal scroll is contained within this wrapper.
  width: "100%",
  maxWidth: "100%",
  // When a fixed height is specified, constrain to 100% of parent
  height: hasScrollableHeight ? "100%" : undefined,
  // Create positioning context for absolutely positioned children (e.g., Pandas Styler tooltips)
  // This ensures such elements are contained within this wrapper for scroll calculations
  position: "relative",
  // Use block display with hidden vertical overflow to eliminate inline-table baseline gap
  display: "block",
  // This prevents accidental overscrolling that triggers the browser's Back button.
  overscrollBehaviorX: "contain",
}))

export const StyledTable = styled.table<{
  useContentWidth?: boolean
  hasScrollableWidth?: boolean
}>(({ theme, useContentWidth, hasScrollableWidth }) => ({
  color: theme.colors.bodyText,
  borderSpacing: 0,
  // Inline-table helps preserve content-based column sizing, so narrow
  // containers scroll horizontally instead of forcing early wraps.
  display: "inline-table",
  // Align to top to eliminate the gap at the bottom caused by inline baseline alignment
  verticalAlign: "top",
  // Fill container width when content is smaller, unless:
  // - useContentWidth is true (width="content")
  // - hasScrollableWidth is true (fixed pixel width with horizontal scroll)
  // In both cases, table should size to content and scroll if needed.
  minWidth: useContentWidth || hasScrollableWidth ? undefined : "100%",
}))

const styleCellFunction = (
  theme: EmotionTheme,
  border: Table.BorderMode = Table.BorderMode.ALL,
  truncateContent: boolean = false
): CSSObject => ({
  // Only have borders on the bottom and right of each cell.
  borderBottom:
    border !== Table.BorderMode.NONE
      ? `${theme.sizes.borderWidth} solid ${theme.colors.dataframeBorderColor}`
      : "none",
  "tbody tr:last-child &": {
    // For "all" borders, remove bottom border of last row to prevent double border with
    // table border. For "horizontal" borders, also remove bottom border of last row
    // since there's no content after it.
    borderBottom:
      border === Table.BorderMode.ALL || border === Table.BorderMode.HORIZONTAL
        ? "none"
        : undefined,
  },
  borderRight:
    border === Table.BorderMode.ALL
      ? `${theme.sizes.borderWidth} solid ${theme.colors.dataframeBorderColor}`
      : "none",
  "&:last-child": {
    borderRight: border === Table.BorderMode.ALL ? "none" : undefined,
    // Remove right padding from last cell when no borders, so that the table aligns
    // with the rest of the page.
    paddingRight: border === Table.BorderMode.NONE ? "0" : theme.spacing.xs,
  },
  verticalAlign: "middle",
  padding: `${theme.spacing.twoXS} ${theme.spacing.xs}`,
  // Increase the space between columns when there are no vertical borders.
  "&:not(:first-of-type)": {
    paddingLeft:
      border === Table.BorderMode.NONE ||
      border === Table.BorderMode.HORIZONTAL
        ? theme.spacing.lg
        : theme.spacing.xs,
  },
  // Remove left padding from first column when no borders, so that the table aligns
  // with the rest of the page.
  "&:first-of-type": {
    paddingLeft: border === Table.BorderMode.NONE ? "0" : theme.spacing.xs,
  },
  fontWeight: theme.fontWeights.normal,
  ...(truncateContent
    ? {
        // Apply truncation only for fixed-width tables to avoid clipping
        // content in normal and content-based layouts.
        whiteSpace: "nowrap",
        maxWidth: theme.sizes.tableColumnMaxWidth,
        overflow: "hidden",
        textOverflow: "ellipsis",
      }
    : {
        // Keep columns sized to their content width by default.
        // The inner markdown wrapper controls wrapping once it reaches
        // the max column width.
        whiteSpace: "nowrap",

        // StreamlitMarkdown defaults to width: 100% and aggressive word
        // breaking. Override this in table cells so columns size by content,
        // and wrapping only happens at the max column width.
        [`${StyledStreamlitMarkdown}`]: {
          display: "inline-block",
          width: "fit-content",
          maxWidth: theme.sizes.tableColumnMaxWidth,
          whiteSpace: "normal",
          overflowWrap: "normal",
          wordBreak: "normal",
          overflowY: "hidden",
          // Align to top to prevent baseline shift from overflowY:hidden adding extra cell height
          verticalAlign: "top",
          // Reset margin to prevent the negative margin hack from affecting layout
          margin: 0,
        },
        // When markdown container has a code block (pre), it should fill
        // the cell width so the code block background extends properly.
        [`${StyledStreamlitMarkdown}:has(pre)`]: {
          display: "block",
          width: "100%",
          maxWidth: "none",
        },
        [`${StyledStreamlitMarkdown} p`]: {
          whiteSpace: "normal",
          overflowWrap: "normal",
          wordBreak: "normal",
          // Reset paragraph margin to prevent extra space at bottom of cells
          margin: 0,
        },
      }),
})

export const StyledTableCell = styled.td<{
  borderMode: Table.BorderMode
  truncateContent?: boolean
}>(({ theme, borderMode, truncateContent }) =>
  styleCellFunction(theme, borderMode, truncateContent)
)

// Type for sticky positioning: "header" for top sticky, "index" for left sticky,
// "corner" for both top+left sticky (intersection of header and index)
export type StickyType = "header" | "index" | "corner" | undefined

// z-index values for sticky cells. Corner cells need highest z-index to stay
// above both header and index cells during diagonal scrolling.
const STICKY_Z_INDEX: Record<NonNullable<StickyType>, number> = {
  corner: 3,
  header: 2,
  index: 1,
}

export const StyledTableCellHeader = styled.th<{
  borderMode: Table.BorderMode
  stickyType?: StickyType
  stickyTopOffset?: number
  stickyLeftOffset?: number
  truncateContent?: boolean
}>(
  ({
    theme,
    borderMode,
    stickyType,
    stickyTopOffset,
    stickyLeftOffset,
    truncateContent,
  }) => {
    // Base styles from styleCellFunction
    const baseStyles = {
      ...styleCellFunction(theme, borderMode, truncateContent),
      textAlign: "inherit" as const,
      color: theme.colors.fadedText60,
      // Remove left padding from first cell when no borders, so that the table aligns
      // with the rest of the page.
      "&:first-of-type": {
        paddingLeft:
          borderMode === Table.BorderMode.NONE ? "0" : theme.spacing.sm,
      },
      // Increase the space between columns when there are no vertical borders.
      "&:not(:first-of-type)": {
        paddingLeft:
          borderMode === Table.BorderMode.NONE ||
          borderMode === Table.BorderMode.HORIZONTAL
            ? theme.spacing.lg
            : theme.spacing.sm,
      },
    }

    // Add sticky positioning if specified
    if (stickyType) {
      const stickyStyles: Record<string, unknown> = {
        position: "sticky",
        backgroundColor: theme.colors.bgColor,
      }

      // Header cells stick to top
      if (stickyType === "header" || stickyType === "corner") {
        stickyStyles.top = stickyTopOffset ?? 0
      }

      // Index cells stick to left
      if (stickyType === "index" || stickyType === "corner") {
        stickyStyles.left = stickyLeftOffset ?? 0
      }

      // Set z-index based on sticky type
      stickyStyles.zIndex = STICKY_Z_INDEX[stickyType]

      return {
        ...baseStyles,
        ...stickyStyles,
      }
    }

    return baseStyles
  }
)

export const StyledEmptyTableCell = styled(StyledTableCell)<{
  borderMode: Table.BorderMode
}>(({ theme }) => ({
  color: theme.colors.gray70,
  fontStyle: "italic",
  fontSize: theme.fontSizes.md,
  textAlign: "center",
}))
