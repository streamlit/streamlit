/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import axios from "axios"
import { SessionInfo } from "lib/SessionInfo"

/**
 * A remote file that stores user-visible tokens.
 */
export const TOKENS_URL = "https://data.streamlit.io/tokens.json"

export class MapboxToken {
  private static token?: string

  private static isItRunningLocal = (): boolean => {
    const { hostname } = window.location

    return hostname === "localhost" || hostname === "127.0.0.1"
  }

  /**
   * Expose a singleton MapboxToken:
   * - If the user specified a token in their streamlit config, return it.
   * - Else, fetch the remote "tokens.json" and return the "mapbox" entry.
   *
   * (The returned value is cached in memory, so the remote resource will
   * only be fetched once per session.)
   */
  public static async get(): Promise<string> {
    if (!MapboxToken.token) {
      if (SessionInfo.current.userMapboxToken !== "") {
        MapboxToken.token = SessionInfo.current.userMapboxToken
      } else {
        const { commandLine } = SessionInfo.current

        if (
          this.isItRunningLocal() &&
          commandLine.toLowerCase() === "streamlit hello"
        ) {
          MapboxToken.token = await this.fetchToken(TOKENS_URL, "mapbox")
        } else {
          throw new Error(
            `
            To use this you'll need a Mapbox access token. Please add it to your config.
            
            To get a token for yourself, create an account at
            <a href="https://mapbox.com">https://mapbox.com</a>. It's free! (for moderate usage levels) See
            <a href="https://docs.streamlit.io/cli.html#view-all-config-options">our documentation</a> for more
            info on how to set config options.
            `
          )
        }
      }
    }

    return MapboxToken.token
  }

  private static async fetchToken(
    url: string,
    tokenName: string
  ): Promise<string> {
    try {
      const response = await axios.get(url)
      const { "mapbox-localhost": token } = response.data

      if (token == null || token === "") {
        throw new Error(`Missing token "${tokenName}"`)
      }

      return token
    } catch (e) {
      throw new Error(`${e.message} (${url})`)
    }
  }
}
