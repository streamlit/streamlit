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

import { AcceptFileValue, AcceptImageValue } from "~lib/util/utils"

import {
  configureFileInputProps,
  getUploadDescription,
} from "./fileUploadUtils"
import {
  StyledChatFileUploadDropzone,
  StyledChatFileUploadDropzoneLabel,
} from "./styled-components"

export interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  getRootProps: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  getInputProps: any
  acceptImage: AcceptImageValue
  acceptFile: AcceptFileValue
  inputHeight: string
}

const ChatFileUploadDropzone = ({
  getRootProps,
  getInputProps,
  acceptImage,
  acceptFile,
  inputHeight,
}: Props): React.ReactElement => {
  // Use the primary accept type for configuration
  const primaryAcceptType =
    acceptImage !== AcceptImageValue.None ? acceptImage : acceptFile
  const inputProps = configureFileInputProps(
    getInputProps(),
    primaryAcceptType
  )

  // Determine the description based on what's enabled
  let description = ""
  if (
    acceptImage !== AcceptImageValue.None &&
    acceptFile !== AcceptFileValue.None
  ) {
    description = "files and images"
  } else if (acceptImage !== AcceptImageValue.None) {
    description = getUploadDescription(acceptImage)
  } else {
    description = getUploadDescription(acceptFile)
  }

  return (
    <>
      <StyledChatFileUploadDropzone height={inputHeight} {...getRootProps()}>
        <input {...inputProps} />
      </StyledChatFileUploadDropzone>
      <StyledChatFileUploadDropzoneLabel height={inputHeight}>
        {`Drag and drop ${description} here`}
      </StyledChatFileUploadDropzoneLabel>
    </>
  )
}

export default memo(ChatFileUploadDropzone)
