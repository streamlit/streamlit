import styled from "@emotion/styled"

export const StyledAlertContent = styled.div(({ theme }) => ({
  display: "flex",
  gap: theme.spacing.sm,

  // If an icon is present, nudge the <EmojiIcon /> component
  // a bit so it's aligned with the start of the text.
  "& > span": {
    position: "relative",
    top: "2px",
  },

  pre: {
    backgroundColor: theme.colors.transparent,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    paddingRight: theme.spacing.lg,
    paddingLeft: theme.spacing.lg,
    border: `1px solid ${theme.colors.fadedText10}`,

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
