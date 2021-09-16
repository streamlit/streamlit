import styled from "@emotion/styled"

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
