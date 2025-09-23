/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import { useCallback, useState } from "react"

import { getLogger } from "loglevel"

import useTimeout from "./useTimeout"

const LOG = getLogger("useCopyToClipboard")

/**
 * Result returned by `useCopyToClipboard`.
 */
export type UseCopyToClipboardResult = {
  /**
   * Whether the last copy action has recently succeeded. This
   * flag automatically resets to false after the timeout elapses.
   */
  isCopied: boolean
  /**
   * Copies the provided text to the user's clipboard.
   *
   * @param text The text content to write to the clipboard.
   */
  copyToClipboard: (text: string) => void
  /**
   * Convenience label suitable for UI controls. Becomes "Copied" while
   * `isCopied` is true; otherwise "Copy to clipboard".
   */
  label: string
}

/**
 * React hook that exposes a copy-to-clipboard action and a transient "copied"
 * state that resets after a configurable timeout.
 *
 * It writes the provided text to `navigator.clipboard` and toggles `isCopied`
 * to true upon success, reverting to false after `timeout`.
 *
 * @param options Optional configuration.
 * @param options.timeout Timeout in milliseconds before `isCopied` resets. Defaults to 2000ms.
 * @returns An object containing `isCopied`, `copyToClipboard`, and `label`.
 */
export const useCopyToClipboard = ({
  timeout = 2_000,
}: {
  /**
   * The (optional) timeout in milliseconds to reset the copied state. Default
   * is 2 seconds.
   */
  timeout?: number
} = {}): UseCopyToClipboardResult => {
  const [isCopied, setIsCopied] = useState(false)

  const { restart } = useTimeout(
    useCallback(() => {
      setIsCopied(false)
    }, []),
    isCopied ? timeout : null
  )

  const copyToClipboard = useCallback(
    (text: string) => {
      const performCopy = async (): Promise<void> => {
        try {
          // eslint-disable-next-line no-restricted-properties -- This is the only expected usage of navigator.clipboard
          await navigator.clipboard.writeText(text)
          setIsCopied(true)
          // Restart the timeout on each successful copy to reset the timer
          restart()
        } catch (error) {
          LOG.error("Failed to copy text to clipboard:", error)
          setIsCopied(false)
        }
      }

      // Call the async function but don't return the promise to make passing the
      // callback into `onClick` pass the type-checker
      void performCopy()
    },
    [restart]
  )

  const label = isCopied ? "Copied" : "Copy to clipboard"

  return { isCopied, copyToClipboard, label }
}
