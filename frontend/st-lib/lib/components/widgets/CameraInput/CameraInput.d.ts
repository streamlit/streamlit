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
import { CameraInput as CameraInputProto } from "src/autogen/proto";
import { FileUploadClient } from "src/lib/FileUploadClient";
import { WidgetStateManager } from "src/lib/WidgetStateManager";
import { UploadFileInfo } from "src/components/widgets/FileUploader/UploadFileInfo";
import { FacingMode } from "./SwitchFacingModeButton";
export interface Props {
    element: CameraInputProto;
    widgetMgr: WidgetStateManager;
    uploadClient: FileUploadClient;
    disabled: boolean;
    width: number;
}
type FileUploaderStatus = "ready" | "updating";
export interface State {
    /**
     * Base64-encoded image data of the current frame from the camera.
     */
    imgSrc: string | null;
    shutter: boolean;
    minShutterEffectPassed: boolean;
    /**
     * List of files (snapshots) captured by the user.
     * Should contain exact one element if the user has taken a snapshot.
     */
    files: UploadFileInfo[];
    /**
     * The most recent file ID we've received from the server. This gets sent
     * back to the server during widget update so that it clean up
     * orphaned files. File IDs start at 1 and only ever increase, so a
     * file with a higher ID is guaranteed to be newer than one with a lower ID.
     */
    newestServerFileId: number;
    /**
     * Represents whether the component is in clear photo mode,
     * when snapshot removed and new Webcam component is not shown yet.
     * Time interval between `Clear Photo` button clicked and access to Webcam received again
     */
    clearPhotoInProgress: boolean;
    /**
     * User facing mode for mobile devices. If `user`, the camera will be facing the user (front camera).
     * If `environment`, the camera will be facing the environment (back camera).
     */
    facingMode: FacingMode;
}
declare class CameraInput extends React.PureComponent<Props, State> {
    private localFileIdCounter;
    private RESTORED_FROM_WIDGET_STRING;
    private readonly formClearHelper;
    constructor(props: Props);
    private getProgress;
    private setClearPhotoInProgress;
    private setFacingMode;
    private handleCapture;
    private removeCapture;
    get initialValue(): State;
    componentWillUnmount(): void;
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
     * If we're part of a clear_on_submit form, this will be called when our
     * form is submitted. Restore our default value and update the WidgetManager.
     */
    private onFormCleared;
    render(): React.ReactNode;
    private nextLocalFileId;
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
    /** Remove the file with the given ID from `state.files`. */
    private removeFile;
    /**
     * Return the file with the given ID, if one exists.
     */
    private getFile;
    /** Replace the file with the given id in `state.files`. */
    private updateFile;
    /**
     * Called when an upload has completed. Updates the file's status, and
     * assigns it the new file ID returned from the server.
     */
    private onUploadComplete;
    /**
     * Callback for file upload progress. Updates a single file's local `progress`
     * state.
     */
    private onUploadProgress;
    /**
     * Clear files and errors, and reset the widget to its READY state.
     */
    private reset;
    uploadFile: (file: File) => void;
}
export default CameraInput;
