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

export const TOKENS_URL = "https://streamlit.io/tokens.json"

/**
 * Exposes a singleton MapboxToken. If the user has specified
 * their own
 */
export class MapboxToken {
  private static token?: string

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
    const rsp = await fetch(url)
    if (!rsp.ok) {
      throw new Error(`${url}: Bad status ${rsp.status}`)
    }

    const json = await rsp.json()
    const token = json[tokenName]
    if (token == null || token === "") {
      throw new Error(`${url}: Missing token "${tokenName}"`)
    }

    return token
  }
}
