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

import { memo, ReactElement } from "react"

import { StyledUploadedFiles } from "./styled-components"
import { UploadFileInfo } from "./UploadFileInfo"
import ChatUploadedFiles from "~lib/components/widgets/ChatInput/fileUpload/ChatUploadedFiles"

export interface Props {
  items: UploadFileInfo[]
  onDelete: (id: number) => void
  disabled: boolean
}

const UploadedFiles = ({ items, onDelete }: Props): ReactElement => (
  <StyledUploadedFiles>
    <ChatUploadedFiles items={items} onDelete={onDelete} />
  </StyledUploadedFiles>
)
export default memo(UploadedFiles)
