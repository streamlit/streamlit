import styled from "@emotion/styled"

export interface StyledTextInputProps {
  width: number
}

export const StyledTextInput = styled.div<StyledTextInputProps>(
  ({ theme, width }) => ({
    position: "relative",
    width,
  })
)
