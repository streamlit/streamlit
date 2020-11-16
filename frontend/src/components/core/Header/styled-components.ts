import styled from "@emotion/styled"
import { transparentize } from "color2k"

export interface StyledHeaderProps {
  isEmbedded: boolean
  isWideMode: boolean
}

export const StyledHeader = styled.header<StyledHeaderProps>(
  ({ isEmbedded, isWideMode, theme }) => ({
    position: "fixed",
    top: theme.spacing.none,
    left: theme.spacing.none,
    right: theme.spacing.none,
    height: 0,
    zIndex: theme.zIndices.header,
    display: isEmbedded ? "none" : "block",
    "@media print": {
      display: "none",
    },
    ...(isWideMode
      ? {
          backgroundImage: `linear-gradient(180deg, ${
            theme.colors.white
          } 25%, ${transparentize(theme.colors.white, 0.5)} 75%, ${
            theme.colors.transparent
          })`,
          [`@media (max-width: ${theme.breakpoints.md})`]: {
            position: "absolute",
            background: "unset",
          },
        }
      : {}),
  })
)

export const StyledHeaderDecoration = styled.div(({ theme }) => ({
  position: "absolute",
  top: theme.spacing.none,
  right: theme.spacing.none,
  left: theme.spacing.none,
  height: "0.125rem",
  backgroundImage: `linear-gradient(90deg, ${theme.colors.primary}, #fffd80)`,
  zIndex: theme.zIndices.header,
}))

export const StyledHeaderToolbar = styled.div(({ theme }) => ({
  position: "absolute",
  top: theme.spacing.none,
  right: theme.spacing.lg,
  height: theme.sizes.headerHeight,
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
}))
