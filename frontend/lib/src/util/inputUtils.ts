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

type EnterKeyEvent = Pick<
  React.KeyboardEvent<HTMLElement>,
  "key" | "keyCode" | "nativeEvent"
>

export function isEnterKeyPressed(event: EnterKeyEvent): boolean {
  // Windows IME can report Enter as keyCode 10 (LF), so we check keyCode in
  // addition to key. https://bugs.chromium.org/p/chromium/issues/detail?id=79407
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const { keyCode, key } = event

  return (
    (key === "Enter" || keyCode === 13 || keyCode === 10) &&
    // Do not send the sentence being composed when Enter is typed into the IME.
    !(event.nativeEvent?.isComposing === true)
  )
}
