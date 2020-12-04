import styled from "@emotion/styled"

export interface StyledDeckGlChartProps {
  width: number
  height: number
}

export const StyledDeckGlChart = styled.div<StyledDeckGlChartProps>(
  ({ width, height }) => ({
    position: "relative",
    height,
    width,
  })
)
