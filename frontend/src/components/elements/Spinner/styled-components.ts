import styled from "@emotion/styled"
import { StyledSpinnerNext } from "baseui/spinner"
import isPropValid from "@emotion/is-prop-valid"

export const ThemedStyledSpinner = styled(StyledSpinnerNext, {
  shouldForwardProp: isPropValid,
})(({ theme, $usingCustomTheme }) => {
  return {
    marginTop: theme.spacing.none,
    marginBottom: theme.spacing.none,
    marginRight: theme.spacing.none,
    marginLeft: theme.spacing.none,
    borderColor: theme.colors.fadedText10,
    borderTopColor: $usingCustomTheme
      ? theme.colors.primary
      : theme.colors.blue70,
    flexGrow: 0,
    flexShrink: 0,
  }
})

export const StyledSpinnerContainer = styled.div(({ theme }) => ({
  display: "flex",
  gap: theme.spacing.lg,
  alignItems: "center",
  width: "100%",
}))
