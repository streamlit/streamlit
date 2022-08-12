import styled from "@emotion/styled"

export enum Kind {
  DANGER = "danger",
}

interface TextProps {
  kind?: Kind
}

export const Small = styled.small<TextProps>(({ kind, theme }) => {
  const { danger, fadedText60 } = theme.colors

  return {
    color: kind === Kind.DANGER ? danger : fadedText60,
    fontSize: theme.fontSizes.sm,
    lineHeight: "1.25",
  }
})
