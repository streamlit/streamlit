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

const formatTime = (timeMs: number): string => {
  const seconds = Math.floor(timeMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const remainingSeconds = seconds % 60
  const remainingMinutes = minutes % 60

  const displaySec = remainingSeconds.toString().padStart(2, "0")
  const displayMin = remainingMinutes.toString().padStart(2, "0")
  const displayHours = hours.toString().padStart(2, "0")

  return minutes < 60
    ? `${displayMin}:${displaySec}`
    : `${displayHours}:${displayMin}:${displaySec}`
}

export default formatTime
