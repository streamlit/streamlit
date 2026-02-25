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

import noStaticSubpixelTransforms from "./no-static-subpixel-transforms"
import { ruleTester } from "./utils/ruleTester"

ruleTester.run("no-static-subpixel-transforms", noStaticSubpixelTransforms, {
  valid: [
    "const style = { transform: 'translateX(20px)' }",
    "const style = { transform: 'scale(0.9)' }",
    "const style = { transform: 'none' }",
    "const style = { top: '50%', transform: dynamicTransform }",
    "const Styled = styled.div`transform: scale(0.95);`",
  ],
  invalid: [
    {
      code: "const style = { transform: 'translateY(-50%)' }",
      errors: [{ messageId: "noStaticSubpixelTransform" }],
    },
    {
      code: "const style = { transform: 'translateY(50%)' }",
      errors: [{ messageId: "noStaticSubpixelTransform" }],
    },
    {
      code: "const style = { transform: 'translateY(-0.1em)' }",
      errors: [{ messageId: "noStaticSubpixelTransform" }],
    },
    {
      code: "const Styled = styled.div`transform: translateY(-50%);`",
      errors: [{ messageId: "noStaticSubpixelTransform" }],
    },
  ],
})
