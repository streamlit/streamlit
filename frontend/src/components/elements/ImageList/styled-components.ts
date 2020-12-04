import styled from "@emotion/styled"

export const StyledImageContainer = styled.div(({ theme }) => ({
  display: "inline-flex",
  flexDirection: "column",
  marginRight: theme.fontSizes.smDefault,
}))

export const StyledCaption = styled.div(({ theme }) => ({
  fontFamily: theme.fonts.mono,
  fontSize: theme.fontSizes.smDefault,
  textAlign: "center",
}))
