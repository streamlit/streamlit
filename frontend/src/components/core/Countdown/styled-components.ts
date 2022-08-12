import styled from "@emotion/styled"
import { keyframes } from "@emotion/react"

const screencastCounterAnimation = keyframes`
0% {
  opacity: 0;
}
25% {
  opacity: 1;
}
100% {
  opacity: 0;
}`

export const StyledCountdown = styled.div(({ theme }) => ({
  position: "fixed",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  top: 0,
  left: 0,
  width: theme.sizes.full,
  height: theme.sizes.full,
  fontSize: "40vh",
  color: theme.colors.red,
  fontWeight: theme.fontWeights.bold,
  opacity: "0.8",
  textShadow: `1px 1px 10px ${theme.colors.darkGray}`,
  transition: "opacity 0.3s ease-in-out",
  fontFamily: 'Helvetica, Calibri, Roboto, "Open Sans", Arial, sans-serif',
  animation: `${screencastCounterAnimation} 1s`,
}))
