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
import React, { ReactElement } from "react"
import { styled } from "styletron-react"

import withPagination, { PaginationProps } from "hocs/withPagination"
import { ExtendedFile } from "lib/FileHelper"
import { fontStyles, spacingCalculator } from "lib/widgetTheme"
import UploadedFile from "./UploadedFile"

export interface Props {
  items: ExtendedFile[]
  onDelete: (id: string) => void
}

const StyledUploadedFiles = styled("div", {
  left: 0,
  right: 0,
  lineHeight: fontStyles.lineHeightTight,
  paddingTop: spacingCalculator(0.75),
  paddingLeft: spacingCalculator(),
  paddingRight: spacingCalculator(2),
})

const UploadedFileList = ({ items, onDelete }: Props): ReactElement => {
  return (
    <ul>
      {items.map(file => (
        <li>
          <UploadedFile
            key={file.id}
            file={file}
            progress={file.progress || 40}
            onDelete={onDelete}
          />
        </li>
      ))}
    </ul>
  )
}

export const PaginatedFiles = withPagination(UploadedFileList)

const UploadedFiles = (props: Props & PaginationProps): ReactElement => (
  <StyledUploadedFiles className="uploadedFiles">
    <PaginatedFiles {...props} />
  </StyledUploadedFiles>
)
export default UploadedFiles
