import styled from "@emotion/styled"
import { transparentize } from "color2k"

export const StyledTooltipIconWrapper = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",

  svg: {
    stroke: theme.colors.fadedText40,
    strokeWidth: 2.25,
  },
  ":hover": {
    svg: {
      stroke: theme.colors.fadedText60,
    },
  },
}))

export const StyledTooltipContentWrapper = styled.div(({ theme }) => ({
  boxSizing: "border-box",
  fontSize: `${theme.fontSizes.sm} !important`,
  maxWidth: `calc(${theme.sizes.contentMaxWidth} - 4rem)`,
  maxHeight: "300px",
  overflow: "auto",
  padding: `${theme.spacing.xs} ${theme.spacing.md}`,

  [`@media (max-width: ${theme.breakpoints.sm})`]: {
    maxWidth: `calc(100% - 2rem)`,
  },
  img: {
    maxWidth: "100%",
  },
  code: {
    background: transparentize(theme.colors.darkenedBgMix60, 0.8),
  },
}))
