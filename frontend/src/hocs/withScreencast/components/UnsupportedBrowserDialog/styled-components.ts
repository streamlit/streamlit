import styled from "@emotion/styled"

export const StyledScreenCastWarningDialog = styled.div(({ theme }) => ({
  display: "flex",
}))

export const StyledUnsupportedScreenCastIcon = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyItems: "center",
  marginRight: "26px",
  marginLeft: "10px",
  fontSize: "50px",
}))

export const StyledUnsupportedScreenCastExplanation = styled.p(
  ({ theme }) => ({
    margin: theme.spacing.none,
  })
)
