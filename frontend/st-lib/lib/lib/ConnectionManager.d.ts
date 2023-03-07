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
import { BackMsg, ForwardMsg } from "src/autogen/proto";
import { IAllowedMessageOriginsResponse } from "src/hocs/withHostCommunication/types";
import { BaseUriParts } from "src/lib/UriUtil";
import { ConnectionState } from "./ConnectionState";
interface Props {
    /**
     * Function to be called when we receive a message from the server.
     */
    onMessage: (message: ForwardMsg) => void;
    /**
     * Function to be called when the connection errors out.
     */
    onConnectionError: (errNode: ReactNode) => void;
    /**
     * Called when our ConnectionState is changed.
     */
    connectionStateChanged: (connectionState: ConnectionState) => void;
    /**
     * Function to get the auth token set by the host of this app (if in a
     * relevant deployment scenario).
     */
    claimHostAuthToken: () => Promise<string | undefined>;
    /**
     * Function to clear the withHostCommunication hoc's auth token. This should
     * be called after the promise returned by claimHostAuthToken successfully
     * resolves.
     */
    resetHostAuthToken: () => void;
    /**
     * Function to set the list of origins that this app should accept
     * cross-origin messages from (if in a relevant deployment scenario).
     */
    setAllowedOriginsResp: (resp: IAllowedMessageOriginsResponse) => void;
}
/**
 * Manages our connection to the Server.
 */
export declare class ConnectionManager {
    private readonly props;
    private connection?;
    private connectionState;
    constructor(props: Props);
    /**
     * Indicates whether we're connected to the server.
     */
    isConnected(): boolean;
    /**
     * Return the BaseUriParts for the server we're connected to,
     * if we are connected to a server.
     */
    getBaseUriParts(): BaseUriParts | undefined;
    sendMessage(obj: BackMsg): void;
    /**
     * Increment the runCount on our message cache, and clear entries
     * whose age is greater than the max.
     */
    incrementMessageCacheRunCount(maxMessageAge: number): void;
    private connect;
    disconnect(): void;
    private setConnectionState;
    private showRetryError;
    private connectToRunningServer;
}
export {};
