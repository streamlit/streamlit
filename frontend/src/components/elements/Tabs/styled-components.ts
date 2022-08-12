import styled from "@emotion/styled"
import { transparentize } from "color2k"

export interface StyledTabContainerProps {
  isOverflowing: boolean
  tabHeight: string
}

export const StyledTabContainer = styled.div<StyledTabContainerProps>(
  ({ theme, isOverflowing, tabHeight }) => ({
    ...(isOverflowing
      ? {
          position: "relative",
          "::after": {
            content: `" "`,
            position: "absolute",
            zIndex: 1,
            top: 0,
            right: 0,
            pointerEvents: "none",
            backgroundImage: `linear-gradient(to right, ${transparentize(
              theme.colors.bgColor,
              1
            )}, ${theme.colors.bgColor})`,
            width: theme.spacing.lg,
            height: tabHeight,
          },
        }
      : {}),
  })
)
