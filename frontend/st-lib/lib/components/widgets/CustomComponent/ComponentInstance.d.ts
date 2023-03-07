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
import { ComponentInstance as ComponentInstanceProto } from "src/autogen/proto";
import { WidgetStateManager } from "src/lib/WidgetStateManager";
import React, { ReactNode } from "react";
import { Theme } from "src/theme";
import { ComponentRegistry } from "./ComponentRegistry";
/**
 * The current custom component API version. If our API changes,
 * this value must be incremented. ComponentInstances send their API
 * version in the COMPONENT_READY call.
 */
export declare const CUSTOM_COMPONENT_API_VERSION = 1;
/**
 * If we haven't received a COMPONENT_READY message this many seconds
 * after the component has been created, explain to the user that there
 * may be a problem with their component, and offer troubleshooting advice.
 */
export declare const COMPONENT_READY_WARNING_TIME_MS = 3000;
export interface Props {
    registry: ComponentRegistry;
    widgetMgr: WidgetStateManager;
    disabled: boolean;
    element: ComponentInstanceProto;
    width: number;
    theme: Theme;
}
export interface State {
    componentError?: Error;
    readyTimeout: boolean;
}
export declare class ComponentInstance extends React.PureComponent<Props, State> {
    private readonly iframeRef;
    private componentReady;
    private curArgs;
    private curDataframeArgs;
    private frameHeight;
    private contentWindow?;
    private readonly componentReadyWarningTimer;
    constructor(props: Props);
    componentDidMount: () => void;
    componentWillUnmount: () => void;
    componentDidUpdate: () => void;
    /**
     * Return our iframe's contentWindow.
     * (This is implemented as a function so that we can mock it in a test.)
     */
    private getIFrameContentWindow;
    /**
     * Register our iframe's contentWindow with our ComponentRegistry, if it's
     * non-null and not already registered.
     */
    private maybeRegisterIFrameListener;
    /** De-register our contentWindow listener, if we've registered one. */
    private deregisterIFrameListener;
    /**
     * Receive a ComponentBackMsg from our component iframe.
     */
    private onBackMsg;
    /** The component set a new value. Send it back to Streamlit. */
    private handleSetComponentValue;
    /** The component has a new height. Resize its iframe. */
    private handleSetFrameHeight;
    /** Send a message to the component through its iframe. */
    private sendForwardMsg;
    /**
     * Send a RENDER message to the component with the most recent arguments
     * received from Python.
     */
    private sendRenderMessage;
    private renderError;
    private renderComponentReadyTimeoutWarning;
    render(): ReactNode;
}
declare const _default: React.FC<Pick<Props, "disabled" | "width" | "element" | "widgetMgr" | "registry"> & {
    theme?: import("@emotion/react").Theme | undefined;
}>;
export default _default;
