/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
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
import Button, { Kind } from "components/shared/Button"
import Icon from "components/shared/Icon"
import ProgressBar, { Size } from "components/shared/ProgressBar"
import { Small, Kind as TextKind } from "components/shared/TextElements"
import {
  UploadFileInfo,
  FileSize,
  FileStatus,
  getSizeDisplay,
} from "lib/FileHelper"
import {
  StyledUploadedFile,
  StyledFileErrorIcon,
  StyledErrorMessage,
  StyledFileError,
  StyledFileIcon,
  StyledUploadedFileData,
  StyledUploadedFileName,
} from "./styled-components"

export interface Props {
  fileInfo: UploadFileInfo
  progress?: number
  onDelete: (id: string) => void
}

export interface UploadedFileStatusProps {
  fileInfo: UploadFileInfo
  progress?: number
}

export const UploadedFileStatus = ({
  fileInfo,
  progress,
}: UploadedFileStatusProps): React.ReactElement | null => {
  if (progress) {
    return (
      <ProgressBar
        value={progress}
        size={Size.SMALL}
        overrides={{
          Bar: {
            style: {
              marginLeft: 0,
              marginTop: "4px",
            },
          },
        }}
      />
    )
  }

  if (fileInfo.status === FileStatus.ERROR) {
    return (
      <StyledFileError>
        <StyledErrorMessage data-testid="stUploadedFileErrorMessage">
          {fileInfo.errorMessage || "error"}
        </StyledErrorMessage>
        <StyledFileErrorIcon>
          <Icon content={Error} size="lg" />
        </StyledFileErrorIcon>
      </StyledFileError>
    )
  }

  if (fileInfo.status === FileStatus.UPLOADED) {
    return (
      <Small kind={TextKind.SECONDARY}>
        {getSizeDisplay(fileInfo.file.size, FileSize.Byte)}
      </Small>
    )
  }

  if (fileInfo.status === FileStatus.DELETING) {
    return <Small kind={TextKind.SECONDARY}>Removing file</Small>
  }

  return null
}

const UploadedFile = ({
  fileInfo,
  progress,
  onDelete,
}: Props): React.ReactElement => {
  return (
    <StyledUploadedFile className="uploadedFile">
      <StyledFileIcon>
        <Icon content={InsertDriveFile} size="twoXL" />
      </StyledFileIcon>
      <StyledUploadedFileData className="uploadedFileData">
        <StyledUploadedFileName
          className="uploadedFileName"
          title={fileInfo.file.name}
        >
          {fileInfo.file.name}
        </StyledUploadedFileName>
        <UploadedFileStatus fileInfo={fileInfo} progress={progress} />
      </StyledUploadedFileData>
      <div data-testid="fileDeleteBtn">
        <Button onClick={() => onDelete(fileInfo.id)} kind={Kind.MINIMAL}>
          <Icon content={Clear} size="lg" />
        </Button>
      </div>
    </StyledUploadedFile>
  )
}

export default UploadedFile
