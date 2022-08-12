import styled from "@emotion/styled"

export const StyledFormSubmitContent = styled.div(() => ({
  display: "flex",
}))

export const StyledForm = styled.div(({ theme }) => ({
  border: `1px solid ${theme.colors.fadedText10}`,
  borderRadius: theme.radii.md,
  padding: "calc(1em - 1px)", // 1px to account for border.
}))

export const StyledErrorContainer = styled.div(({ theme }) => ({
  marginTop: theme.spacing.lg,
}))
