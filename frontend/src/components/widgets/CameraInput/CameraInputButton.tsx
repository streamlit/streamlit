import React, { ReactElement, MouseEvent, ReactNode } from "react"
import ProgressBar, {
  Size as ProgressBarSize,
} from "src/components/shared/ProgressBar"
import {
  StyledProgressBar,
  StyledCameraInputBaseButton,
} from "./styled-components"

export interface CameraInputButtonProps {
  size?: Size
  onClick?: (event: MouseEvent<HTMLButtonElement>) => any
  disabled?: boolean
  fluidWidth?: boolean
  children: ReactNode
  autoFocus?: boolean
  progress?: number | null
}

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
