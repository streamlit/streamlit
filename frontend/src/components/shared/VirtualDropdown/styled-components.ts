import styled from "@emotion/styled"
import { StyledDropdownListItem } from "baseui/select"

export const StyledTruncateText = styled.span({
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
})

export const ThemedStyledDropdownListItem = styled(StyledDropdownListItem)(
  ({ theme }) => ({
    display: "flex",
    alignItems: "center",
    paddingTop: theme.spacing.none,
    paddingBottom: theme.spacing.none,
  })
)
