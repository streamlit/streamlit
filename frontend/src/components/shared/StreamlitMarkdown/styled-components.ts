import styled from "@emotion/styled"

export const StyledStreamlitMarkdown = styled.div(({ theme }) => ({
  fontFamily: theme.fonts.sansSerif,
  marginBottom: `-${theme.spacing.lg}`,
  a: {
    color: theme.colors.blue,
  },

  ul: {
    paddingLeft: theme.spacing.lg,
  },

  code: {
    // Default color for syntax highlighting.
    backgroundColor: theme.colors.transparent,
    color: "inherit",
  },

  "pre code": {
    // Default color for syntax highlighting.
    backgroundColor: "#ffffff44",
    color: "inherit",
  },

  tr: {
    borderTop: `1px solid ${theme.colors.lightGray}`,
    background: theme.colors.white,
  },

  "th, td": {
    padding: "6px 13px",
    border: `1px solid ${theme.colors.lightGray}`,
  },
}))
