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

import { memo } from "react"

import { Add } from "@emotion-icons/material-rounded"
import { Accept, FileRejection, useDropzone } from "react-dropzone"

import Icon from "~lib/components/shared/Icon"
import Tooltip, { Placement } from "~lib/components/shared/Tooltip"
import { StyledSendIconButton } from "~lib/components/widgets/ChatInput/styled-components"
import { AcceptFileValue } from "~lib/util/utils"

import {
  configureFileInputProps,
  getUploadDescription,
} from "./fileUploadUtils"
import { StyledFileUploadButton } from "./styled-components"

export interface Props {
  onDrop: (acceptedFiles: File[], rejectedFiles: FileRejection[]) => void
  multiple: boolean
  accept?: Accept
  maxSize: number
  acceptFile: AcceptFileValue
  disabled: boolean
}

const ChatFileUploadButton = ({
  onDrop,
  multiple,
  accept,
  maxSize,
  acceptFile,
  disabled,
}: Props): React.ReactElement => {
  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    multiple,
    accept,
    maxSize,
    // Disable the File System Access API to avoid browser-specific issues
    // (see issue #6176 and FileDropzone for details).
    useFsAccessApi: false,
  })

  const inputProps = configureFileInputProps(getInputProps(), acceptFile)

  // React-dropzone's root props include `tabIndex=0` by default, which makes the
  // wrapper a keyboard focus target. Since we render an actual <button> inside
  // the wrapper, we don't want two tab stops for the same control.
  const rootProps = getRootProps({ tabIndex: -1 })

  return (
    <StyledFileUploadButton
      data-testid="stChatInputFileUploadButton"
      disabled={disabled}
      {...rootProps}
    >
      <input {...inputProps} />
      <Tooltip
        content={`Upload or drag and drop ${getUploadDescription(acceptFile)}`}
        placement={Placement.TOP}
        onMouseEnterDelay={500}
      >
        <StyledSendIconButton
          disabled={disabled}
          aria-label={`Upload ${getUploadDescription(acceptFile)}`}
        >
          <Icon content={Add} size="xl" color="inherit" />
        </StyledSendIconButton>
      </Tooltip>
    </StyledFileUploadButton>
  )
}

export default memo(ChatFileUploadButton)
