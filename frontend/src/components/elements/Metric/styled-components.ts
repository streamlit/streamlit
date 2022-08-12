import styled from "@emotion/styled"
import { StyledWidgetLabel } from "src/components/widgets/BaseWidget/styled-components"

export const StyledTruncateText = styled.div(({ theme }) => ({
  overflowWrap: "normal",
  textOverflow: "ellipsis",
  width: "100%",
  overflow: "hidden",
  whiteSpace: "nowrap",
  fontFamily: theme.genericFonts.bodyFont,
  lineHeight: theme.lineHeights.normal,
  verticalAlign: "middle",
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
}))

export const StyledMetricLabelText = styled(StyledWidgetLabel)(() => ({
  marginBottom: 0,
}))

export const StyledMetricValueText = styled.div(({ theme }) => ({
  fontSize: theme.fontSizes.threeXL,
  color: theme.colors.textColor,
  paddingBottom: theme.spacing.twoXS,
}))

export const StyledMetricDeltaText = styled.div(({ theme }) => ({
  fontSize: theme.fontSizes.md,
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  fontWeight: theme.fontWeights.normal,
}))
