import styled from "@emotion/styled"

export interface StyledCameraImageInputProps {
  width: number
}

export const StyledCameraImageInput = styled.div<StyledCameraImageInputProps>(
  ({ theme, width }) => ({
    position: "relative",
    width: "100%",
    objectFit: "contain",
  })
)

export const StyledBox = styled.div<any>(({ theme, width }) => ({
  backgroundColor: theme.colors.secondaryBg,
  width,
  height: (width * 9) / 16,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
}))

export const StyledSwitchFacingModeButton = styled.div(({ theme }) => ({
  position: "absolute",
  top: theme.spacing.sm,
  right: theme.spacing.sm,
  zIndex: 1,
  color: theme.colors.fadedText40,
}))
