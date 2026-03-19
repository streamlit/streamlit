/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import { memo, ReactElement, ReactNode } from "react"

import UploadedFileChips from "~lib/components/shared/UploadedFile/UploadedFileChips"
import { UploadFileInfo } from "~lib/components/shared/UploadedFile/UploadFileInfo"

import { StyledUploadedFiles } from "./styled-components"

interface Props {
  items: UploadFileInfo[]
  onDelete: (id: number) => void
  disabled?: boolean
  trailingContent?: ReactNode
}

const UploadedFiles = ({
  items,
  onDelete,
  disabled,
  trailingContent,
}: Props): ReactElement => (
  <StyledUploadedFiles>
    <UploadedFileChips
      items={items}
      onDelete={onDelete}
      disabled={disabled}
      trailingContent={trailingContent}
    />
  </StyledUploadedFiles>
)

export default memo(UploadedFiles)
