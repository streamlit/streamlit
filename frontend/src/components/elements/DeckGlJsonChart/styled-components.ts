import styled from "@emotion/styled"

export interface StyledDeckGlChartProps {
  width: number
  height: number
}

export const StyledDeckGlChart = styled.div<StyledDeckGlChartProps>(
  ({ width, height, theme }) => ({
    marginTop: theme.spacing.sm,
    position: "relative",
    height,
    width,
  })
)

export const StyledNavigationControlContainer = styled.div(({ theme }) => ({
  position: "absolute",
  right: "2.625rem",
  top: theme.spacing.md,
  zIndex: 1,
}))
