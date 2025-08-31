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

import { UploadFileInfo } from "~lib/components/widgets/FileUploader/UploadFileInfo"

import ChatUploadedFile from "./ChatUploadedFile"
import {
  StyledChatUploadedFiles,
  StyledUploadedChatFileList,
  StyledUploadedChatFileListItem,
} from "./styled-components"

export interface Props {
  items: UploadFileInfo[]
  onDelete: (id: number) => void
}

const ChatUploadedFiles = ({ items, onDelete }: Props): ReactElement => (
  <StyledChatUploadedFiles data-testid="stChatUploadedFiles">
    <StyledUploadedChatFileList>
      {items.map(file => (
        <StyledUploadedChatFileListItem key={file.id}>
          <ChatUploadedFile fileInfo={file} onDelete={onDelete} />
        </StyledUploadedChatFileListItem>
      ))}
    </StyledUploadedChatFileList>
  </StyledChatUploadedFiles>
)

export default memo(ChatUploadedFiles)
