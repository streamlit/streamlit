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

export const StyledCameraDiv = styled.div<StyledCameraImageInputProps>(
  ({ theme, width }) => ({
    height: (9 / 16) * width,
    width,
    objectFit: "contain",
  })
)
