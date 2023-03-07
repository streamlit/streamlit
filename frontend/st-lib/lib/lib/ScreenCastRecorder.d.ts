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
interface ScreenCastRecorderOptions {
    recordAudio: boolean;
    onErrorOrStop: () => void;
}
declare class ScreenCastRecorder {
    private readonly recordAudio;
    private inputStream;
    private recordedChunks;
    private mediaRecorder;
    private onErrorOrStopCallback;
    /** True if the current browser likely supports screencasts. */
    static isSupportedBrowser(): boolean;
    constructor({ recordAudio, onErrorOrStop }: ScreenCastRecorderOptions);
    /**
     * This asynchronous method will initialize the screen recording object asking
     * for permissions to the user which are needed to start recording.
     */
    initialize(): Promise<void>;
    getState(): string;
    /**
     * This method will start the screen recording if the user has granted permissions
     * and the mediaRecorder has been initialized
     *
     * @returns {boolean}
     */
    start(): boolean;
    /**
     * This method will stop recording and then return the generated Blob
     *
     * @returns {(Promise|undefined)}
     *  A Promise which will return the generated Blob
     *  Undefined if the MediaRecorder could not initialize
     */
    stop(): Promise<Blob> | undefined;
    private buildOutputBlob;
}
export default ScreenCastRecorder;
