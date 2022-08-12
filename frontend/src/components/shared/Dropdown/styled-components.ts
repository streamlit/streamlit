import isPropValid from "@emotion/is-prop-valid"
import styled from "@emotion/styled"
import { StyledDropdownListItem } from "baseui/select"

export const ThemedStyledDropdownListItem = styled(StyledDropdownListItem, {
  shouldForwardProp: isPropValid,
})(({ theme, $isHighlighted }) => {
  const backgroundColor = theme.inSidebar
    ? theme.colors.bgColor
    : theme.colors.secondaryBg
  return {
    display: "flex",
    alignItems: "center",
    paddingTop: theme.spacing.none,
    paddingBottom: theme.spacing.none,
    background: $isHighlighted ? backgroundColor : undefined,
    // Override the default itemSize set on the component's JSX
    // on mobile, so we can make list items taller and scrollable
    [`@media (max-width: 768px)`]: {
      minHeight: "40px",
      height: "auto !important",
    },
    "&:hover, &:active, &:focus": {
      background: backgroundColor,
    },
  }
})
