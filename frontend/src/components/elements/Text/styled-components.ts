import styled from "@emotion/styled"

export const StyledText = styled.div(({ theme }) => ({
  fontFamily: theme.fonts.monospace,
  whiteSpace: "pre",
  fontSize: theme.fontSizes.sm,
  overflowX: "auto",
}))
