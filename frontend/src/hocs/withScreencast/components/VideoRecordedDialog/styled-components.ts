import styled from "@emotion/styled"

export const StyledVideo = styled.video(({ theme }) => ({
  width: theme.sizes.full,
  borderRadius: theme.radii.md,
}))

export const StyledDialogContainer = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  width: theme.sizes.full,
}))

export const StyledRow = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  paddingTop: theme.spacing.md,
  paddingBottom: theme.spacing.md,
}))

export const StyledFirstColumn = styled.div(({ theme }) => ({
  paddingRight: theme.spacing.lg,
  textAlign: "right",
  color: theme.colors.gray,
  fontWeight: theme.fontWeights.bold,
  width: "6em",
}))

export const StyledSecondColumn = styled.div(({ theme }) => ({
  flex: 1,
  paddingRight: theme.spacing.lg,
  marginRight: "6em",
  [`@media (max-width: ${theme.breakpoints.sm})`]: {
    marginRight: theme.spacing.none,
  },
}))

export const StyledVideoFormatInstructions = styled.p(({ theme }) => ({
  marginTop: theme.spacing.sm,
  marginBottom: theme.spacing.none,
  fontSize: theme.fontSizes.sm,
}))

export const StyledDownloadButtonContainer = styled.div(({ theme }) => ({
  marginTop: theme.spacing.twoXS,
}))
