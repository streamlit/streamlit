import styled from "@emotion/styled"

export const StyledUISelect = styled.div(({ theme }) => ({
  "span[aria-disabled='true']": {
    background: theme.colors.fadedText05,
  },
}))
