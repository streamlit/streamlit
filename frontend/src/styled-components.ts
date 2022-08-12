import styled from "@emotion/styled"

export const StyledApp = styled.div(({ theme }) => ({
  position: "absolute",
  background: theme.colors.bgColor,
  color: theme.colors.bodyText,
  top: theme.spacing.none,
  left: theme.spacing.none,
  right: theme.spacing.none,
  bottom: theme.spacing.none,
  overflow: "hidden",
  "@media print": {
    float: "none",
    height: theme.sizes.full,
    position: "static",
    overflow: "visible",
  },
}))

/**
 * The glide-data-grid requires one root level portal element for rendering the cell overlays:
 * https://github.com/glideapps/glide-data-grid/blob/main/packages/core/API.md#htmlcss-prerequisites
 * This is added to the body in ThemedApp.
 */
export const StyledDataFrameOverlay = styled.div(({ theme }) => ({
  position: "fixed",
  top: 0,
  left: 0,
  zIndex: theme.zIndices.tablePortal,
  lineHeight: "100%",
}))
