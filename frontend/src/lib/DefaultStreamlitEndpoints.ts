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
import { StreamlitEndpoints } from "src/lib/StreamlitEndpoints"

interface Props {
  getServerUri: () => BaseUriParts | undefined
  csrfEnabled: boolean
}

/** Default Streamlit server implementation of the StreamlitEndpoints interface. */
export class DefaultStreamlitEndpoints implements StreamlitEndpoints {
  private readonly getServerUri: () => BaseUriParts | undefined

  private readonly csrfEnabled: boolean

  private cachedServerUri?: BaseUriParts

  public constructor(props: Props) {
    this.getServerUri = props.getServerUri
    this.csrfEnabled = props.csrfEnabled
  }

  public buildComponentURL(componentName: string, path: string): string {
    return buildHttpUri(
      this.requireServerUri(),
      `component/${componentName}/${path}`
    )
  }

  private requireServerUri(): BaseUriParts {
    // Fetch the server URI. If our server is disconnected, this will return
    // undefined, in which case we default to the most recent cached value
    // of the URI.
    const serverUri = this.getServerUri()
    if (serverUri != null) {
      this.cachedServerUri = serverUri
      return serverUri
    }

    if (this.cachedServerUri != null) {
      return this.cachedServerUri
    }

    throw new Error("not connected to a server!")
  }
}
