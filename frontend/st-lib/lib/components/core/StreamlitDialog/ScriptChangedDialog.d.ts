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
import { PureComponent, ReactNode } from "react";
export interface Props {
    /** Called to close the dialog without rerunning the script. */
    onClose: () => void;
    /**
     * Called when the user chooses to re-run the current script in response to
     * its source file changing.
     * @param alwaysRerun if true, also change the run-on-save setting for this
     * session.
     */
    onRerun: (alwaysRerun: boolean) => void;
    allowRunOnSave: boolean;
}
export declare class ScriptChangedDialog extends PureComponent<Props> {
    private readonly keyHandlers;
    constructor(props: Props);
    render(): ReactNode;
    private rerun;
    private alwaysRerun;
}
