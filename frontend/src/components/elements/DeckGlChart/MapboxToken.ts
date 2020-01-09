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

import { SessionInfo } from "lib/SessionInfo"

/**
 * A remote file that stores user-visible tokens.
 */
export const TOKENS_URL = "https://data.streamlit.io/tokens.json"

export class MapboxToken {
  private static token?: string

  /**
   * Expose a singleton MapboxToken:
   * - If the user specified a token in their streamlit config, return it.
   * - Else, fetch the remote "tokens.json" and return the "mapbox" entry.
   *
   * (The returned value is cached in memory, so the remote resource will
   * only be fetched once per session.)
   */
  public static async get(): Promise<string> {
    if (MapboxToken.token == null) {
      if (SessionInfo.current.userMapboxToken !== "") {
        MapboxToken.token = SessionInfo.current.userMapboxToken
      } else {
        MapboxToken.token = await this.fetchToken(TOKENS_URL, "mapbox")
      }
    }

    return MapboxToken.token
  }

  private static async fetchToken(
    url: string,
    tokenName: string
  ): Promise<string> {
    let rsp: Response
    try {
      rsp = await fetch(url)
    } catch (e) {
      // Fetch error messages are abysmal, and give virtually no useful
      // context. Catch errors and append the offending URL to their messages
      // to make them a bit more useful.
      throw new Error(`${e.message} (${url})`)
    }

    if (!rsp.ok) {
      throw new Error(`Bad status: ${rsp.status} (${url})`)
    }

    const json = await rsp.json()
    const token = json[tokenName]
    if (token == null || token === "") {
      throw new Error(`Missing token "${tokenName}" (${url})`)
    }

    return token
  }
}
