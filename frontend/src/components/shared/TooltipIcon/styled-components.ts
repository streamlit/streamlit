import styled from "@emotion/styled"

export const StyledTooltipIconWrapper = styled.div(({ theme }) => ({
  svg: {
    stroke: theme.colors.gray60,
  },
  ":hover": {
    svg: {
      stroke: theme.colors.gray70,
    },
  },
}))

export const StyledTooltipContentWrapper = styled.div(({ theme }) => ({
  boxSizing: "border-box",
  fontSize: `${theme.fontSizes.sm} !important`,
  maxWidth: `calc(${theme.sizes.contentMaxWidth} - 4rem)`,

  [`@media (max-width: ${theme.breakpoints.sm})`]: {
    maxWidth: `calc(100% - 2rem)`,
  },
}))
