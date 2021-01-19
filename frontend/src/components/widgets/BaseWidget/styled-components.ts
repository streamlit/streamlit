import styled from "@emotion/styled"

export const StyledWidgetLabel = styled.label(({ theme }) => ({
  fontSize: theme.fontSizes.smDefault,
  color: theme.colors.bodyText,
  marginBottom: theme.fontSizes.halfSmDefault,
}))

export const StyledWidgetLabelHelp = styled.div(() => ({
  position: "absolute",
  top: "1px",
  right: 0,
}))

export const StyledWidgetLabelHelpTopLeft = styled.div(() => ({
  position: "absolute",
  left: "-30px",
  top: "1px",
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
