import styled from "@emotion/styled"
import { keyframes } from "@emotion/react"

const blink = keyframes`
  50% {
    color: rgba(0, 0, 0, 0);
  }
`

export interface StyledMessageProps {
  includeDot: boolean
  shouldBlink: boolean
}

export const StyledMessage = styled.span<StyledMessageProps>(
  ({ includeDot, shouldBlink, theme }) => ({
    ...(includeDot
      ? {
          "&::before": {
            opacity: 1,
            content: '"•"',
            animation: "none",
            color: theme.colors.gray,
            margin: "0 5px",
          },
        }
      : {}),
    ...(shouldBlink
      ? {
          color: theme.colors.red,
          animationName: `${blink}`,
          animationDuration: "0.5s",
          animationIterationCount: 5,
        }
      : {}),
  })
)
