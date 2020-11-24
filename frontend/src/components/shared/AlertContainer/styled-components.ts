import styled from "@emotion/styled"

export const StyledAlertContent = styled.div(({ theme }) => ({
  code: {
    // Default color for syntax highlighting.
    backgroundColor: theme.colors.transparent,
    color: "inherit",
  },
}))
