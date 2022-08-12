import React, { ReactElement, ReactNode } from "react"
import { EmotionIcon } from "@emotion-icons/emotion-icon"
import { IconSize, ThemeColor } from "src/theme"
import { StyledIcon, StyledEmojiIcon } from "./styled-components"

interface GetDefaultPropsArgs {
  size?: IconSize
  margin?: string
  padding?: string
}

interface DefaultProps {
  size: IconSize
  margin: string
  padding: string
}

const getDefaultProps = ({
  size,
  margin,
  padding,
}: GetDefaultPropsArgs): DefaultProps => ({
  size: size || "md",
  margin: margin || "",
  padding: padding || "",
})

interface IconProps {
  content: EmotionIcon
  size?: IconSize
  color?: ThemeColor
  margin?: string
  padding?: string
}

const Icon = ({
  content,
  color,
  size,
  margin,
  padding,
}: IconProps): ReactElement => (
  <StyledIcon
    as={content}
    color={color || "inherit"}
    aria-hidden="true"
    {...getDefaultProps({ size, margin, padding })}
  />
)

interface EmojiIconProps {
  size?: IconSize
  margin?: string
  padding?: string
  children: ReactNode
}

export const EmojiIcon = ({
  size,
  margin,
  padding,
  children,
}: EmojiIconProps): ReactElement => (
  <StyledEmojiIcon
    aria-hidden="true"
    {...getDefaultProps({ size, margin, padding })}
  >
    {children}
  </StyledEmojiIcon>
)

export default Icon
