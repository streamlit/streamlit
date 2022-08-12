import styled from "@emotion/styled"

export const StyledPagination = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  paddingBottom: theme.spacing.twoXS,
  marginBottom: theme.spacing.twoXS,
}))

export const StyledPaginators = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: theme.colors.fadedText40,
}))
