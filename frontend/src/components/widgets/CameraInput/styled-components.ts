import styled, { CSSObject } from "@emotion/styled"
import { transparentize } from "color2k"
import { Theme } from "src/theme"
import { MouseEvent, ReactNode } from "react"

export interface CameraInputButtonProps {
  size?: Size
  onClick?: (event: MouseEvent<HTMLButtonElement>) => any
  disabled?: boolean
  fluidWidth?: boolean
  children: ReactNode
  autoFocus?: boolean
  progress?: number | null
}

export interface StyledCameraInputProps {
  width: number
}

export enum Size {
  XSMALL = "xsmall",
  SMALL = "small",
  MEDIUM = "medium",
  LARGE = "large",
}

function getSizeStyle(size: Size, theme: Theme): CSSObject {
  switch (size) {
    case Size.XSMALL:
      return {
        padding: `${theme.spacing.twoXS} ${theme.spacing.sm}`,
        fontSize: theme.fontSizes.sm,
      }
    case Size.SMALL:
      return {
        padding: `${theme.spacing.twoXS} ${theme.spacing.md}`,
      }
    case Size.LARGE:
      return {
        padding: `${theme.spacing.md} ${theme.spacing.md}`,
      }
    default:
      return {
        padding: `${theme.spacing.xs} ${theme.spacing.md}`,
      }
  }
}

type RequiredCameraInputButtonProps = Required<CameraInputButtonProps>

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

export const StyledCameraInputBaseButton = styled.button<
  RequiredCameraInputButtonProps
>(({ fluidWidth, size, theme }) => ({
  position: "relative",
  display: "inline-flex", // maybe inline-flex (in normal button it is inline flex)
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: theme.colors.lightenedBg05,
  border: `1px solid ${theme.colors.fadedText10}`,
  borderRadius: `0 0 ${theme.radii.md} ${theme.radii.md}`,
  "&:hover": {
    borderColor: theme.colors.primary,
    color: theme.colors.primary,
  },
  "&:active": {
    color: theme.colors.white,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  "&:focus:not(:active)": {
    borderColor: theme.colors.primary,
    color: theme.colors.primary,
  },
  "&:disabled, &:disabled:hover, &:disabled:active": {
    color: theme.colors.fadedText40,
  },
  fontWeight: theme.fontWeights.normal,
  padding: `${theme.spacing.xs} ${theme.spacing.md}`,
  margin: 0,
  lineHeight: theme.lineHeights.base,
  color: "inherit",
  width: fluidWidth ? "100%" : "auto",
  userSelect: "none",
  "&:focus": {
    boxShadow: `0 0 0 0.2rem ${transparentize(theme.colors.primary, 0.5)}`,
    outline: "none",
  },
  ...getSizeStyle(size, theme),
}))
