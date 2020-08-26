// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.
import { DateUnit } from "../enum"
import { BaseVector } from "./base"
import { vectorFromValuesWithType } from "./index"
import { DateDay, DateMillisecond } from "../type"
/** @ignore */
export class DateVector extends BaseVector {
  /** @nocollapse */
  static from(...args) {
    if (args.length === 2) {
      return vectorFromValuesWithType(
        () =>
          args[1] === DateUnit.DAY ? new DateDay() : new DateMillisecond(),
        args[0]
      )
    }
    return vectorFromValuesWithType(() => new DateMillisecond(), args[0])
  }
}
/** @ignore */
export class DateDayVector extends DateVector {}
/** @ignore */
export class DateMillisecondVector extends DateVector {}

//# sourceMappingURL=date.mjs.map
