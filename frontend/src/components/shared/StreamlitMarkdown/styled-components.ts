import styled from "@emotion/styled"
import { transparentize } from "color2k"

export const StyledStreamlitMarkdown = styled.div(({ theme }) => ({
  fontFamily: theme.fonts.sansSerif,
  marginBottom: `-${theme.spacing.lg}`,
  a: {
    color: theme.colors.blue,
  },

  ul: {
    paddingLeft: theme.spacing.lg,
  },

  "pre, code": {
    // Default color for syntax hilighting.
    backgroundColor: transparentize(theme.colors.white, 0.5),
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
