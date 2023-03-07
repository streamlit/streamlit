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
import React, { PureComponent, ReactNode } from "react";
import { Props as AppContextProps } from "src/components/core/AppContext";
import { UserSettings } from "./UserSettings";
export interface Props {
    isServerConnected: boolean;
    onClose: () => void;
    onSave: (settings: UserSettings) => void;
    settings: UserSettings;
    allowRunOnSave: boolean;
    developerMode: boolean;
    openThemeCreator: () => void;
    animateModal: boolean;
}
/**
 * Implements a dialog that is used to configure user settings.
 */
export declare class SettingsDialog extends PureComponent<Props, UserSettings> {
    private activeSettings;
    static contextType: React.Context<AppContextProps>;
    constructor(props: Props);
    private renderThemeCreatorButton;
    render(): ReactNode;
    componentDidMount(): void;
    private changeSingleSetting;
    private handleCheckboxChange;
    private handleThemeChange;
    private handleCancelButtonClick;
    private saveSettings;
}
