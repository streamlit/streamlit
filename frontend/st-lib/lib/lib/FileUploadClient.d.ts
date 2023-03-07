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
import { CancelToken } from "axios";
import HttpClient from "src/lib/HttpClient";
import { BaseUriParts } from "./UriUtil";
/** Common widget protobuf fields that are used by the FileUploadClient. */
interface WidgetInfo {
    id: string;
    formId: string;
}
interface Props {
    getServerUri: () => BaseUriParts | undefined;
    csrfEnabled: boolean;
    formsWithPendingRequestsChanged: (formIds: Set<string>) => void;
}
/**
 * Handles uploading files to the server.
 */
export declare class FileUploadClient extends HttpClient {
    /**
     * Map of <formId: number of outstanding requests>. Updated whenever
     * a widget in a form creates are completes a request.
     */
    private readonly formsWithPendingRequests;
    /**
     * Called when the set of forms that have pending file requests changes.
     */
    private readonly pendingFormUploadsChanged;
    constructor(props: Props);
    /**
     * Upload a file to the server. It will be associated with this browser's sessionID.
     *
     * @param widget: the FileUploader widget that's doing the upload.
     * @param file: the files to upload.
     * @param onUploadProgress: an optional function that will be called repeatedly with progress events during the upload.
     * @param cancelToken: an optional axios CancelToken that can be used to cancel the in-progress upload.
     *
     * @return a Promise<number> that resolves with the file's unique ID, as assigned by the server.
     */
    uploadFile(widget: WidgetInfo, file: File, onUploadProgress?: (progressEvent: any) => void, cancelToken?: CancelToken): Promise<number>;
    private getFormIdSet;
    private offsetPendingRequestCount;
}
export {};
