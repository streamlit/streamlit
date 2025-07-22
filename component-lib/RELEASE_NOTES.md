<!--
  Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
-->

# Release notes

# 2.0.0

This release has no significant changes to our API, but we bump the major version as
the [`apache-arrow`](https://www.npmjs.com/package/apache-arrow) library is updated, which may affect users of the library. For details, see: [Apache Arrow Releases](https://arrow.apache.org/release/).

Moreover, it is worth adding that:

- The new version of `apache-arrow` requires a newer version of Typescript to work, but thanks to that you can also use `create-react-script` 5 and newer and the latest versions of NodeJS.
- We dropped use of [`event-target-shim`](https://www.npmjs.com/package/event-target-shim) as modern browsers no longer need it.

## List of commits

- [`21e7beeae`](https://github.com/streamlit/streamlit/commit/21e7beeae) Bump dependencies of component-lib (#6830)
- [`1e6a3e45e`](https://github.com/streamlit/streamlit/commit/1e6a3e45e) Add tests for component-lib (#6580)
- [`e43f64c72`](https://github.com/streamlit/streamlit/commit/e43f64c72) fix: upgrade command-line-args from 5.0.2 to 5.2.1 (#6258)
- [`3bb2243ec`](https://github.com/streamlit/streamlit/commit/3bb2243ec) fix: upgrade flatbuffers from 1.11.0 to 1.12.0 (#6259)
- [`fe8fd4f5c`](https://github.com/streamlit/streamlit/commit/fe8fd4f5c) fix: upgrade multiple dependencies with Snyk (#6262)
- [`0dfd31940`](https://github.com/streamlit/streamlit/commit/0dfd31940) Update license headers (#5143)
- [`76859d67b`](https://github.com/streamlit/streamlit/commit/76859d67b) fix: Allow renderData.args to be typed (#5205)
- [`c8f2db61f`](https://github.com/streamlit/streamlit/commit/c8f2db61f) Fix typos (#5082)
- [`f85a0feac`](https://github.com/streamlit/streamlit/commit/f85a0feac) Fix build issues due to linting errors (#4637)
- [`a91272018`](https://github.com/streamlit/streamlit/commit/a91272018) Bump ansi-regex from 4.1.0 to 4.1.1 in /component-lib (#4558)
- [`d44b16290`](https://github.com/streamlit/streamlit/commit/d44b16290) Update years in all license headers (#4291)
