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
import { IBackMsg } from "src/autogen/proto";
import { IAllowedMessageOriginsResponse } from "src/hocs/withHostCommunication/types";
import { ConnectionState } from "src/lib/ConnectionState";
import { BaseUriParts } from "src/lib/UriUtil";
import React from "react";
/**
 * If the ping retrieves a 403 status code a message will be displayed.
 * This constant is the link to the documentation.
 */
export declare const CORS_ERROR_MESSAGE_DOCUMENTATION_LINK = "https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS";
type OnMessage = (ForwardMsg: any) => void;
type OnConnectionStateChange = (connectionState: ConnectionState, errMsg?: string) => void;
type OnRetry = (totalTries: number, errorNode: React.ReactNode, retryTimeout: number) => void;
interface Args {
    /**
     * List of URLs to connect to. We'll try the first, then the second, etc. If
     * all fail, we'll retry from the top. The number of retries depends on
     * whether this is a local connection.
     */
    baseUriPartsList: BaseUriParts[];
    /**
     * Function called when our ConnectionState changes.
     * If the new ConnectionState is ERROR, errMsg will be defined.
     */
    onConnectionStateChange: OnConnectionStateChange;
    /**
     * Function called every time we ping the server for sign of life.
     */
    onRetry: OnRetry;
    /**
     * Function called when we receive a new message.
     */
    onMessage: OnMessage;
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
 * This class connects to the server and gets deltas over a websocket connection.
 *
 */
export declare class WebsocketConnection {
    private readonly args;
    /**
     * ForwardMessages get passed through this cache. This gets initialized
     * once we connect to the server.
     */
    private readonly cache;
    /**
     * Index to the URI in uriList that we're going to try to connect to.
     */
    private uriIndex;
    /**
     * To guarantee packet transmission order, this is the index of the last
     * dispatched incoming message.
     */
    private lastDispatchedMessageIndex;
    /**
     * And this is the index of the next message we receive.
     */
    private nextMessageIndex;
    /**
     * This dictionary stores received messages that we haven't sent out yet
     * (because we're still decoding previous messages)
     */
    private readonly messageQueue;
    /**
     * The current state of this object's state machine.
     */
    private state;
    /**
     * The WebSocket object we're connecting with.
     */
    private websocket?;
    /**
     * WebSocket objects don't support retries, so we have to implement them
     * ourselves. We use setTimeout to wait for a connection and retry once the
     * timeout fire. This is the timer ID from setTimeout, so we can cancel it if
     * needed.
     */
    private wsConnectionTimeoutId?;
    constructor(props: Args);
    /**
     * Return the BaseUriParts for the server we're connected to,
     * if we are connected to a server.
     */
    getBaseUriParts(): BaseUriParts | undefined;
    disconnect(): void;
    private setFsmState;
    /**
     * Process an event in our FSM.
     *
     * @param event The event to process.
     * @param errMsg an optional error message to send to the OnStateChanged
     * callback. This is meaningful only for the FATAL_ERROR event. The message
     * will be displayed to the user in a "Connection Error" dialog.
     */
    private stepFsm;
    private pingServer;
    /**
     * Get the session token to use to initialize a WebSocket connection.
     *
     * There are two scenarios that are considered here:
     *   1. If this Streamlit is embedded in a page that will be passing an
     *      external, opaque auth token to it, we get it using claimHostAuthToken
     *      and return it. This only occurs in deployment environments where
     *      we're not connecting to the usual Tornado server, so we don't have to
     *      worry about what this token actually is/does.
     *   2. Otherwise, claimHostAuthToken will resolve immediately to undefined,
     *      in which case we return the sessionId of the last session this
     *      browser tab connected to (or undefined if this is the first time this
     *      tab has connected to the Streamlit server). This sessionId is used to
     *      attempt to reconnect to an existing session to handle transient
     *      disconnects.
     */
    private getSessionToken;
    private connectToWebSocket;
    private setConnectionTimeout;
    private closeConnection;
    /**
     * Encodes the message with the outgoingMessageType and sends it over the
     * wire.
     */
    sendMessage(obj: IBackMsg): void;
    /**
     * Called when our script has finished running. Calls through
     * to the ForwardMsgCache, to handle cached entry expiry.
     */
    incrementMessageCacheRunCount(maxMessageAge: number): void;
    private handleMessage;
}
export declare const StyledBashCode: import("@emotion/styled").StyledComponent<{
    theme?: import("@emotion/react").Theme | undefined;
    as?: React.ElementType<any> | undefined;
}, React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>, {}>;
/**
 * Attempts to connect to the URIs in uriList (in round-robin fashion) and
 * retries forever until one of the URIs responds with 'ok'.
 * Returns a promise with the index of the URI that worked.
 */
export declare function doInitPings(uriPartsList: BaseUriParts[], minimumTimeoutMs: number, maximumTimeoutMs: number, retryCallback: OnRetry, setAllowedOriginsResp: (resp: IAllowedMessageOriginsResponse) => void, userCommandLine?: string): Promise<number>;
export {};
