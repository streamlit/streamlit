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

import React, { FC, memo } from "react"

import {
  Clear,
  ErrorOutline,
  InsertDriveFile,
} from "@emotion-icons/material-outlined"

import BaseButton, { BaseButtonKind } from "~lib/components/shared/BaseButton"
import Icon, { StyledSpinnerIcon } from "~lib/components/shared/Icon"
import { UploadFileInfo } from "~lib/components/widgets/FileUploader/UploadFileInfo"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { assertNever } from "~lib/util/assertNever"
import { FileSize, getSizeDisplay } from "~lib/util/FileHelper"

import { ChatUploadedFileIconTooltip } from "./ChatUploadedFileIconTooltip"
import {
  StyledChatUploadedFile,
  StyledChatUploadedFileDeleteButton,
  StyledChatUploadedFileIcon,
  StyledChatUploadedFileName,
  StyledChatUploadedFileSize,
} from "./styled-components"

export interface Props {
  fileInfo: UploadFileInfo
  onDelete: (id: number) => void
}

export interface ChatUploadedFileIconProps {
  fileInfo: UploadFileInfo
}

export const ChatUploadedFileIcon: FC<ChatUploadedFileIconProps> = ({
  fileInfo,
}) => {
  const theme = useEmotionTheme()
  const { type } = fileInfo.status

  switch (type) {
    case "uploading":
      return (
        <StyledSpinnerIcon
          data-testid="stChatInputFileIconSpinner"
          size="lg"
          margin="0"
          padding="0"
        />
      )
    case "error":
      return (
        <ChatUploadedFileIconTooltip content={fileInfo.status.errorMessage}>
          <Icon color={theme.colors.red} content={ErrorOutline} size="lg" />
        </ChatUploadedFileIconTooltip>
      )
    case "uploaded":
      return <Icon content={InsertDriveFile} size="lg" />
    default:
      assertNever(type)
      return null
  }
}

const ChatUploadedFile = ({
  fileInfo,
  onDelete,
}: Props): React.ReactElement => (
  <StyledChatUploadedFile
    className="stChatInputFile"
    data-testid="stChatInputFile"
  >
    <StyledChatUploadedFileIcon>
      <ChatUploadedFileIcon fileInfo={fileInfo} />
    </StyledChatUploadedFileIcon>
    <StyledChatUploadedFileName
      className="stChatInputFileName"
      data-testid="stChatInputFileName"
      title={fileInfo.name}
      fileStatus={fileInfo.status}
    >
      {fileInfo.name}
    </StyledChatUploadedFileName>
    <StyledChatUploadedFileSize>
      {getSizeDisplay(fileInfo.size, FileSize.Byte)}
    </StyledChatUploadedFileSize>
    <StyledChatUploadedFileDeleteButton data-testid="stChatInputDeleteBtn">
      <BaseButton
        onClick={() => onDelete(fileInfo.id)}
        kind={BaseButtonKind.MINIMAL}
      >
        <Icon content={Clear} size="lg" />
      </BaseButton>
    </StyledChatUploadedFileDeleteButton>
  </StyledChatUploadedFile>
)

export default memo(ChatUploadedFile)
