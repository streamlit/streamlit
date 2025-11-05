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
import { AcceptFileValue, AcceptImageValue } from "~lib/util/utils"

import {
  configureFileInputProps,
  getUploadDescription,
} from "./fileUploadUtils"
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
  acceptImage: AcceptImageValue
  acceptFile: AcceptFileValue
  disabled: boolean
  theme: EmotionTheme
}

const ChatFileUploadButton = ({
  getRootProps,
  getInputProps,
  acceptImage,
  acceptFile,
  disabled,
  theme,
}: Props): React.ReactElement => {
  // Use the primary accept type for configuration
  const primaryAcceptType =
    acceptImage !== AcceptImageValue.None ? acceptImage : acceptFile
  const inputProps = configureFileInputProps(
    getInputProps(),
    primaryAcceptType
  )

  // Determine the description based on what's enabled
  let description = ""
  if (
    acceptImage !== AcceptImageValue.None &&
    acceptFile !== AcceptFileValue.None
  ) {
    description = "files and images"
  } else if (acceptImage !== AcceptImageValue.None) {
    description = getUploadDescription(acceptImage)
  } else {
    description = getUploadDescription(acceptFile)
  }

  return (
    <StyledFileUploadButtonContainer disabled={disabled}>
      <StyledFileUploadButton
        data-testid="stChatInputFileUploadButton"
        disabled={disabled}
        {...getRootProps()}
      >
        <input {...inputProps} />
        <TooltipIcon
          content={`Upload or drag and drop ${description}`}
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
}

export default memo(ChatFileUploadButton)
