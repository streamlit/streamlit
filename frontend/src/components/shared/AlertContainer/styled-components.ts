import styled from "@emotion/styled"

export const StyledAlertContent = styled.div(({ theme }) => ({
  pre: {
    // Default color for syntax highlighting.
    backgroundColor: "#ffffff44",

    "pre, code": {
      backgroundColor: theme.colors.transparent,
      color: "inherit",
    },
  },

  code: {
    backgroundColor: theme.colors.transparent,
    padding: theme.spacing.none,
  },

  "pre, code": {
    color: "inherit",
  },

  a: {
    color: "inherit",
    textDecoration: "underline",
  },
}))
