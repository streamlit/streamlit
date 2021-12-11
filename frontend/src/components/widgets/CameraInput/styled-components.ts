import styled from "@emotion/styled"

export interface StyledCameraInputProps {
  width: number
}

export const StyledCameraInput = styled.div<StyledCameraInputProps>(
  ({ theme, width }) => ({
    // This is used to position the "Switch facing mode" button
    // with respect to the webcam block.
    position: "relative",
    width: "100%",
    objectFit: "contain",
  })
)

export interface StyledBoxProps {
  width: number
}

export const StyledBox = styled.div<StyledBoxProps>(({ theme, width }) => ({
  backgroundColor: theme.colors.secondaryBg,
  borderRadius: `${theme.radii.md} ${theme.radii.md} 0 0`,
  width,
  height: (width * 9) / 16,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
}))

export const StyledDescription = styled.p(({ theme }) => ({
  marginTop: theme.spacing.sm,
  textAlign: "center",
}))

export const StyledLink = styled.a(({ theme }) => ({
  color: theme.colors.primary,
  display: "block",
  textDecoration: "none",
}))

export const StyledSwitchFacingModeButton = styled.div(({ theme }) => ({
  position: "absolute",
  top: theme.spacing.sm,
  right: theme.spacing.sm,
  zIndex: 1,
  color: theme.colors.fadedText40,
}))

export const StyledWebcamWrapper = styled.div(({ theme }) => ({
  display: "flex",
}))
