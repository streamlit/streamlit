import React, { ReactElement } from "react"
import { SwitchCamera } from "@emotion-icons/material-rounded"

import Button, { Kind } from "src/components/shared/Button"
import Icon from "src/components/shared/Icon"
import Tooltip, { Placement } from "src/components/shared/Tooltip"
import themeColors from "src/theme/baseTheme/themeColors"
import { StyledSwitchFacingModeButton } from "./styled-components"

export enum FacingMode {
  USER = "user",
  ENVIRONMENT = "environment",
}

export interface SwitchFacingModeButtonProps {
  switchFacingMode: () => void
}

const SwitchFacingModeButton = ({
  switchFacingMode,
}: SwitchFacingModeButtonProps): ReactElement => {
  return (
    <StyledSwitchFacingModeButton>
      <Tooltip content={"Switch camera"} placement={Placement.TOP_RIGHT}>
        <Button kind={Kind.MINIMAL} onClick={switchFacingMode}>
          <Icon
            content={SwitchCamera}
            size="twoXL"
            color={themeColors.white}
          />
        </Button>
      </Tooltip>
    </StyledSwitchFacingModeButton>
  )
}

export default SwitchFacingModeButton
