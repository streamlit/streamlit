/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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
import React from "react";
import { UploadFileInfo } from "./UploadFileInfo";
export interface Props {
    fileInfo: UploadFileInfo;
    onDelete: (id: number) => void;
}
export interface UploadedFileStatusProps {
    fileInfo: UploadFileInfo;
}
export declare const UploadedFileStatus: ({ fileInfo, }: UploadedFileStatusProps) => React.ReactElement | null;
declare const UploadedFile: ({ fileInfo, onDelete }: Props) => React.ReactElement;
export default UploadedFile;
