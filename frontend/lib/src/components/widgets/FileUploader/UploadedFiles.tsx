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

import React, { memo, ReactElement } from "react"

import {
  StyledUploadedFiles,
  StyledUploadedFilesList,
  StyledUploadedFilesListItem,
} from "./styled-components"
import UploadedFile from "./UploadedFile"
import { UploadFileInfo } from "./UploadFileInfo"
import withPagination, { PaginationProps } from "./withPagination"

export interface Props {
  items: UploadFileInfo[]
  onDelete: (id: number) => void
  disabled: boolean
}

const UploadedFileList = ({
  items,
  onDelete,
  disabled,
}: Props): ReactElement => {
  return (
    <StyledUploadedFilesList>
      {items.map(file => (
        <StyledUploadedFilesListItem key={file.id}>
          <UploadedFile
            fileInfo={file}
            onDelete={onDelete}
            disabled={disabled}
          />
        </StyledUploadedFilesListItem>
      ))}
    </StyledUploadedFilesList>
  )
}

export const PaginatedFiles = withPagination(UploadedFileList)

const UploadedFiles = (props: Props & PaginationProps): ReactElement => (
  <StyledUploadedFiles>
    <PaginatedFiles {...props} />
  </StyledUploadedFiles>
)
export default memo(UploadedFiles)
