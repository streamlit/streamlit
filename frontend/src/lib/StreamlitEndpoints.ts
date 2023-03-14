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

import { BaseUriParts, buildHttpUri } from "src/lib/UriUtil"
import { Endpoints } from "src/lib/Endpoints"

/** "Vanilla" Streamlit server implementation of ComponentEndpointInfo. */
export class StreamlitEndpoints implements Endpoints {
  private readonly getServerUri: () => BaseUriParts | undefined

  private cachedServerUri?: BaseUriParts

  public constructor(getServerUri: () => BaseUriParts | undefined) {
    this.getServerUri = getServerUri
  }

  public buildComponentURL(componentName: string, path: string): string {
    // Fetch the server URI. If our server is disconnected, this will return
    // undefined, in which case we default to the most recent cached value
    // of the URI.
    let serverUri = this.getServerUri()
    if (serverUri === undefined) {
      if (this.cachedServerUri === undefined) {
        throw new Error("Can't fetch component: not connected to a server")
      }
      serverUri = this.cachedServerUri
    }

    this.cachedServerUri = serverUri
    return buildHttpUri(serverUri, `component/${componentName}/${path}`)
  }
}
