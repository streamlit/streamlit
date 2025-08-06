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

import useTimeout from "./useTimeout"

export type UseCopyToClipboardResult = {
  isCopied: boolean
  copyToClipboard: () => void
}

export const useCopyToClipboard = ({
  text,
  timeout = 2_000,
}: {
  /**
   * The text to copy to the clipboard.
   */
  text: string
  /**
   * The (optional) timeout in milliseconds to reset the copied state. Default
   * is 2 seconds.
   */
  timeout?: number
}): UseCopyToClipboardResult => {
  const [isCopied, setIsCopied] = useState(false)

  const { restart } = useTimeout(
    useCallback(() => {
      setIsCopied(false)
    }, []),
    isCopied ? timeout : null
  )

  const copyToClipboard = useCallback(() => {
    const performCopy = async (): Promise<void> => {
      try {
        await navigator.clipboard.writeText(text)
        setIsCopied(true)
        // Restart the timeout on each successful copy to reset the timer
        restart()
      } catch {
        setIsCopied(false)
      }
    }

    // Call the async function but don't return the promise to make passing the
    // callback into `onClick` pass the type-checker
    void performCopy()
  }, [text, restart])

  return { isCopied, copyToClipboard }
}
