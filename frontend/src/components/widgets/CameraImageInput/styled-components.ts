import styled from "@emotion/styled"
import { style } from "d3"

export interface StyledCameraImageInputProps {
  width: number
}

export const StyledCameraImageInputButton = styled.div(() => ({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
}))

export const StyledCameraImageInput = styled.div<StyledCameraImageInputProps>(
  ({ theme, width }) => ({
    position: "relative",
    width,
  })
)
