import styled from "@emotion/styled"

export const StyledUploadFirstLine = styled.div(({ theme }) => ({
  marginBottom: theme.spacing.sm,
}))

export const StyledRerunHeader = styled.div(({ theme }) => ({
  marginBottom: theme.spacing.sm,
}))

export const StyledCommandLine = styled.textarea(({ theme }) => ({
  width: theme.sizes.full,
  fontFamily: theme.fonts.mono,
  fontSize: theme.fontSizes.smDefault,
  height: "6rem",
}))

export const StyledUploadUrl = styled.pre(({ theme }) => ({
  fontFamily: theme.fonts.mono,
  fontSize: theme.fontSizes.smDefault,
  whiteSpace: "normal",
  wordWrap: "break-word",
}))

export const StyledShortcutLabel = styled.span(({ theme }) => ({
  "&::first-letter": {
    textDecoration: "underline",
  },
}))

export const StyledDeployErrorContent = styled.div(({ theme }) => ({
  "& > ul": {
    paddingLeft: "1.4rem",
  },
}))
