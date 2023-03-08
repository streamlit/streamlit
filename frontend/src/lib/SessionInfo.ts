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

/**
 * SessionInfo properties. These don't change during the lifetime of a session.
 */
export interface Props {
  readonly appId: string
  readonly sessionId: string
  readonly streamlitVersion: string
  readonly pythonVersion: string
  readonly installationId: string
  readonly installationIdV3: string
  readonly authorEmail: string
  readonly maxCachedMessageAge: number
  readonly commandLine: string

  /**
   * The user-supplied mapbox token. By default, this will be the empty string,
   * which indicates that we should fetch Streamlit's mapbox token and use
   * that instead. Do not use this value directly; use `MapboxToken.get()`
   * instead.
   */
  readonly userMapboxToken: string
}

export class SessionInfo {
  /** Our current SessionInfo properties.*/
  private _current?: Props

  /**
   * Our last SessionInfo props if there is no currently active session, or
   * undefined if there is one.
   */
  private _last?: Props

  /** Return the current SessionInfo props. Throw an error if the props are undefined. */
  public get current(): Props {
    if (!this._current) {
      throw new Error("Tried to use SessionInfo before it was initialized")
    }
    return this._current
  }

  /** Return the previous SessionInfo props. They may be undefined! */
  public get last(): Props | undefined {
    return this._last
  }

  /**
   * Initialize `SessionInfo.current` with the given props, and copy its
   * previous props to `SessionInfo.last`.
   */
  public setCurrent(props?: Props): void {
    this._last = this._current != null ? { ...this._current } : undefined
    this._current = props != null ? { ...props } : undefined
  }

  /** True if `SessionInfo.current` exists. */
  public get isSet(): boolean {
    return this._current != null
  }

  /** True if `SessionInfo.current` refers to a "streamlit hello" session. */
  public get isHello(): boolean {
    return (
      this._current != null && this._current.commandLine === "streamlit hello"
    )
  }

  /** Create SessionInfo Props from the relevant bits of an initialize message. */
  public static propsFromNewSessionMessage(newSession: NewSession): Props {
    const initialize = newSession.initialize as Initialize
    const config = newSession.config as Config
    const userInfo = initialize.userInfo as UserInfo
    const environmentInfo = initialize.environmentInfo as EnvironmentInfo

    return {
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
    }
  }
}
