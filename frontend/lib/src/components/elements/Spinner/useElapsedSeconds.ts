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

import { useEffect, useState } from "react"

/**
 * Return the seconds since `isEnabled` became true, updated every 100ms.
 * Drives a spinner's `show_time` display.
 */
export function useElapsedSeconds(isEnabled: boolean): number {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  useEffect(() => {
    if (!isEnabled) return

    const startTime = Date.now()
    const updateElapsedSeconds = (): void => {
      setElapsedSeconds((Date.now() - startTime) / 1000)
    }

    updateElapsedSeconds()
    const timer = setInterval(updateElapsedSeconds, 100)

    return () => clearInterval(timer)
  }, [isEnabled])

  return elapsedSeconds
}
