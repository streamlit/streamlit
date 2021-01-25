import styled from "@emotion/styled"

export const StyledApp = styled.div(({ theme }) => ({
  position: "absolute",
  background: theme.colors.bgColor,
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
  "h1, h2, h3": {
    color: theme.colors.accent,
  },
}))
