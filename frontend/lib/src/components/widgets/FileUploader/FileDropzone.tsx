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

import Dropzone, { DropzoneInputProps, FileRejection } from "react-dropzone"

import BaseButton, {
  BaseButtonKind,
  BaseButtonSize,
} from "~lib/components/shared/BaseButton/BaseButton"
import { DynamicButtonLabel } from "~lib/components/shared/BaseButton/DynamicButtonLabel"

import FileDropzoneInstructions from "./FileDropzoneInstructions"
import {
  StyledButtonNoWrapContainer,
  StyledDragDropOverlay,
  StyledDragDropText,
  StyledFileDropzoneSection,
} from "./styled-components"
import { getAccept } from "./utils"

export interface Props {
  disabled: boolean
  onDrop: (acceptedFiles: File[], rejectedFiles: FileRejection[]) => void
  multiple: boolean
  acceptedTypes: string[]
  maxSizeBytes: number
  label: string
  acceptDirectory?: boolean
  uploadedFiles?: React.ReactNode
  hasFiles?: boolean
}

const FileDropzone = ({
  onDrop,
  multiple,
  acceptedTypes,
  maxSizeBytes,
  disabled,
  label,
  acceptDirectory = false,
  uploadedFiles,
  hasFiles = false,
}: Props): React.ReactElement => (
  <Dropzone
    onDrop={onDrop}
    multiple={multiple}
    accept={getAccept(acceptedTypes)}
    maxSize={maxSizeBytes}
    disabled={disabled}
    // react-dropzone v12+ uses the File System Access API by default,
    // causing the bug described in https://github.com/streamlit/streamlit/issues/6176.
    useFsAccessApi={false}
  >
    {({ getRootProps, getInputProps, isDragActive }) => {
      const inputProps: DropzoneInputProps = getInputProps({
        multiple: multiple || !!acceptDirectory,
      })

      // react-dropzone v19.0.1+ hides the file input in-flow (display: block)
      // instead of using position: absolute. Since this input is a direct
      // child of the flex dropzone section (which uses `gap`), keeping it
      // in-flow adds an extra gap before the upload button and shifts the
      // layout. Pin it back to position: absolute so the hidden input stays
      // out of the flow and doesn't affect the dropzone layout.
      const inputStyle: React.CSSProperties = {
        ...inputProps.style,
        position: "absolute",
      }

      return (
        <StyledFileDropzoneSection
          {...getRootProps({ tabIndex: -1 })}
          data-testid="stFileUploaderDropzone"
          isDisabled={disabled}
          isDragActive={isDragActive}
          aria-label={label}
          aria-disabled={disabled}
        >
          <input
            data-testid="stFileUploaderDropzoneInput"
            {...inputProps}
            {...(acceptDirectory && { webkitdirectory: "" })}
            style={inputStyle}
          />
          {isDragActive && (
            <StyledDragDropOverlay>
              <StyledDragDropText>
                {acceptDirectory
                  ? "Drag and drop directories here"
                  : multiple
                    ? "Drag and drop files here"
                    : "Drag and drop a file here"}
              </StyledDragDropText>
            </StyledDragDropOverlay>
          )}
          {hasFiles && uploadedFiles ? (
            uploadedFiles
          ) : (
            <>
              <StyledButtonNoWrapContainer>
                <BaseButton
                  kind={BaseButtonKind.SECONDARY}
                  disabled={disabled}
                  size={BaseButtonSize.MEDIUM}
                >
                  <DynamicButtonLabel
                    icon=":material/upload:"
                    label={acceptDirectory ? "Upload directories" : "Upload"}
                  />
                </BaseButton>
              </StyledButtonNoWrapContainer>
              <FileDropzoneInstructions
                acceptedTypes={acceptedTypes}
                maxSizeBytes={maxSizeBytes}
                disabled={disabled}
              />
            </>
          )}
        </StyledFileDropzoneSection>
      )
    }}
  </Dropzone>
)

export default memo(FileDropzone)
