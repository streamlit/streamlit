import React, { ReactElement } from "react"

import withPagination, { PaginationProps } from "src/hocs/withPagination"
import UploadedFile from "./UploadedFile"
import {
  StyledUploadedFiles,
  StyledUploadedFilesList,
  StyledUploadedFilesListItem,
} from "./styled-components"
import { UploadFileInfo } from "./UploadFileInfo"

export interface Props {
  items: UploadFileInfo[]
  onDelete: (id: number) => void
}

const UploadedFileList = ({ items, onDelete }: Props): ReactElement => {
  return (
    <StyledUploadedFilesList>
      {items.map(file => (
        <StyledUploadedFilesListItem key={file.id}>
          <UploadedFile fileInfo={file} onDelete={onDelete} />
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
export default UploadedFiles
