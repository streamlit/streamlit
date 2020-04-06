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

import { BaseUriParts, buildHttpUri } from "lib/UriUtil"

/**
 * Downloads and compiles plugins from the server.
 */
export class PluginRegistry {
  private readonly getServerUri: () => BaseUriParts | undefined

  public constructor(getServerUri: () => BaseUriParts | undefined) {
    this.getServerUri = getServerUri
  }

  public getPluginURL(pluginId: string, path: string): string {
    const serverURI = this.getServerUri()
    if (serverURI === undefined) {
      throw new Error("Can't get plugin: not connected to a server")
    }

    return buildHttpUri(serverURI, `plugin/${pluginId}/${path}`)
  }
}
