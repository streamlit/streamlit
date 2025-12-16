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
  display: "flex",
  flexDirection: "column",
  fontSize: theme.fontSizes.sm,
  fontFamily: theme.genericFonts.bodyFont,
  lineHeight: theme.lineHeights.small,
  width: theme.sizes.full,
  "&:hover": {
    "[data-testid='stElementToolbar']": {
      opacity: 1,
    },
  },
}))

export const StyledPivotContent = styled.div<{ $sidebarVisible: boolean }>(
  ({ theme, $sidebarVisible }) => ({
    display: "flex",
    flexDirection: "row",
    width: theme.sizes.full,
    gap: $sidebarVisible ? theme.spacing.none : theme.spacing.none,
    transition: "all 0.2s ease-in-out",
  })
)

export const StyledTableArea = styled.div(({ theme }) => ({
  paddingTop: theme.spacing.sm,
  paddingLeft: theme.spacing.sm,
  flex: 1,
  minWidth: 0,
  // Override ArrowTable styling for DataFrame-like appearance
  "thead th": {
    backgroundColor: `${theme.colors.darkenedBgMix15}`,
    fontSize: `${theme.fontSizes.sm}`,
    fontWeight: `${theme.fontWeights.normal}`,
    color: `${theme.colors.fadedText60}`,
  },

  "tbody td, tbody th": {
    fontSize: `${theme.fontSizes.sm}`,
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
  right: 0,
  minWidth: "160px",
  backgroundColor: theme.colors.bgColor,
  border: `1px solid ${theme.colors.borderColorLight}`,
  borderRadius: theme.radii.md,
  boxShadow: `0 ${theme.spacing.twoXS} ${theme.spacing.md} rgba(0, 0, 0, 0.1)`,
  zIndex: theme.zIndices.popup,
  marginTop: theme.spacing.twoXS,

  button: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing.md,
    width: theme.sizes.full,
    padding: theme.spacing.sm,
    backgroundColor: "transparent",
    border: "none",
    textAlign: "left",
    cursor: "pointer",
    fontSize: theme.fontSizes.sm,
    color: theme.colors.bodyText,
    transition: "background-color 0.2s ease",

    "&:hover": {
      backgroundColor: `${theme.colors.darkenedBgMix15} !important`,
    },

    "&.selected": {
      backgroundColor: theme.colors.secondaryBg,
      fontWeight: theme.fontWeights.bold,
    },

    "&:not(:last-child)": {
      borderBottom: `1px solid ${theme.colors.borderColorLight}`,
    },
  },
}))

// Sidebar components for split-panel layout (left side)
export const StyledSidebar = styled.div<{ $isVisible: boolean }>(
  ({ theme, $isVisible }) => ({
    marginTop: theme.spacing.sm,
    borderTopRightRadius: theme.radii.md,
    borderTopLeftRadius: theme.radii.md,
    width: $isVisible ? "240px" : "0px",
    minWidth: $isVisible ? "240px" : "0px",
    maxWidth: $isVisible ? "240px" : "0px",
    display: "flex",
    flexDirection: "column",
    borderRight: $isVisible
      ? `1px solid ${theme.colors.borderColorLight}`
      : "none",
    backgroundColor: theme.colors.bgColor,
    overflow: "hidden",
    transition:
      "width 0.15s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.15s cubic-bezier(0.4, 0, 0.2, 1), max-width 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
  })
)

export const StyledSidebarHeader = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: theme.spacing.md,
  borderBottom: `1px solid ${theme.colors.borderColorLight}`,
  backgroundColor: theme.colors.secondaryBg,
}))

export const StyledSidebarTitle = styled.div(({ theme }) => ({
  fontSize: theme.fontSizes.md,
  fontWeight: theme.fontWeights.bold,
  color: theme.colors.bodyText,
}))

export const StyledToggleButton = styled.button(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: theme.spacing.twoXS,
  color: theme.colors.bodyText,
  borderRadius: theme.radii.md,
  "&:hover": {
    backgroundColor: theme.colors.darkenedBgMix15,
  },
}))

export const StyledSidebarContent = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing.sm,
  padding: theme.spacing.md,
  overflow: "auto",
  height: theme.sizes.full,
}))

export const StyledTotalsSection = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing.xs,
  paddingTop: theme.spacing.md,
  borderTop: `1px solid ${theme.colors.borderColorLight}`,
}))

export const StyledCheckboxLabel = styled.label(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing.sm,
  cursor: "pointer",
  fontSize: theme.fontSizes.sm,
  color: theme.colors.bodyText,
  userSelect: "none",

  input: {
    cursor: "pointer",
  },
}))

export const StyledToggleStrip = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "flex-start",
  paddingTop: theme.spacing.sm,
  paddingLeft: theme.spacing.sm,
}))

export const StyledToggleStripButton = styled.button(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "32px",
  height: "32px",
  backgroundColor: theme.colors.secondaryBg,
  border: `1px solid ${theme.colors.borderColorLight}`,
  borderRadius: theme.radii.md,
  cursor: "pointer",
  color: theme.colors.bodyText,
  transition: "all 0.2s ease",
  "&:hover": {
    backgroundColor: theme.colors.darkenedBgMix15,
    borderColor: theme.colors.fadedText60,
  },
}))

export const StyledCollapseButton = styled.button(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "24px",
  height: "100%",
  background: theme.colors.secondaryBg,
  border: "none",
  borderLeft: `1px solid ${theme.colors.borderColorLight}`,
  cursor: "pointer",
  color: theme.colors.bodyText,
  transition: "background-color 0.2s ease",
  "&:hover": {
    backgroundColor: theme.colors.darkenedBgMix15,
  },
}))

export const StyledFieldsHeader = styled.div(({ theme }) => ({
  fontSize: theme.fontSizes.sm,
  fontWeight: theme.fontWeights.bold,
  color: theme.colors.fadedText60,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: theme.spacing.sm,
}))

export const StyledActiveFields = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing.twoXS,
  paddingBottom: theme.spacing.md,
  borderBottom: `1px solid ${theme.colors.borderColorLight}`,
}))

export const StyledAvailableFields = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing.twoXS,
}))

export const StyledFieldItemWithIcon = styled.div<{ $isDragging?: boolean }>(
  ({ theme, $isDragging }) => ({
    display: "flex",
    alignItems: "center",
    gap: theme.spacing.sm,
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.bgColor,
    border: `1px solid ${theme.colors.borderColorLight}`,
    borderRadius: theme.radii.md,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.bodyText,
    cursor: $isDragging ? "grabbing" : "grab",
    opacity: $isDragging ? 0.5 : 1,
    userSelect: "none",
    "&:hover": {
      backgroundColor: theme.colors.secondaryBg,
      borderColor: theme.colors.fadedText60,
    },
  })
)

// Top configuration bar (horizontal layout)
export const StyledConfigBar = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  gap: theme.spacing.md,
  padding: theme.spacing.md,
  borderBottom: `1px solid ${theme.colors.borderColorLight}`,
  backgroundColor: theme.colors.darkenedBgMix25,
  alignItems: "stretch",
  borderRadius: theme.radii.md,
  position: "relative",
}))

export const StyledConfigRow = styled.div<{ $isOver?: boolean }>(
  ({ theme, $isOver }) => ({
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing.sm,
    minHeight: "60px",
    minWidth: "200px",
    flex: 1,
    padding: theme.spacing.sm,
    borderRadius: theme.radii.md,
    backgroundColor: $isOver
      ? theme.colors.darkenedBgMix15
      : theme.colors.secondaryBg,
    border: `2px dashed ${$isOver ? theme.colors.fadedText60 : theme.colors.borderColorLight}`,
    transition: "all 0.2s ease",
  })
)

export const StyledConfigLabel = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing.twoXS,
  fontSize: theme.fontSizes.sm,
  fontWeight: theme.fontWeights.bold,
  color: theme.colors.bodyText,
  marginBottom: theme.spacing.twoXS,
}))

export const StyledConfigFields = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "flex-start",
  gap: theme.spacing.twoXS,
  flexWrap: "wrap",
  minHeight: "32px",
}))

export const StyledConfigChip = styled.div<{ $zoneColor?: string }>(
  ({ theme, $zoneColor }) => ({
    display: "flex",
    alignItems: "center",
    gap: theme.spacing.twoXS,
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    backgroundColor: $zoneColor || theme.colors.primary,
    border: "none",
    borderRadius: theme.radii.md,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.white,
    cursor: "move",
    userSelect: "none",
    fontWeight: theme.fontWeights.normal,
  })
)

export const StyledChipRemoveButton = styled.button(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  background: "none",
  border: "none",
  color: theme.colors.white,
  cursor: "pointer",
  padding: 0,
  marginLeft: theme.spacing.sm,
  opacity: 0.9,
  "&:hover": {
    opacity: 1,
    transform: "scale(1.1)",
  },
}))

export const StyledConfigPlaceholder = styled.div(({ theme }) => ({
  fontSize: theme.fontSizes.sm,
  color: theme.colors.fadedText40,
  fontStyle: "italic",
}))

export const StyledAggregationChip = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing.twoXS,
  position: "relative",
}))
