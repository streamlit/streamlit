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

export const StyledPivotTableContainer = styled.div(({ theme }) => ({
  position: "relative",
  fontSize: theme.fontSizes.sm, // Smaller font size like DataFrame
  fontFamily: theme.genericFonts.bodyFont,
  lineHeight: theme.lineHeights.small,
  "&:hover": {
    "[data-testid='stElementToolbar']": {
      opacity: 1,
    },
  },

  // Override ArrowTable styling for DataFrame-like appearance
  "thead th": {
    backgroundColor: `${theme.colors.dataframeHeaderBackgroundColor} !important`,
    fontSize: `${theme.fontSizes.sm} !important`,
    fontWeight: `${theme.fontWeights.normal} !important`,
    color: `${theme.colors.fadedText60} !important`,
  },

  "tbody td, tbody th": {
    fontSize: `${theme.fontSizes.sm} !important`,
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

export const StyledAggregationButton = styled.button(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing.twoXS,
  padding: `${theme.spacing.twoXS} ${theme.spacing.sm}`,
  backgroundColor: theme.colors.darkenedBgMix15,
  border: `1px solid ${theme.colors.borderColorLight}`,
  borderRadius: theme.radii.md,
  fontSize: theme.fontSizes.sm,
  color: theme.colors.bodyText,
  cursor: "pointer",
  transition: "all 0.2s ease",

  "&:hover": {
    backgroundColor: theme.colors.darkenedBgMix25,
    borderColor: theme.colors.primary,
  },

  "&:focus": {
    outline: "none",
    borderColor: theme.colors.primary,
  },
}))

export const StyledAggregationMenu = styled.div(({ theme }) => ({
  position: "absolute",
  top: theme.sizes.full,
  left: 0,
  minWidth: "120px",
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
