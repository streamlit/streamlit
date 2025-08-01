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

import React, { memo } from "react"

import { AcceptFileValue } from "~lib/util/utils"

import {
  StyledChatFileUploadDropzone,
  StyledChatFileUploadDropzoneLabel,
} from "./styled-components"

export interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  getRootProps: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  getInputProps: any
  acceptFile: AcceptFileValue
  inputHeight: string
}

const ChatFileUploadDropzone = ({
  getRootProps,
  getInputProps,
  acceptFile,
  inputHeight,
}: Props): React.ReactElement => (
  <>
    <StyledChatFileUploadDropzone height={inputHeight} {...getRootProps()}>
      <input {...getInputProps()} />
    </StyledChatFileUploadDropzone>
    <StyledChatFileUploadDropzoneLabel height={inputHeight}>
      {`Drag and drop ${
        acceptFile === AcceptFileValue.Multiple ? "files" : "a file"
      } here`}
    </StyledChatFileUploadDropzoneLabel>
  </>
)

export default memo(ChatFileUploadDropzone)
