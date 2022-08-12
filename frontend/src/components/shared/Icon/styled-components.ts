import { EmotionIcon } from "@emotion-icons/emotion-icon"
import isPropValid from "@emotion/is-prop-valid"
import styled from "@emotion/styled"
import { IconSize, ThemeColor, computeSpacingStyle } from "src/theme"

interface StyledIconProps {
  as?: EmotionIcon
  color: ThemeColor
  size: IconSize
  margin: string
  padding: string
}

export const StyledIcon = styled("span", {
  shouldForwardProp: (prop: string) =>
    isPropValid(prop) && !["size", "as"].includes(prop),
})<StyledIconProps>(({ color, size, margin, padding, theme }) => {
  return {
    color: theme.colors[color],
    fill: "currentColor",
    display: "inline-flex",
    alignItems: "center",
    justifyContents: "center",
    fontSize: theme.iconSizes[size],
    width: theme.iconSizes[size],
    height: theme.iconSizes[size],
    margin: computeSpacingStyle(margin, theme),
    padding: computeSpacingStyle(padding, theme),
  }
})

interface StyledEmojiIconProps {
  size: IconSize
  margin: string
  padding: string
}

export const StyledEmojiIcon = styled.span<StyledEmojiIconProps>(
  ({ size, margin, padding, theme }) => {
    return {
      display: "inline-flex",
      alignItems: "center",
      justifyContents: "center",
      fontSize: theme.iconSizes[size],
      width: theme.iconSizes[size],
      height: theme.iconSizes[size],
      margin: computeSpacingStyle(margin, theme),
      padding: computeSpacingStyle(padding, theme),
    }
  }
)
