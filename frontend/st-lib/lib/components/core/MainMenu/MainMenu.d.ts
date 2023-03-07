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
import React, { MouseEvent, ReactElement, ReactNode } from "react";
import { IGuestToHostMessage, IMenuItem } from "src/hocs/withHostCommunication/types";
import { IGitInfo, PageConfig } from "src/autogen/proto";
export interface Props {
    /** True if we're connected to the Streamlit server. */
    isServerConnected: boolean;
    /** Rerun the current script. */
    quickRerunCallback: () => void;
    /** Reload git information message */
    loadGitInfo: () => void;
    /** Clear the cache. */
    clearCacheCallback: () => void;
    /** Show the screen recording dialog. */
    screencastCallback: () => void;
    /** Show the Settings dialog. */
    settingsCallback: () => void;
    /** Show the About dialog. */
    aboutCallback: () => void;
    /** Open the Print Dialog, if the app is in iFrame first open a new tab with app URL */
    printCallback: () => void;
    screenCastState: string;
    hostMenuItems: IMenuItem[];
    sendMessageToHost: (message: IGuestToHostMessage) => void;
    gitInfo: IGitInfo | null;
    showDeployError: (title: string, errorNode: ReactNode, onContinue?: () => void) => void;
    closeDialog: () => void;
    isDeployErrorModalOpen: boolean;
    canDeploy: boolean;
    menuItems?: PageConfig.IMenuItems | null;
    hostIsOwner?: boolean;
}
export declare const isLocalhost: () => boolean;
export interface MenuItemProps {
    item: any;
    "aria-selected": boolean;
    onClick: (e: MouseEvent<HTMLLIElement>) => void;
    onMouseEnter: (e: MouseEvent<HTMLLIElement>) => void;
    $disabled: boolean;
    $isHighlighted: boolean;
}
export interface SubMenuProps {
    menuItems: any[];
    closeMenu: () => void;
    isDevMenu: boolean;
}
declare function MainMenu(props: Props): ReactElement;
declare const _default: React.MemoExoticComponent<typeof MainMenu>;
export default _default;
