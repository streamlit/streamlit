import styled from "@emotion/styled"

export const StyledWidgetLabel = styled.label(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  fontSize: theme.fontSizes.smDefault,
  color: theme.colors.bodyText,
  marginBottom: theme.fontSizes.halfSmDefault,
}))

export const StyledWidgetInstructions = styled.div(({ theme }) => ({
  fontSize: theme.fontSizes.smDefault,
  color: theme.colors.gray,
  margin: theme.spacing.none,
  textAlign: "right",
  position: "absolute",
  bottom: 0,
  right: theme.fontSizes.halfSmDefault,
}))
