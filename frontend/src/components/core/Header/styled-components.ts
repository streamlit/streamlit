import styled from "@emotion/styled"

export interface StyledHeaderProps {
  isEmbedded: boolean
  isWideMode: boolean
  isStale?: boolean
}

export const StyledHeader = styled.header<StyledHeaderProps>(
  ({ isEmbedded, isWideMode, theme }) => ({
    position: "fixed",
    top: theme.spacing.none,
    left: theme.spacing.none,
    right: theme.spacing.none,
    height: theme.sizes.headerHeight,
    background: theme.colors.bgColor,
    outline: "none",
    zIndex: theme.zIndices.header,
    display: isEmbedded ? "none" : "block",
    "@media print": {
      display: "none",
    },
  })
)

export const StyledHeaderDecoration = styled.div(({ theme }) => ({
  position: "absolute",
  top: theme.spacing.none,
  right: theme.spacing.none,
  left: theme.spacing.none,
  height: "0.125rem",
  backgroundImage: `linear-gradient(90deg, ${theme.colors.red70}, #fffd80)`,
  zIndex: theme.zIndices.header,
}))

export const StyledHeaderToolbar = styled.div(({ theme }) => ({
  position: "absolute",
  top: theme.spacing.threeXS,
  right: theme.spacing.twoXS,
  height: theme.sizes.headerHeight,
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
}))
