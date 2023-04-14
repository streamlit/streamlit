/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { ReactElement } from "react"
import { SwitchCamera } from "@emotion-icons/material-rounded"

import Button, { Kind } from "src/lib/components/shared/Button"
import Icon from "src/lib/components/shared/Icon"
import Tooltip, { Placement } from "src/lib/components/shared/Tooltip"
import themeColors from "src/lib/theme/emotionBaseTheme/themeColors"
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
