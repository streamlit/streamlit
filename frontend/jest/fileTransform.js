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

"use strict"

const path = require("path")
const camelcase = require("camelcase")

// This is a custom Jest transformer turning file imports into filenames.
// File imports aren't used by our tests so we can safely mock them out
// Without this, we try to import pngs or other such things and jest tries to parse them as javascript
// https://jestjs.io/docs/webpack#handling-static-assets

module.exports = {
  process(src, filename) {
    const assetFilename = JSON.stringify(path.basename(filename))

    if (filename.match(/\.svg$/)) {
      // Based on how SVGR generates a component name:
      // https://github.com/smooth-code/svgr/blob/01b194cf967347d43d4cbe6b434404731b87cf27/packages/core/src/state.js#L6
      const pascalCaseFilename = camelcase(path.parse(filename).name, {
        pascalCase: true,
      })
      const componentName = `Svg${pascalCaseFilename}`
      return `const React = require('react');
       module.exports = {
         __esModule: true,
         default: ${assetFilename},
         ReactComponent: React.forwardRef(function ${componentName}(props, ref) {
           return {
             $$typeof: Symbol.for('react.element'),
             type: 'svg',
             ref: ref,
             key: null,
             props: Object.assign({}, props, {
               children: ${assetFilename}
             })
           };
         }),
       };`
    }

    return `module.exports = ${assetFilename};`
  },
}
