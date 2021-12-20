import React, { ReactElement } from "react"
import ProgressBar, {
  Size as ProgressBarSize,
} from "src/components/shared/ProgressBar"
import {
  Size,
  StyledCameraInputBaseButton,
  CameraInputButtonProps,
} from "./styled-components"

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
          size={ProgressBarSize.SMALL}
          overrides={{
            Bar: {
              style: {
                // position: "absolute",
                left: 0,
                bottom: 0,
              },
            },
          }}
        />
      )}
    </StyledCameraInputBaseButton>
  )
}

export default CameraInputButton
