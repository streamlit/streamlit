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
import { FileUploader as FileUploaderProto } from "src/autogen/proto";
import { FileUploadClient } from "src/lib/FileUploadClient";
import { WidgetStateManager } from "src/lib/WidgetStateManager";
import { UploadFileInfo } from "./UploadFileInfo";
export interface Props {
    disabled: boolean;
    element: FileUploaderProto;
    widgetMgr: WidgetStateManager;
    uploadClient: FileUploadClient;
    width: number;
}
type FileUploaderStatus = "ready" | "updating";
export interface State {
    /**
     * List of files dropped on the FileUploader by the user. This list includes
     * rejected files that will not be updated.
     */
    files: UploadFileInfo[];
    /**
     * The most recent file ID we've received from the server. This gets sent
     * back to the server during widget update so that it clean up
     * orphaned files. File IDs start at 1 and only ever increase, so a
     * file with a higher ID is guaranteed to be newer than one with a lower ID.
     */
    newestServerFileId: number;
}
declare class FileUploader extends React.PureComponent<Props, State> {
    private readonly formClearHelper;
    /**
     * A counter for assigning unique internal IDs to each file tracked
     * by the uploader. These IDs are used to update file state internally,
     * and are separate from the serverFileIds that are returned by the server.
     */
    private localFileIdCounter;
    constructor(props: Props);
    get initialValue(): State;
    componentWillUnmount(): void;
    /**
     * Return this.props.element.maxUploadSizeMb, converted to bytes.
     */
    private get maxUploadSizeInBytes();
    /**
     * Return the FileUploader's current status, which is derived from
     * its state.
     */
    get status(): FileUploaderStatus;
    componentDidUpdate: (prevProps: Props) => void;
    /**
     * When the server receives the widget value, it deletes "orphaned" uploaded
     * files. An orphaned file is any file, associated with this uploader,
     * whose file ID is not in the file ID list, and whose
     * ID is <= `newestServerFileId`. This logic ensures that a FileUploader
     * within a form doesn't have any of its "unsubmitted" uploads prematurely
     * deleted when the script is re-run.
     */
    private createWidgetValue;
    /**
     * Clear files and errors, and reset the widget to its READY state.
     */
    private reset;
    /**
     * Called by react-dropzone when files and drag-and-dropped onto the widget.
     *
     * @param acceptedFiles an array of files.
     * @param rejectedFiles an array of FileRejections. A FileRejection
     * encapsulates a File and an error indicating why it was rejected by
     * the dropzone widget.
     */
    private dropHandler;
    uploadFile: (file: File) => void;
    /**
     * Called when an upload has completed. Updates the file's status, and
     * assigns it the new file ID returned from the server.
     */
    private onUploadComplete;
    /**
     * Return a human-readable message for the given error.
     */
    private getErrorMessage;
    /**
     * Delete the file with the given ID:
     * - Cancel the file upload if it's in progress
     * - Remove the fileID from our local state
     * We don't actually tell the server to delete the file. It will garbage
     * collect it.
     */
    deleteFile: (fileId: number) => void;
    /** Append the given file to `state.files`. */
    private addFile;
    /** Append the given files to `state.files`. */
    private addFiles;
    /** Remove the file with the given ID from `state.files`. */
    private removeFile;
    /**
     * Return the file with the given ID, if one exists.
     */
    private getFile;
    /** Replace the file with the given id in `state.files`. */
    private updateFile;
    /**
     * Callback for file upload progress. Updates a single file's local `progress`
     * state.
     */
    private onUploadProgress;
    /**
     * If we're part of a clear_on_submit form, this will be called when our
     * form is submitted. Restore our default value and update the WidgetManager.
     */
    private onFormCleared;
    render(): React.ReactNode;
    private nextLocalFileId;
}
export default FileUploader;
