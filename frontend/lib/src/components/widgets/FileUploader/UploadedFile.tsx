/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import React from "react"

import {
  Clear,
  Error,
  InsertDriveFile,
} from "@emotion-icons/material-outlined"

import BaseButton, {
  BaseButtonKind,
} from "@streamlit/lib/src/components/shared/BaseButton"
import Icon from "@streamlit/lib/src/components/shared/Icon"
import ProgressBar, {
  Size,
} from "@streamlit/lib/src/components/shared/ProgressBar"
import { Small } from "@streamlit/lib/src/components/shared/TextElements"
import { FileSize, getSizeDisplay } from "@streamlit/lib/src/util/FileHelper"

import {
  StyledErrorMessage,
  StyledFileError,
  StyledFileErrorIcon,
  StyledFileIcon,
  StyledUploadedFile,
  StyledUploadedFileData,
  StyledUploadedFileName,
} from "./styled-components"
import { UploadFileInfo } from "./UploadFileInfo"

export interface Props {
  fileInfo: UploadFileInfo
  onDelete: (id: number) => void
}

export interface UploadedFileStatusProps {
  fileInfo: UploadFileInfo
}

export const UploadedFileStatus = ({
  fileInfo,
}: UploadedFileStatusProps): React.ReactElement | null => {
  if (fileInfo.status.type === "uploading") {
    return <ProgressBar value={fileInfo.status.progress} size={Size.SMALL} />
  }

  if (fileInfo.status.type === "error") {
    return (
      <StyledFileError>
        <StyledErrorMessage data-testid="stFileUploaderFileErrorMessage">
          {fileInfo.status.errorMessage}
        </StyledErrorMessage>
        <StyledFileErrorIcon>
          <Icon content={Error} size="lg" />
        </StyledFileErrorIcon>
      </StyledFileError>
    )
  }

  if (fileInfo.status.type === "uploaded") {
    return <Small>{getSizeDisplay(fileInfo.size, FileSize.Byte)}</Small>
  }

  return null
}

const UploadedFile = ({ fileInfo, onDelete }: Props): React.ReactElement => {
  return (
    <StyledUploadedFile
      className="stFileUploaderFile"
      data-testid="stFileUploaderFile"
    >
      <StyledFileIcon>
        <Icon content={InsertDriveFile} size="twoXL" />
      </StyledFileIcon>
      <StyledUploadedFileData className="stFileUploaderFileData">
        <StyledUploadedFileName
          className="stFileUploaderFileName"
          data-testid="stFileUploaderFileName"
          title={fileInfo.name}
        >
          {fileInfo.name}
        </StyledUploadedFileName>
        <UploadedFileStatus fileInfo={fileInfo} />
      </StyledUploadedFileData>
      <div data-testid="stFileUploaderDeleteBtn">
        <BaseButton
          onClick={() => onDelete(fileInfo.id)}
          kind={BaseButtonKind.MINIMAL}
        >
          <Icon content={Clear} size="lg" />
        </BaseButton>
      </div>
    </StyledUploadedFile>
  )
}

export default UploadedFile
