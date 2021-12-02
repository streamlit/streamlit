import React, { ReactElement, MouseEvent, ReactNode } from "react"
import styled, { CSSObject } from "@emotion/styled"
import ProgressBar from "src/components/shared/ProgressBar"
import { transparentize } from "color2k"
import { Theme } from "src/theme"

export enum Size {
  XSMALL = "xsmall",
  SMALL = "small",
  MEDIUM = "medium",
  LARGE = "large",
}

export interface CameraInputButtonProps {
  size?: Size
  onClick?: (event: MouseEvent<HTMLButtonElement>) => any
  disabled?: boolean
  fluidWidth?: boolean
  children: ReactNode
  autoFocus?: boolean
  progress?: number | null
}

type RequiredCameraInputButtonProps = Required<CameraInputButtonProps>

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

const StyledCameraInputBaseButton = styled.button<
  RequiredCameraInputButtonProps
>(({ fluidWidth, size, theme }) => ({
  display: "inline-flex", // maybe inline-flex (in normal button it is inline flex)
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: theme.fontWeights.normal,
  padding: `${theme.spacing.xs} ${theme.spacing.md}`,
  borderRadius: theme.radii.md,
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

function CameraInputButton({
  size,
  disabled,
  onClick,
  fluidWidth,
  children,
  autoFocus,
  progress,
}: CameraInputButtonProps): ReactElement {
  return (
    <StyledCameraInputBaseButton
      size={size || Size.MEDIUM}
      disabled={disabled || false}
      onClick={onClick || (() => {})}
      fluidWidth={fluidWidth || true}
      autoFocus={autoFocus || false}
      progress={progress || null}
    >
      {children}
      {progress && (
        <ProgressBar
          value={progress}
          overrides={{
            Bar: {
              style: {
                marginLeft: 0,
                marginTop: "4px",
              },
            },
          }}
        />
      )}
    </StyledCameraInputBaseButton>
  )
}

export default CameraInputButton
