Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

----

Files in the typing/ directory are used for catching typing errors as they are checked by our mypy script. Their purpose is to, essentially, assert that the typechecker derives the types of certain cases correctly.

This is useful because in some cases, such as those involving TypeVars and overloads, the logic necessary to determine what the types are is somewhat non-trivial, so it's nice to affirmatively check that certain typing results are correctly achieved. Furthermore, the rest of the testing code, which is naturally focused more on ensuring correct behavior, might not have sufficient coverage of the static typing possibilities; thus, this directory of code.
