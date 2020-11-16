import styled from "@emotion/styled"

export const StyledText = styled.div(({ theme }) => ({
  fontFamily: theme.fonts.mono,
  whiteSpace: "pre",
  fontSize: theme.fontSizes.smDefault,
  overflowX: "auto",
}))
