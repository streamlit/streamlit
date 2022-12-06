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

import {
  Config,
  EnvironmentInfo,
  Initialize,
  NewSession,
  UserInfo,
} from "src/autogen/proto"

import { hashString } from "src/lib/utils"

export interface Args {
  appId: string
  sessionId: string
  streamlitVersion: string
  pythonVersion: string
  installationId: string
  installationIdV3: string
  authorEmail: string
  maxCachedMessageAge: number
  commandLine: string
  userMapboxToken: string
}

export class SessionInfo {
  // Fields that don't change during the lifetime of a session (i.e. a browser tab).
  public readonly appId: string

  public readonly streamlitVersion: string

  public readonly pythonVersion: string

  public readonly installationId: string

  public readonly installationIdV3: string

  public readonly authorEmail: string

  public readonly maxCachedMessageAge: number

  public readonly commandLine: string

  /**
   * The user-supplied mapbox token. By default, this will be the empty string,
   * which indicates that we should fetch Streamlit's mapbox token and use
   * that instead. Do not use this value directly; use `MapboxToken.get()`
   * instead.
   */
  public readonly userMapboxToken: string

  /**
   * Singleton SessionInfo object. The reasons we're using a singleton here
   * instead of just exporting a module-level instance are:
   * - So we can easily override it in tests.
   * - So we throw a loud error when some code tries to use it before it's
   *   initialized.
   */
  private static singleton?: SessionInfo

  private static sessionId?: string

  /**
   * Return the sessionId of the last connected session, or undefined if a
   * session is currently connected.
   */
  public static get lastSessionId(): string | undefined {
    return SessionInfo.isSet() ? undefined : SessionInfo.sessionId
  }

  /**
   * Return the sessionId of the currently connected session.
   */
  // eslint-disable-next-line class-methods-use-this
  public get sessionId(): string {
    // We're guaranteed that SessionInfo._sessionId is set to the current
    // session's ID here since there can be at most one SessionInfo object that
    // exists at one time.

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return SessionInfo.sessionId!
  }

  public static get current(): SessionInfo {
    if (!SessionInfo.singleton) {
      throw new Error("Tried to use SessionInfo before it was initialized")
    }
    return SessionInfo.singleton
  }

  public static set current(sm: SessionInfo) {
    SessionInfo.singleton = sm
  }

  public static isSet(): boolean {
    return SessionInfo.singleton != null
  }

  public static get isHello(): boolean {
    return this.current.commandLine === "streamlit hello"
  }

  public static clearSession(): void {
    SessionInfo.singleton = undefined
  }

  /** Create a SessionInfo from the relevant bits of an initialize message. */
  public static fromNewSessionMessage(newSession: NewSession): SessionInfo {
    const initialize = newSession.initialize as Initialize
    const config = newSession.config as Config
    const userInfo = initialize.userInfo as UserInfo
    const environmentInfo = initialize.environmentInfo as EnvironmentInfo

    return new SessionInfo({
      appId: hashString(userInfo.installationIdV3 + newSession.mainScriptPath),
      sessionId: initialize.sessionId,
      streamlitVersion: environmentInfo.streamlitVersion,
      pythonVersion: environmentInfo.pythonVersion,
      installationId: userInfo.installationId,
      installationIdV3: userInfo.installationIdV3,
      authorEmail: userInfo.email,
      maxCachedMessageAge: config.maxCachedMessageAge,
      commandLine: initialize.commandLine,
      userMapboxToken: config.mapboxToken,
    })
  }

  public constructor({
    appId,
    sessionId,
    streamlitVersion,
    pythonVersion,
    installationId,
    installationIdV3,
    authorEmail,
    maxCachedMessageAge,
    commandLine,
    userMapboxToken,
  }: Args) {
    if (
      appId == null ||
      sessionId == null ||
      streamlitVersion == null ||
      pythonVersion == null ||
      installationId == null ||
      installationIdV3 == null ||
      authorEmail == null ||
      maxCachedMessageAge == null ||
      commandLine == null ||
      userMapboxToken == null
    ) {
      throw new Error("SessionInfo arguments must be non-null")
    }

    SessionInfo.sessionId = sessionId

    this.appId = appId
    this.streamlitVersion = streamlitVersion
    this.pythonVersion = pythonVersion
    this.installationId = installationId
    this.installationIdV3 = installationIdV3
    this.authorEmail = authorEmail
    this.maxCachedMessageAge = maxCachedMessageAge
    this.commandLine = commandLine
    this.userMapboxToken = userMapboxToken
  }
}
