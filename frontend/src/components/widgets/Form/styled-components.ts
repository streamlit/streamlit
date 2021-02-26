import styled from "@emotion/styled"

export const StyledFormSubmitContent = styled.div(() => {
  return {
    display: "flex",
  }
})

export const StyledFormStatusText = styled.div(({ theme }) => {
  return {
    padding: `${theme.spacing.twoXS} ${theme.spacing.md}`,
    color: theme.colors.gray,
    fontSize: theme.fontSizes.smDefault,
  }
})
