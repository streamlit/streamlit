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
import { ReactNode } from "react";
import { Props as ScriptChangedDialogProps } from "src/components/core/StreamlitDialog/ScriptChangedDialog";
import { IException } from "src/autogen/proto";
import { Props as SettingsDialogProps } from "./SettingsDialog";
import { Props as ThemeCreatorDialogProps } from "./ThemeCreatorDialog";
type PlainEventHandler = () => void;
interface SettingsProps extends SettingsDialogProps {
    type: DialogType.SETTINGS;
}
interface ScriptChangedProps extends ScriptChangedDialogProps {
    type: DialogType.SCRIPT_CHANGED;
}
interface ThemeCreatorProps extends ThemeCreatorDialogProps {
    type: DialogType.THEME_CREATOR;
}
export type DialogProps = AboutProps | ClearCacheProps | RerunScriptProps | SettingsProps | ScriptChangedProps | ScriptCompileErrorProps | ThemeCreatorProps | WarningProps | DeployErrorProps;
export declare enum DialogType {
    ABOUT = "about",
    CLEAR_CACHE = "clearCache",
    RERUN_SCRIPT = "rerunScript",
    SETTINGS = "settings",
    SCRIPT_CHANGED = "scriptChanged",
    SCRIPT_COMPILE_ERROR = "scriptCompileError",
    THEME_CREATOR = "themeCreator",
    WARNING = "warning",
    DEPLOY_ERROR = "deployError"
}
export declare function StreamlitDialog(dialogProps: DialogProps): ReactNode;
interface AboutProps {
    type: DialogType.ABOUT;
    /** Callback to close the dialog */
    onClose: PlainEventHandler;
    aboutSectionMd?: string | null;
}
interface ClearCacheProps {
    type: DialogType.CLEAR_CACHE;
    /** callback to send the clear_cache request to the Proxy */
    confirmCallback: () => void;
    /** callback to close the dialog */
    onClose: PlainEventHandler;
    /** callback to run the default action */
    defaultAction: () => void;
}
interface RerunScriptProps {
    type: DialogType.RERUN_SCRIPT;
    /** Callback to get the script's command line */
    getCommandLine: () => string | string[];
    /** Callback to set the script's command line */
    setCommandLine: (value: string) => void;
    /** Callback to rerun the script */
    rerunCallback: () => void;
    /** Callback to close the dialog */
    onClose: PlainEventHandler;
    /** Callback to run the default action */
    defaultAction: () => void;
}
interface ScriptCompileErrorProps {
    type: DialogType.SCRIPT_COMPILE_ERROR;
    exception: IException | null | undefined;
    onClose: PlainEventHandler;
}
interface WarningProps {
    type: DialogType.WARNING;
    title: string;
    msg: ReactNode;
    onClose: PlainEventHandler;
}
interface DeployErrorProps {
    type: DialogType.DEPLOY_ERROR;
    title: string;
    msg: ReactNode;
    onClose: PlainEventHandler;
    onContinue?: PlainEventHandler;
    onTryAgain: PlainEventHandler;
}
export {};
