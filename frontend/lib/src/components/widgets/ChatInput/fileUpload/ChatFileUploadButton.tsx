/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import React, { memo } from "react"

import { AttachFile } from "@emotion-icons/material-outlined"

import BaseButton, { BaseButtonKind } from "~lib/components/shared/BaseButton"
import Icon from "~lib/components/shared/Icon"
import { Placement } from "~lib/components/shared/Tooltip"
import TooltipIcon from "~lib/components/shared/TooltipIcon"
import { EmotionTheme } from "~lib/theme"
import { AcceptFileValue } from "~lib/util/utils"

import {
  StyledFileUploadButton,
  StyledFileUploadButtonContainer,
  StyledVerticalDivider,
} from "./styled-components"

export interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  getRootProps: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  getInputProps: any
  acceptFile: AcceptFileValue
  disabled: boolean
  theme: EmotionTheme
}

const ChatFileUploadButton = ({
  getRootProps,
  getInputProps,
  acceptFile,
  disabled,
  theme,
}: Props): React.ReactElement => (
  <StyledFileUploadButtonContainer disabled={disabled}>
    <StyledFileUploadButton
      data-testid="stChatInputFileUploadButton"
      disabled={disabled}
      {...getRootProps()}
    >
      <input {...getInputProps()} />
      <TooltipIcon
        content={`Upload or drag and drop ${
          acceptFile === AcceptFileValue.Multiple ? "files" : "a file"
        }`}
        placement={Placement.TOP}
        onMouseEnterDelay={500}
      >
        <BaseButton kind={BaseButtonKind.MINIMAL} disabled={disabled}>
          <Icon
            content={AttachFile}
            size="lg"
            color={
              disabled ? theme.colors.fadedText40 : theme.colors.fadedText60
            }
          />
        </BaseButton>
      </TooltipIcon>
    </StyledFileUploadButton>
    <StyledVerticalDivider />
  </StyledFileUploadButtonContainer>
)

export default memo(ChatFileUploadButton)
