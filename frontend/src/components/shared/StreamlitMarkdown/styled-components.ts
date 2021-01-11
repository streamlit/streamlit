import styled from "@emotion/styled"

export const StyledStreamlitMarkdown = styled.div(({ theme }) => ({
  fontFamily: theme.fonts.sansSerif,
  marginBottom: `-${theme.spacing.lg}`,
  a: {
    color: theme.colors.blue,
  },

  "ul, ol": {
    paddingLeft: theme.spacing.lg,
  },

  li: {
    margin: "0.2em 0 0.2em 1.2em",
    padding: "0 0 0 0.6em",
    fontSize: theme.fontSizes.md,
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

export const StyledLinkIconContainer = styled.div(({ theme }) => ({
  position: "relative",
  left: "-30px",
  paddingLeft: "30px",
  a: {
    display: "none",
  },
  ":hover": {
    a: {
      display: "inline-block",
    },
  },
}))

export const StyledLinkIcon = styled.a(({ theme }) => ({
  position: "absolute",
  top: "-2px",
  left: 0,
}))
