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
import { NewSession } from "src/autogen/proto";
export interface Args {
    appId: string;
    sessionId: string;
    streamlitVersion: string;
    pythonVersion: string;
    installationId: string;
    installationIdV3: string;
    authorEmail: string;
    maxCachedMessageAge: number;
    commandLine: string;
    userMapboxToken: string;
}
export declare class SessionInfo {
    readonly appId: string;
    readonly sessionId: string;
    readonly streamlitVersion: string;
    readonly pythonVersion: string;
    readonly installationId: string;
    readonly installationIdV3: string;
    readonly authorEmail: string;
    readonly maxCachedMessageAge: number;
    readonly commandLine: string;
    /**
     * The user-supplied mapbox token. By default, this will be the empty string,
     * which indicates that we should fetch Streamlit's mapbox token and use
     * that instead. Do not use this value directly; use `MapboxToken.get()`
     * instead.
     */
    readonly userMapboxToken: string;
    /**
     * Singleton SessionInfo object. The reasons we're using a singleton here
     * instead of just exporting a module-level instance are:
     * - So we can easily override it in tests.
     * - So we throw a loud error when some code tries to use it before it's
     *   initialized.
     */
    private static singleton?;
    /**
     * Our last SessionInfo singleton if there is no currently active session, or
     * undefined if there is one.
     */
    static lastSessionInfo?: SessionInfo;
    static get current(): SessionInfo;
    static set current(sm: SessionInfo);
    static isSet(): boolean;
    static get isHello(): boolean;
    static clearSession(): void;
    /** Create a SessionInfo from the relevant bits of an initialize message. */
    static fromNewSessionMessage(newSession: NewSession): SessionInfo;
    constructor({ appId, sessionId, streamlitVersion, pythonVersion, installationId, installationIdV3, authorEmail, maxCachedMessageAge, commandLine, userMapboxToken, }: Args);
}
