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
import { ComponentType } from "react";
import { IAllowedMessageOriginsResponse, IGuestToHostMessage, HostCommunicationState } from "./types";
export interface HostCommunicationHOC {
    currentState: HostCommunicationState;
    /**
     * Callback to be called when the Streamlit app closes a dialog.
     */
    onModalReset: () => void;
    /**
     * Callback to be called when the Streamlit app's page is changed.
     */
    onPageChanged: () => void;
    /**
     * Function to reset authTokenPromise once the resource waiting on the token
     * (that is, the WebsocketConnection singleton) has successfully received it.
     *
     * This should be called in a .then() handler attached to authTokenPromise.
     */
    resetAuthToken: () => void;
    /**
     * Function to send a message to the app's parent frame via the browser's
     * window.postMessage API.
     */
    sendMessage: (message: IGuestToHostMessage) => void;
    /**
     * Function to set the response body received from hitting the Streamlit
     * server's /st-allowed-message-origins endpoint. The response contains
     *   - allowedOrigins: A list of origins that we're allowed to receive
     *     cross-iframe messages from via the browser's window.postMessage API.
     *   - useExternalAuthToken: Whether to wait until we've received a
     *     SET_AUTH_TOKEN message before resolving authTokenPromise. The
     *     WebsocketConnection class waits for this promise to resolve before
     *     attempting to establish a connection with the Streamlit server.
     */
    setAllowedOriginsResp: (resp: IAllowedMessageOriginsResponse) => void;
}
export declare const HOST_COMM_VERSION = 1;
export declare function sendMessageToHost(message: IGuestToHostMessage): void;
declare function withHostCommunication(WrappedComponent: ComponentType<any>): ComponentType<any>;
export default withHostCommunication;
