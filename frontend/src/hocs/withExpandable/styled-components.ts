import styled from "@emotion/styled"

export const StyledExpandableContainer = styled.div(({ theme }) => ({
  ".streamlit-expanderHeader:hover svg": {
    fill: theme.colors.primary,
  },
  ".streamlit-expander.empty": {
    "div[aria-expanded='true'] + .streamlit-expanderContent": {
      color: theme.colors.darkGray,
      fontStyle: "italic",
      fontSize: theme.fontSizes.sm,
      textAlign: "center",
      paddingBottom: theme.spacing.lg,
      paddingTop: theme.spacing.lg,

      "&:before": {
        content: '"empty"',
      },
    },
  },
}))
