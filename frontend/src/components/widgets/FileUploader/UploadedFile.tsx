/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
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

import Button, { Kind } from "components/shared/Button"
import { MaterialIcon } from "components/shared/Icon"
import ProgressBar from "components/shared/ProgressBar"
import { Small, Kind as TextKind } from "components/shared/TextElements"
import {
  ExtendedFile,
  FileSizes,
  FileStatuses,
  getSizeDisplay,
} from "lib/FileHelper"
import { Sizes } from "lib/widgetTheme"
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
  file: ExtendedFile
  progress?: number
  onDelete: (id: string) => void
}

export interface FileStatusProps {
  file: ExtendedFile
  progress?: number
}

export const FileStatus = ({
  file,
  progress,
}: FileStatusProps): React.ReactElement | null => {
  if (progress) {
    return (
      <ProgressBar
        value={progress}
        size={Sizes.SMALL}
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

  if (file.status === FileStatuses.ERROR) {
    return (
      <StyledFileError>
        <StyledErrorMessage data-testid="stUploadedFileErrorMessage">
          {file.errorMessage || "error"}
        </StyledErrorMessage>
        <StyledFileErrorIcon>
          <MaterialIcon icon="error" />
        </StyledFileErrorIcon>
      </StyledFileError>
    )
  }

  if (file.status === FileStatuses.UPLOADED) {
    return (
      <Small kind={TextKind.SECONDARY}>
        {getSizeDisplay(file.size, FileSizes.Byte)}
      </Small>
    )
  }

  if (file.status === FileStatuses.DELETING) {
    return <Small kind={TextKind.SECONDARY}>Removing file</Small>
  }

  return null
}

const UploadedFile = ({
  file,
  progress,
  onDelete,
}: Props): React.ReactElement => {
  return (
    <StyledUploadedFile className="uploadedFile">
      <StyledFileIcon>
        <MaterialIcon
          type="outlined"
          icon="insert_drive_file"
          size={Sizes.MEDIUM}
        />
      </StyledFileIcon>
      <StyledUploadedFileData className="uploadedFileData">
        <StyledUploadedFileName className="uploadedFileName" title={file.name}>
          {file.name}
        </StyledUploadedFileName>
        <FileStatus file={file} progress={progress} />
      </StyledUploadedFileData>
      <Button onClick={() => onDelete(file.id || "")} kind={Kind.MINIMAL}>
        <MaterialIcon icon="clear" />
      </Button>
    </StyledUploadedFile>
  )
}

export default UploadedFile
