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
import { styled, withStyleDeep } from "styletron-react"

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
import { colors, Sizes, utilityClasses, spacing } from "lib/widgetTheme"

import "./FileUploader.scss"

export interface Props {
  file: ExtendedFile
  progress?: number
  onDelete: (id: string) => void
}

export interface FileStatusProps {
  file: ExtendedFile
  progress?: number
}

const UploadedFileData = styled("div", {
  display: "flex",
  alignItems: "baseline",
  flex: 1,
  paddingLeft: spacing.lg,
  overflow: "hidden",
})

const UploadedFileName = withStyleDeep(
  styled("div", {
    marginRight: spacing.sm,
    marginBottom: spacing.xxs,
  }),
  utilityClasses.ellipsis
)

const StyledUploadedFile = styled("div", {
  display: "flex",
  alignItems: "center",
  marginBottom: spacing.xxs,
})

export const ErrorMessage = styled("span", {
  marginRight: spacing.xxs,
})

export const FileIcon = styled("div", {
  display: "flex",
  padding: spacing.xxs,
  color: colors.secondary,
})

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
      <Small className="fileError" kind={TextKind.DANGER}>
        <ErrorMessage>{file.errorMessage || "error"}</ErrorMessage>
        <MaterialIcon icon="error" />
      </Small>
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
      <FileIcon>
        <MaterialIcon
          type="outlined"
          icon="insert_drive_file"
          size={Sizes.MEDIUM}
        />
      </FileIcon>
      <UploadedFileData className="uploadedFileData">
        <UploadedFileName className="uploadedFileName" title={file.name}>
          {file.name}
        </UploadedFileName>
        <FileStatus file={file} progress={progress} />
      </UploadedFileData>
      <Button onClick={() => onDelete(file.id || "")} kind={Kind.MINIMAL}>
        <MaterialIcon icon="clear" />
      </Button>
    </StyledUploadedFile>
  )
}

export default UploadedFile
