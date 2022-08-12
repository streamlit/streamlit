import styled from "@emotion/styled"

export const StyledImageList = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  flexWrap: "wrap",
  // Not supported in Safari, but at least it's not a regression for those users:
  rowGap: theme.spacing.lg,
}))

export const StyledImageContainer = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  width: "auto",
  flexGrow: 0,
}))

export const StyledCaption = styled.div(({ theme }) => ({
  fontFamily: theme.genericFonts.bodyFont,
  fontSize: theme.fontSizes.sm,
  color: theme.colors.fadedText60,
  textAlign: "center",
  marginTop: theme.spacing.xs,
  wordWrap: "break-word",
  padding: "0.125rem",
}))
