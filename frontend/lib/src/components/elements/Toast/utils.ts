/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

/**
 * Truncates toast messages that are longer than three lines.
 * Attempts to break at word boundaries to avoid cutting words.
 */
export function shortenMessage(fullMessage: string): string {
  const characterLimit = 104

  if (fullMessage.length > characterLimit) {
    let message = fullMessage.replace(/^(.{104}[^\s]*).*/, "$1")

    if (message.length > characterLimit) {
      message = message
        .substring(0, characterLimit)
        .split(" ")
        .slice(0, -1)
        .join(" ")
    }

    return message.trim()
  }

  return fullMessage
}
