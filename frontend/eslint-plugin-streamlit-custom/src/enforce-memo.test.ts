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

import enforceMemo from "./enforce-memo"
import { ruleTester } from "./utils/ruleTester"

ruleTester.run("enforce-memo", enforceMemo, {
  valid: [
    {
      name: "function declaration component already wrapped with React.memo",
      code: `
        function MyComponent() {
          return <div>Hello</div>;
        }
        export default React.memo(MyComponent);
      `,
    },
    {
      name: "function declaration component already wrapped with imported memo",
      code: `
        import { memo } from 'react';
        function MyComponent() {
          return <div>Hello</div>;
        }
        export default memo(MyComponent);
      `,
    },
    {
      name: "arrow function component already wrapped with React.memo",
      code: `
        const MyComponent = (props) => {
          return <div>Hello {props.name}</div>;
        };
        export default React.memo(MyComponent);
      `,
    },
    {
      name: "component defined directly with React.memo",
      code: `
        const MyComponent = React.memo((props) => {
          return <div>Hello {props.name}</div>;
        });
      `,
    },
    {
      name: "component defined directly with imported memo",
      code: `
        import { memo } from 'react';
        const MyComponent = memo((props) => {
          return <div>Hello {props.name}</div>;
        });
      `,
    },
    {
      name: "non-component function (camelCase) should not trigger rule",
      code: `
        function calculateTotal(a, b) {
          return a + b;
        }
      `,
    },
    {
      name: "non-component arrow function (camelCase) should not trigger rule",
      code: `
        const formatName = (user) => {
          return user.firstName + ' ' + user.lastName;
        };
      `,
    },
    {
      name: "HOC-wrapped component with memo on enhanced component (inline)",
      code: `import { memo } from 'react'
      import { someOtherHOC } from 'some-other-library'

      const MyComponent = ({ name }) => {
        return <div>Hello {name}</div>
      }

      export default memo(someOtherHOC(MyComponent))
      `,
    },
    {
      name: "HOC-wrapped component with memo on enhanced component (separate variable)",
      code: `import { memo } from 'react'
      import { someOtherHOC } from 'some-other-library'

      const MyComponent = ({ name }) => {
        return <div>Hello {name}</div>
      }

      const EnhancedComponent = someOtherHOC(MyComponent)
      export default memo(EnhancedComponent)
      `,
    },
    {
      name: "internal component without memo should not trigger rule (only exported components checked)",
      code: `import { memo } from 'react'
      import { someOtherHOC } from 'some-other-library'

      const MyComponentInner = ({ name }) => {
        return <div>Hello {name}</div>
      }

      const MyComponent = ({ name }) => {
        return <MyComponentInner name={name} />
      }

      export default memo(MyComponent)
      `,
    },
    {
      name: "exported function that returns string should not trigger rule",
      code: `
        export function MyFunction() {
          return 'Hello'
        }
      `,
    },
    {
      name: "exported arrow function that returns string should not trigger rule",
      code: `
        export const MyArrowFunction = () => {
          return 'Hello'
        }
      `,
    },
    {
      name: "exported arrow function with props-style argument that returns string should not trigger rule",
      code: `
        export const MyArrowFunction = (props) => {
          return 'Hello'
        }
      `,
    },
    {
      name: "exported function with props-style argument that returns object should not trigger rule",
      code: `
        function JsonColumn(props) {
          return {
            kind: 'json',
            ...props,
          }
        }

        export default JsonColumn
      `,
    },
  ],
  invalid: [
    {
      name: "function declaration component without memo should be wrapped",
      code: `
        function MyComponent() {
          return <div>Hello</div>;
        }
        export default MyComponent;
      `,
      errors: [
        {
          messageId: "enforceMemo",
        },
      ],
      output: `
        import { memo } from 'react';

function MyComponent() {
          return <div>Hello</div>;
        }
        export default memo(MyComponent);
      `,
    },
    {
      name: "arrow function component without memo should be wrapped",
      code: `
        import React from 'react';
        const MyComponent = (props) => {
          return <div>Hello {props.name}</div>;
        };
        export default MyComponent;
      `,
      errors: [
        {
          messageId: "enforceMemo",
        },
      ],
      output: `
        import React, { memo } from 'react';
        const MyComponent = (props) => {
          return <div>Hello {props.name}</div>;
        };
        export default memo(MyComponent);
      `,
    },
    {
      name: "complex component with multiple imports without memo should be wrapped",
      code: `
        import 'some-styles.css';
        import React from 'react';
        import OtherComponent from './OtherComponent';

        const ComplexComponent = ({ items, onSelect, isActive }) => {
          return (
            <div className={isActive ? 'active' : ''}>
              {items.map(item => (
                <div key={item.id} onClick={() => onSelect(item)}>
                  {item.name}
                </div>
              ))}
            </div>
          );
        };
        export default ComplexComponent;
      `,
      errors: [
        {
          messageId: "enforceMemo",
        },
      ],
      output: `
        import 'some-styles.css';
        import React, { memo } from 'react';
        import OtherComponent from './OtherComponent';

        const ComplexComponent = ({ items, onSelect, isActive }) => {
          return (
            <div className={isActive ? 'active' : ''}>
              {items.map(item => (
                <div key={item.id} onClick={() => onSelect(item)}>
                  {item.name}
                </div>
              ))}
            </div>
          );
        };
        export default memo(ComplexComponent);
      `,
    },
    {
      name: "HOC-wrapped component without memo should be wrapped",
      code: `import { memo } from 'react'
      import { someOtherHOC } from 'some-other-library'

      const MyComponent = ({ name }) => {
        return <div>Hello {name}</div>
      }

      const EnhancedComponent = someOtherHOC(MyComponent)
      export default EnhancedComponent
      `,
      errors: [
        {
          messageId: "enforceMemo",
        },
      ],
      output: `import { memo } from 'react'
      import { someOtherHOC } from 'some-other-library'

      const MyComponent = ({ name }) => {
        return <div>Hello {name}</div>
      }

      const EnhancedComponent = someOtherHOC(MyComponent)
      export default memo(EnhancedComponent)
      `,
    },
  ],
})
