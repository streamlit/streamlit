/**
 * Copyright (c) Streamlit Inc. (2018-2024) Snowflake Inc. (2022-2024)
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

// Raw data (in Apache Arrow format) for a dataframe
// that contains columns with decimal values.
//
// df = pd.DataFrame(
//     [
//         [Decimal("1.1"), Decimal("2.23")],
//         [Decimal("10000"), Decimal("-0.1")],
//     ],
//     columns=["c1", "c2"],
// )

export const DECIMAL = new Uint8Array([
  255, 255, 255, 255, 24, 3, 0, 0, 16, 0, 0, 0, 0, 0, 10, 0, 14, 0, 6, 0, 5, 0,
  8, 0, 10, 0, 0, 0, 0, 1, 4, 0, 16, 0, 0, 0, 0, 0, 10, 0, 12, 0, 0, 0, 4, 0,
  8, 0, 10, 0, 0, 0, 112, 2, 0, 0, 4, 0, 0, 0, 1, 0, 0, 0, 4, 0, 0, 0, 56, 253,
  255, 255, 80, 2, 0, 0, 4, 0, 0, 0, 67, 2, 0, 0, 123, 34, 105, 110, 100, 101,
  120, 95, 99, 111, 108, 117, 109, 110, 115, 34, 58, 32, 91, 123, 34, 107, 105,
  110, 100, 34, 58, 32, 34, 114, 97, 110, 103, 101, 34, 44, 32, 34, 110, 97,
  109, 101, 34, 58, 32, 110, 117, 108, 108, 44, 32, 34, 115, 116, 97, 114, 116,
  34, 58, 32, 48, 44, 32, 34, 115, 116, 111, 112, 34, 58, 32, 50, 44, 32, 34,
  115, 116, 101, 112, 34, 58, 32, 49, 125, 93, 44, 32, 34, 99, 111, 108, 117,
  109, 110, 95, 105, 110, 100, 101, 120, 101, 115, 34, 58, 32, 91, 123, 34,
  110, 97, 109, 101, 34, 58, 32, 110, 117, 108, 108, 44, 32, 34, 102, 105, 101,
  108, 100, 95, 110, 97, 109, 101, 34, 58, 32, 110, 117, 108, 108, 44, 32, 34,
  112, 97, 110, 100, 97, 115, 95, 116, 121, 112, 101, 34, 58, 32, 34, 117, 110,
  105, 99, 111, 100, 101, 34, 44, 32, 34, 110, 117, 109, 112, 121, 95, 116,
  121, 112, 101, 34, 58, 32, 34, 111, 98, 106, 101, 99, 116, 34, 44, 32, 34,
  109, 101, 116, 97, 100, 97, 116, 97, 34, 58, 32, 123, 34, 101, 110, 99, 111,
  100, 105, 110, 103, 34, 58, 32, 34, 85, 84, 70, 45, 56, 34, 125, 125, 93, 44,
  32, 34, 99, 111, 108, 117, 109, 110, 115, 34, 58, 32, 91, 123, 34, 110, 97,
  109, 101, 34, 58, 32, 34, 99, 49, 34, 44, 32, 34, 102, 105, 101, 108, 100,
  95, 110, 97, 109, 101, 34, 58, 32, 34, 99, 49, 34, 44, 32, 34, 112, 97, 110,
  100, 97, 115, 95, 116, 121, 112, 101, 34, 58, 32, 34, 100, 101, 99, 105, 109,
  97, 108, 34, 44, 32, 34, 110, 117, 109, 112, 121, 95, 116, 121, 112, 101, 34,
  58, 32, 34, 111, 98, 106, 101, 99, 116, 34, 44, 32, 34, 109, 101, 116, 97,
  100, 97, 116, 97, 34, 58, 32, 123, 34, 112, 114, 101, 99, 105, 115, 105, 111,
  110, 34, 58, 32, 54, 44, 32, 34, 115, 99, 97, 108, 101, 34, 58, 32, 49, 125,
  125, 44, 32, 123, 34, 110, 97, 109, 101, 34, 58, 32, 34, 99, 50, 34, 44, 32,
  34, 102, 105, 101, 108, 100, 95, 110, 97, 109, 101, 34, 58, 32, 34, 99, 50,
  34, 44, 32, 34, 112, 97, 110, 100, 97, 115, 95, 116, 121, 112, 101, 34, 58,
  32, 34, 100, 101, 99, 105, 109, 97, 108, 34, 44, 32, 34, 110, 117, 109, 112,
  121, 95, 116, 121, 112, 101, 34, 58, 32, 34, 111, 98, 106, 101, 99, 116, 34,
  44, 32, 34, 109, 101, 116, 97, 100, 97, 116, 97, 34, 58, 32, 123, 34, 112,
  114, 101, 99, 105, 115, 105, 111, 110, 34, 58, 32, 51, 44, 32, 34, 115, 99,
  97, 108, 101, 34, 58, 32, 50, 125, 125, 93, 44, 32, 34, 99, 114, 101, 97,
  116, 111, 114, 34, 58, 32, 123, 34, 108, 105, 98, 114, 97, 114, 121, 34, 58,
  32, 34, 112, 121, 97, 114, 114, 111, 119, 34, 44, 32, 34, 118, 101, 114, 115,
  105, 111, 110, 34, 58, 32, 34, 49, 50, 46, 48, 46, 49, 34, 125, 44, 32, 34,
  112, 97, 110, 100, 97, 115, 95, 118, 101, 114, 115, 105, 111, 110, 34, 58,
  32, 34, 50, 46, 49, 46, 49, 34, 125, 0, 6, 0, 0, 0, 112, 97, 110, 100, 97,
  115, 0, 0, 2, 0, 0, 0, 68, 0, 0, 0, 4, 0, 0, 0, 212, 255, 255, 255, 0, 0, 1,
  7, 16, 0, 0, 0, 20, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 99, 50, 0,
  0, 196, 255, 255, 255, 3, 0, 0, 0, 2, 0, 0, 0, 16, 0, 20, 0, 8, 0, 6, 0, 7,
  0, 12, 0, 0, 0, 16, 0, 16, 0, 0, 0, 0, 0, 1, 7, 16, 0, 0, 0, 28, 0, 0, 0, 4,
  0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 99, 49, 0, 0, 8, 0, 12, 0, 4, 0, 8, 0, 8, 0,
  0, 0, 6, 0, 0, 0, 1, 0, 0, 0, 255, 255, 255, 255, 184, 0, 0, 0, 20, 0, 0, 0,
  0, 0, 0, 0, 12, 0, 22, 0, 6, 0, 5, 0, 8, 0, 12, 0, 12, 0, 0, 0, 0, 3, 4, 0,
  24, 0, 0, 0, 64, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10, 0, 24, 0, 12, 0, 4, 0, 8, 0,
  10, 0, 0, 0, 92, 0, 0, 0, 16, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 32, 0, 0, 0, 0, 0, 0, 0, 32, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  32, 0, 0, 0, 0, 0, 0, 0, 32, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 2,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 160, 134, 1,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 223, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 246, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
  255, 255, 255, 255, 255, 255, 255, 0, 0, 0, 0,
])
