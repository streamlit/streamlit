import styled from "@emotion/styled"

export const StyledExceptionContainer = styled.div(({ theme }) => ({
  display: "grid",
}))

export const StyledStackTraceRow = styled.div(({ theme }) => ({
  marginTop: theme.spacing.sm,
  "&:first-of-type": {
    marginTop: 0,
  },
}))

export const StyledMessageType = styled.span(({ theme }) => ({
  fontWeight: theme.fontWeights.bold,
}))

export const StyledStackTraceTitle = styled.div(({ theme }) => ({
  // Need to add xl to top margin because markdown has negative xl margin bottom.
  marginTop: `calc(${theme.spacing.sm} + ${theme.spacing.xl})`,
  marginBottom: theme.spacing.sm,
}))

export const StyledStackTrace = styled.pre(({ theme }) => ({
  whiteSpace: "pre-wrap",
  wordWrap: "break-word",
  color: "inherit",
  fontSize: theme.fontSizes.sm,
  backgroundColor: theme.colors.transparent,

  code: {
    color: "inherit",
  },
}))
