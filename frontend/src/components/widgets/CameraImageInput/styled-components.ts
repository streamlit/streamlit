import styled from "@emotion/styled"

export interface StyledCameraImageInputProps {
  width: number
}

export const StyledCameraImageInput = styled.div<StyledCameraImageInputProps>(
  ({ theme, width }) => ({
    position: "relative",
    width,
  })
)
