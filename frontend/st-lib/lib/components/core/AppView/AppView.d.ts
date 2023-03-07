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
import { ReactElement } from "react";
import { IAppPage } from "src/autogen/proto";
import { ScriptRunState } from "src/lib/ScriptRunState";
import { FormsData, WidgetStateManager } from "src/lib/WidgetStateManager";
import { FileUploadClient } from "src/lib/FileUploadClient";
import { ComponentRegistry } from "src/components/widgets/CustomComponent";
import { AppRoot } from "src/lib/AppNode";
export interface AppViewProps {
    elements: AppRoot;
    scriptRunId: string;
    scriptRunState: ScriptRunState;
    widgetMgr: WidgetStateManager;
    uploadClient: FileUploadClient;
    widgetsDisabled: boolean;
    componentRegistry: ComponentRegistry;
    formsData: FormsData;
    appPages: IAppPage[];
    onPageChange: (pageName: string) => void;
    currentPageScriptHash: string;
    hideSidebarNav: boolean;
    pageLinkBaseUrl: string;
}
/**
 * Renders a Streamlit app.
 */
declare function AppView(props: AppViewProps): ReactElement;
export default AppView;
