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
import React, { ReactElement } from "react";
import { IAppPage, PageConfig } from "src/autogen/proto";
import { Theme } from "src/theme";
export interface SidebarProps {
    chevronDownshift: number;
    children?: ReactElement;
    initialSidebarState?: PageConfig.SidebarState;
    theme: Theme;
    hasElements: boolean;
    appPages: IAppPage[];
    onPageChange: (pageName: string) => void;
    currentPageScriptHash: string;
    hideSidebarNav: boolean;
    pageLinkBaseUrl: string;
}
declare const _default: React.FC<Pick<SidebarProps, "children" | "chevronDownshift" | "appPages" | "currentPageScriptHash" | "onPageChange" | "pageLinkBaseUrl" | "initialSidebarState" | "hasElements" | "hideSidebarNav"> & {
    theme?: import("@emotion/react").Theme | undefined;
}>;
export default _default;
