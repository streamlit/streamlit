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

const Environment = require("jest-environment-jsdom")

/**
 * A custom environment to set the TextEncoder and TextDecoder that are required
 * by arrow-js, for tests. These functions are provided by browser JS runtimes
 * when Streamlit is running there.
 */

wqmodule.exports = class CustomTestEnvironment extends Environment {
  async setup() {
    await super.setup()
    if (typeof this.global.TextEncoder === "undefined") {
      const { TextEncoder } = require("util")
      this.global.TextEncoder = TextEncoder
    }
    if (typeof this.global.TextDecoder === "undefined") {
      const { TextDecoder } = require("util")
      this.global.TextDecoder = TextDecoder
    }
  }
}
