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
import { BaseUriParts, buildHttpUri } from "lib/UriUtil"

/**
 * Compile a plugin's code. This does *not* execute that code.
 * Throws a SyntaxError if the code isn't compilable.
 */
function compilePlugin(code: string): Function {
  /* eslint-disable no-new-func */
  return new Function(code)
}

/**
 * Downloads and compiles plugins from the server.
 */
export class PluginRegistry {
  private readonly getServerUri: () => BaseUriParts | undefined

  // Plugin javascript by ID
  private readonly plugins = new Map<string, Promise<Function>>()

  public constructor(getServerUri: () => BaseUriParts | undefined) {
    this.getServerUri = getServerUri
  }

  public getPlugin(id: string): Promise<Function> {
    // Has the plugin already been registered?
    let pluginPromise = this.plugins.get(id)
    if (pluginPromise != null) {
      return pluginPromise
    }

    const serverURI = this.getServerUri()
    if (serverURI === undefined) {
      throw new Error("Can't get plugin: not connected to a server")
    }

    pluginPromise = axios
      .get(buildHttpUri(serverURI, `plugin/${id}`))
      .then(rsp => rsp.data)
      .then(data => compilePlugin(data))

    this.plugins.set(id, pluginPromise)

    return pluginPromise
  }
}
