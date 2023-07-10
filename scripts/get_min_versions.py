# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# This script should be invoked using `make gen-min-dep-constraints`.
# It has the precondition that you must have installed streamlit locally since
# you last updated its dependencies, which the make command takes care of.

# based on https://stackoverflow.com/a/59711270
import pkg_resources

package = pkg_resources.working_set.find(pkg_resources.Requirement.parse("streamlit"))

oldest_dependencies = []

for requirement in package.requires():  # type: ignore
    dependency = requirement.project_name
    if requirement.extras:
        dependency += "[" + ",".join(requirement.extras) + "]"
    # We will see both the lower bound and upper bound parts of each requriment
    # So we ignore the ones that aren't the lower bound.
    for comparator, version in requirement.specs:
        if comparator == "==":
            if len(requirement.specs) != 1:
                raise ValueError(f"Invalid dependency: {requirement}")
            dependency += "==" + version
        elif comparator == "<=":
            if len(requirement.specs) != 2:
                raise ValueError(f"Invalid dependency: {requirement}")
        elif comparator == ">=":
            dependency += "==" + version

    oldest_dependencies.append(dependency)

for dependency in sorted(oldest_dependencies):
    print(dependency)
