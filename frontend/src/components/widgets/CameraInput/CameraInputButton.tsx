import React, { ReactElement, MouseEvent, ReactNode } from "react"
import styled, { CSSObject } from "@emotion/styled"
import { transparentize } from "color2k"

import ProgressBar, {
  Size as ProgressBarSize,
} from "src/components/shared/ProgressBar"
import { Theme } from "src/theme"
import { StyledProgressBar } from "./styled-components"

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
  position: "relative",
  display: "inline-flex",
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
        <StyledProgressBar>
          <ProgressBar
            value={progress}
            size={ProgressBarSize.EXTRASMALL}
            overrides={{
              Bar: {
                style: {
                  borderTopLeftRadius: "0px",
                  borderTopRightRadius: "0px",
                },
              },
              BarProgress: {
                style: {
                  borderTopLeftRadius: "0px",
                  borderTopRightRadius: "0px",
                },
              },
              BarContainer: {
                style: {
                  borderTopLeftRadius: "0px",
                  borderTopRightRadius: "0px",
                },
              },
            }}
          />
        </StyledProgressBar>
      )}
    </StyledCameraInputBaseButton>
  )
}

export default CameraInputButton
