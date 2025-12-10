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

// Reuse table styling from ArrowTable to ensure consistency
export {
  StyledTable,
  StyledTableBorder,
  StyledTableCell,
  StyledTableCellHeader,
  StyledTableContainer,
} from "~lib/components/elements/ArrowTable/styled-components"

export const StyledPivotTableContainer = styled.div(({ theme }) => ({
  position: "relative",
  fontSize: theme.fontSizes.md,
  fontFamily: theme.genericFonts.bodyFont,
  lineHeight: theme.lineHeights.small,
  "&:hover": {
    "[data-testid='stElementToolbar']": {
      opacity: 1,
    },
  },
}))

export const StyledDialogContent = styled.div(({ theme }) => ({
  display: "flex",
  gap: theme.spacing.lg,
  minHeight: "400px",
  maxHeight: "600px",
}))

export const StyledLeftPanel = styled.div(({ theme }) => ({
  width: "30%",
  borderRight: `1px solid ${theme.colors.borderColorLight}`,
  padding: theme.spacing.md,
  overflowY: "auto",
}))

export const StyledRightPanel = styled.div(({ theme }) => ({
  width: "70%",
  padding: theme.spacing.md,
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing.md,
  overflowY: "auto",
}))

export const StyledPivotAreas = styled.div(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: theme.spacing.md,
}))

export const StyledDialogActions = styled.div(({ theme }) => ({
  display: "flex",
  justifyContent: "flex-end",
  gap: theme.spacing.sm,
  marginTop: theme.spacing.lg,
  paddingTop: theme.spacing.md,
  borderTop: `1px solid ${theme.colors.borderColorLight}`,
}))

export const StyledFieldList = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing.twoXS,
}))

export const StyledFieldItem = styled.div<{ isDragging?: boolean }>(
  ({ theme, isDragging }) => ({
    padding: theme.spacing.sm,
    backgroundColor: isDragging
      ? theme.colors.secondaryBg
      : theme.colors.bgColor,
    border: `1px solid ${theme.colors.borderColorLight}`,
    borderRadius: theme.radii.md,
    cursor: "pointer",
    userSelect: "none",
    transition: "all 0.2s ease",
    "&:hover": {
      backgroundColor: theme.colors.secondaryBg,
      borderColor: theme.colors.primary,
    },
  })
)

export const StyledDropZone = styled.div<{ isOver?: boolean }>(
  ({ theme, isOver }) => ({
    minHeight: "100px",
    padding: theme.spacing.md,
    border: `2px dashed ${isOver ? theme.colors.primary : theme.colors.borderColorLight}`,
    borderRadius: theme.radii.md,
    backgroundColor: isOver ? theme.colors.darkenedBgMix15 : "transparent",
    transition: "all 0.2s ease",
  })
)

export const StyledDropZoneLabel = styled.div(({ theme }) => ({
  fontWeight: theme.fontWeights.bold,
  marginBottom: theme.spacing.sm,
  color: theme.colors.bodyText,
  fontSize: theme.fontSizes.sm,
}))

export const StyledDropZoneContent = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing.twoXS,
}))

export const StyledDroppedField = styled.div(({ theme }) => ({
  padding: theme.spacing.sm,
  backgroundColor: theme.colors.secondaryBg,
  border: `1px solid ${theme.colors.borderColorLight}`,
  borderRadius: theme.radii.md,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
}))

export const StyledFieldName = styled.span(({ theme }) => ({
  fontSize: theme.fontSizes.sm,
  color: theme.colors.bodyText,
}))

export const StyledRemoveButton = styled.button(({ theme }) => ({
  background: "none",
  border: "none",
  color: theme.colors.bodyText,
  cursor: "pointer",
  padding: theme.spacing.twoXS,
  fontSize: theme.fontSizes.sm,
  "&:hover": {
    color: theme.colors.red80,
  },
}))

export const StyledFieldMenu = styled.div(({ theme }) => ({
  position: "absolute",
  top: theme.sizes.full,
  left: 0,
  right: 0,
  backgroundColor: theme.colors.bgColor,
  border: `1px solid ${theme.colors.borderColorLight}`,
  borderRadius: theme.radii.md,
  boxShadow: `0 ${theme.spacing.twoXS} ${theme.spacing.md} rgba(0, 0, 0, 0.1)`,
  zIndex: theme.zIndices.popup,
  marginTop: theme.spacing.twoXS,

  button: {
    display: "block",
    width: theme.sizes.full,
    padding: theme.spacing.sm,
    background: "none",
    border: "none",
    textAlign: "left",
    cursor: "pointer",
    fontSize: theme.fontSizes.sm,
    color: theme.colors.bodyText,

    "&:hover": {
      backgroundColor: theme.colors.secondaryBg,
    },

    "&:not(:last-child)": {
      borderBottom: `1px solid ${theme.colors.borderColorLight}`,
    },
  },
}))
