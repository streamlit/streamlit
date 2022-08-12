import styled from "@emotion/styled"

export const StyledPreError = styled.pre(({ theme }) => ({
  padding: theme.spacing.twoXS,
  whiteSpace: "pre-wrap",
  wordWrap: "break-word",
  color: "inherit",
  fontSize: theme.fontSizes.sm,
}))
