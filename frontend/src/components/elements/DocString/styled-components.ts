import styled from "@emotion/styled"

export const StyledDocModule = styled.span(({ theme }) => ({
  color: theme.colors.docStringModuleText,
}))

export const StyledDocName = styled.span(({ theme }) => ({
  fontWeight: theme.fontWeights.bold,
}))

export interface StyledDocContainerProps {
  width: number
}

export const StyledDocContainer = styled.span<StyledDocContainerProps>(
  ({ theme, width }) => ({
    backgroundColor: theme.colors.docStringContainerBackground,
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    fontFamily: theme.fonts.monospace,
    fontSize: theme.fontSizes.sm,
    overflowX: "auto",
    width,
  })
)

export const StyledDocHeader = styled.div(({ theme }) => ({
  paddingBottom: theme.spacing.sm,
  marginBottom: theme.spacing.sm,
  borderBottom: `1px solid ${theme.colors.fadedText10}`,
}))

export const StyledDocString = styled.div({
  whiteSpace: "pre",
})
