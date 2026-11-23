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
 * Trigger a local download of a data URL as `{timestamp}_chart.{extension}`.
 *
 * The timestamp uses the user's local wall-clock time (`YYYY-MM-DDTHH-MM`)
 * rather than UTC, matching `st.vega_lite_chart` / `st.echarts_chart`.
 *
 * @param dataUrl The data URL to download.
 * @param extension The file extension without a leading dot (e.g. `"png"`).
 */
export function downloadDataUrl(dataUrl: string, extension: string): void {
  const now = new Date()
  const pad = (value: number): string => String(value).padStart(2, "0")
  const timestamp =
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `T${pad(now.getHours())}-${pad(now.getMinutes())}`
  const link = document.createElement("a")
  link.href = dataUrl
  link.download = `${timestamp}_chart.${extension}`
  link.style.display = "none"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
