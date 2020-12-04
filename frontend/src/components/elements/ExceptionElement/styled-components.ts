import styled from "@emotion/styled"

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
  marginTop: theme.spacing.sm,
  marginBottom: theme.spacing.sm,
}))

export const StyledStackTrace = styled.pre(({ theme }) => ({
  padding: theme.spacing.twoXS,
  whiteSpace: "pre-wrap",
  wordWrap: "break-word",
  color: "inherit",
  fontSize: theme.fontSizes.smDefault,
  backgroundColor: "#ffffff44",

  code: {
    color: "inherit",
  },
}))
