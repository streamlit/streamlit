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
import { ConnectionState } from "src/lib/ConnectionState";
import { SessionEventDispatcher } from "src/lib/SessionEventDispatcher";
import { ScriptRunState } from "src/lib/ScriptRunState";
import { Theme } from "src/theme";
/** Component props */
export interface StatusWidgetProps {
    /** State of our connection to the server. */
    connectionState: ConnectionState;
    /** Dispatches transient SessionEvents received from the server. */
    sessionEventDispatcher: SessionEventDispatcher;
    /** script's current runstate */
    scriptRunState: ScriptRunState;
    /**
     * Function called when the user chooses to re-run a script in response to
     * its source file changing.
     *
     * @param alwaysRerun if true, also change the run-on-save setting for this
     * session
     */
    rerunScript: (alwaysRerun: boolean) => void;
    /** Function called when the user chooses to stop the running script. */
    stopScript: () => void;
    /** Allows users to change user settings to allow rerun on save */
    allowRunOnSave: boolean;
    theme: Theme;
}
declare const _default: React.FC<Pick<StatusWidgetProps, "scriptRunState" | "connectionState" | "sessionEventDispatcher" | "rerunScript" | "stopScript" | "allowRunOnSave"> & {
    theme?: import("@emotion/react").Theme | undefined;
}>;
export default _default;
