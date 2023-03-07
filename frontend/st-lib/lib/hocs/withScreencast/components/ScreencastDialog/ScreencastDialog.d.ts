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
import { ChangeEvent, PureComponent, ReactNode } from "react";
export interface Props {
    /** Callback to close the dialog */
    onClose: () => void;
    toggleRecordAudio: () => void;
    recordAudio: boolean;
    startRecording: () => void;
}
interface State {
    recordAudio: boolean;
}
/**
 * A dialog that allows a screencast to be configured and recorded.
 */
declare class ScreencastDialog extends PureComponent<Props, State> {
    state: {
        recordAudio: boolean;
    };
    handleRecordAudioCheckbox: (e: ChangeEvent<HTMLInputElement>) => void;
    handleStartButton: () => void;
    render(): ReactNode;
}
export default ScreencastDialog;
