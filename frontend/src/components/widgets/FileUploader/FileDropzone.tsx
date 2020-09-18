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

import React from "react"
import Dropzone, { FileRejection } from "react-dropzone"
import { MaterialIcon } from "components/shared/Icon"
import { styled } from "styletron-react"

import { ExtendedFile, getSizeDisplay } from "lib/FileHelper"
import { colors, sizes, spacingCalculator, variables } from "lib/widgetTheme"

import UIButton from "components/widgets/Button/UIButton"
import { FlexColumn } from "components/shared/Layouts"
import { Small } from "components/shared/TextElements"

export interface Props {
  disabled: boolean
  onDrop: (
    acceptedFiles: ExtendedFile[],
    rejectedFiles: FileRejection[]
  ) => void
  multiple: boolean
  acceptedExtensions: string[]
  maxSizeBytes: number
}

const StyledDropzoneSection = styled("section", {
  ":focus": {
    outline: "none",
    boxShadow: `0 0 0 1px ${colors.primary}`,
  },
  padding: variables.spacer,
  paddingRight: spacingCalculator(2),
  backgroundColor: colors.grayLightest,
  borderRadius: variables.borderRadius,
  alignItems: "center",
  display: "flex",
})

const StyledInstructions = styled("div", {
  marginRight: "auto",
  alignItems: "center",
  display: "flex",
})

const FileUploaderIcon = styled(MaterialIcon, {
  color: colors.secondary,
  marginRight: spacingCalculator(),
})

const FileDropzone = ({
  onDrop,
  multiple,
  acceptedExtensions,
  maxSizeBytes,
  disabled,
}: Props) => (
  <Dropzone
    onDrop={onDrop}
    multiple={multiple}
    accept={
      acceptedExtensions.length
        ? acceptedExtensions.map((value: string): string => `.${value}`)
        : undefined
    }
    maxSize={maxSizeBytes}
    disabled={disabled}
  >
    {({ getRootProps, getInputProps }) => (
      <StyledDropzoneSection
        {...getRootProps()}
        className={`fileUploadDropzone ${disabled ? "disabled" : ""}`}
      >
        <input {...getInputProps()} />
        <StyledInstructions>
          <FileUploaderIcon
            icon="cloud_upload"
            type="outlined"
            size={sizes.large}
            className="fileUploaderIcon"
          />
          <FlexColumn>
            <span>Drag and drop file{multiple ? "s" : ""} here</span>
            <Small>
              {`Limit ${getSizeDisplay(maxSizeBytes, "b", 0)} per file`}
              {acceptedExtensions.length
                ? ` • ${acceptedExtensions
                    .join(", ")
                    .replace(".", "")
                    .toUpperCase()}`
                : null}
            </Small>
          </FlexColumn>
        </StyledInstructions>
        <UIButton label="Browse files" disabled={disabled} />
      </StyledDropzoneSection>
    )}
  </Dropzone>
)

export default FileDropzone
