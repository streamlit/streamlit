import styled from "@emotion/styled"

export const StyledTooltipIconWrapper = styled.div(({ theme }) => ({
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

  [`@media (max-width: ${theme.breakpoints.sm})`]: {
    maxWidth: `calc(100% - 2rem)`,
  },
  a: {
    color: theme.colors.blue50,
  },
  img: {
    maxWidth: "100%",
  },
}))
