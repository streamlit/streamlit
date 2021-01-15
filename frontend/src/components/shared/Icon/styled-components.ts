import { EmotionIcon } from "@emotion-icons/emotion-icon"
import isPropValid from "@emotion/is-prop-valid"
import styled from "@emotion/styled"
import { IconSize, ThemeColor, computeSpacingStyle } from "theme"

interface StyledIconProps {
  as?: EmotionIcon
  color: ThemeColor
  size: IconSize
  margin: string
  padding: string
}

export const StyledIcon = styled("span", {
  shouldForwardProp: prop =>
    isPropValid(prop) && !["size", "as"].includes(prop),
})<StyledIconProps>(({ color, size, margin, padding, theme }) => {
  return {
    color: theme.colors[color],
    fill: "currentColor",
    display: "inline-flex",
    fontSize: theme.iconSizes[size],
    width: theme.iconSizes[size],
    height: theme.iconSizes[size],
    margin: computeSpacingStyle(margin, theme),
    padding: computeSpacingStyle(padding, theme),
  }
})
