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

import { ReactNode } from "react"

/**
 * A Streamlit plugin.
 * This is called "StPlugin" to avoid clashing with the native "Plugin" class.
 */
export class StPlugin {
  private readonly renderFunc: Function

  public constructor(code: string) {
    /* eslint-disable no-new-func */
    const compiled = new Function(code)

    // Execute the code
    let executedValue: any
    try {
      executedValue = compiled()
    } catch (err) {
      throw new Error(`Plugin execution error: ${err}`)
    }

    // Find its render function.
    let renderFunc: Function | undefined
    if (executedValue instanceof Function) {
      renderFunc = executedValue
    } else {
      const render = extractFunction(executedValue, "render")
      if (render != null) {
        renderFunc = render
      }
    }

    if (renderFunc == null) {
      throw new Error("Plugin doesn't define a render() function!")
    }

    this.renderFunc = renderFunc
  }

  /** Call the plugin's render function with the given args. */
  public render(args: any): ReactNode {
    let returnValue: any
    try {
      returnValue = this.renderFunc(args)
    } catch (err) {
      return `Error in plugin.render(): ${err}`
    }

    return returnValue
  }
}

/** Return a named function from an object, if it's defined. */
function extractFunction(obj: any, name: string): Function | undefined {
  if (obj == null) {
    return undefined
  }

  if (!(name in obj)) {
    return undefined
  }

  const maybeFunc = obj[name] as Function
  if (maybeFunc == null) {
    return undefined
  }

  return maybeFunc
}
