import React, { MouseEvent, ReactElement, ReactNode } from "react"

import ProgressBar, {
  Size as ProgressBarSize,
} from "src/components/shared/ProgressBar"
import {
  StyledCameraInputBaseButton,
  StyledProgressBar,
} from "./styled-components"

export interface CameraInputButtonProps {
  onClick?: (event: MouseEvent<HTMLButtonElement>) => any
  disabled?: boolean
  children: ReactNode
  progress?: number | null
}

function CameraInputButton({
  disabled,
  onClick,
  children,
  progress,
}: CameraInputButtonProps): ReactElement {
  return (
    <StyledCameraInputBaseButton
      disabled={disabled || false}
      onClick={onClick || (() => {})}
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
