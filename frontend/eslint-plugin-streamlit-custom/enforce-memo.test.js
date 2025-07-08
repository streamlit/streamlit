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

const { RuleTester } = require("eslint")
const enforceMemo = require("./enforce-memo")

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2018,
    sourceType: "module",
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
    },
  },
})

ruleTester.run("enforce-memo", enforceMemo, {
  valid: [
    // Already wrapped with React.memo as function declaration
    {
      code: `
        function MyComponent() {
          return <div>Hello</div>;
        }
        export default React.memo(MyComponent);
      `,
    },
    // Already wrapped with memo as function declaration
    {
      code: `
        import { memo } from 'react';
        function MyComponent() {
          return <div>Hello</div>;
        }
        export default memo(MyComponent);
      `,
    },
    // Already wrapped with React.memo as arrow function
    {
      code: `
        const MyComponent = (props) => {
          return <div>Hello {props.name}</div>;
        };
        export default React.memo(MyComponent);
      `,
    },
    // Direct memo usage
    {
      code: `
        const MyComponent = React.memo((props) => {
          return <div>Hello {props.name}</div>;
        });
      `,
    },
    // Using imported memo
    {
      code: `
        import { memo } from 'react';
        const MyComponent = memo((props) => {
          return <div>Hello {props.name}</div>;
        });
      `,
    },
    // Non-component functions (not PascalCase) should not trigger the rule
    {
      code: `
        function calculateTotal(a, b) {
          return a + b;
        }
      `,
    },
    // Non-component arrow functions should not trigger the rule
    {
      code: `
        const formatName = (user) => {
          return user.firstName + ' ' + user.lastName;
        };
      `,
    },
    // If the component is wrapped in a HOC, and the enhanced component is
    // memoized, then we should not trigger the rule.
    {
      code: `import { memo } from 'react'
      import { someOtherHOC } from 'some-other-library'

      const MyComponent = ({ name }) => {
        return <div>Hello {name}</div>
      }

      export default memo(someOtherHOC(MyComponent))
      `,
    },
    // If the component is wrapped in a HOC, and the enhanced component is
    // memoized, then we should not trigger the rule.
    {
      code: `import { memo } from 'react'
      import { someOtherHOC } from 'some-other-library'

      const MyComponent = ({ name }) => {
        return <div>Hello {name}</div>
      }

      const EnhancedComponent = someOtherHOC(MyComponent)
      export default memo(EnhancedComponent)
      `,
    },
    // Only check for memo on components that are exported
    {
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
    // For functions that are not components, we should not trigger the rule
    {
      code: `
        export function MyFunction() {
          return 'Hello'
        }
      `,
    },
    // For arrow functions that are not components, we should not trigger the rule
    {
      code: `
        export const MyArrowFunction = () => {
          return 'Hello'
        }
      `,
    },
    // For arrow functions that are not components but take in a props-style
    // argument, we should not trigger the rule
    {
      code: `
        export const MyArrowFunction = (props) => {
          return 'Hello'
        }
      `,
    },
    // For functions that are not components but take in a props-style
    // argument, we should not trigger the rule
    {
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
    // Function declaration component with export -> should fix the export
    {
      code: `
        function MyComponent() {
          return <div>Hello</div>;
        }
        export default MyComponent;
      `,
      errors: [
        {
          message: "React components should be wrapped with memo",
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
    // Arrow function component with export -> should fix the export
    {
      code: `
        import React from 'react';
        const MyComponent = (props) => {
          return <div>Hello {props.name}</div>;
        };
        export default MyComponent;
      `,
      errors: [
        {
          message: "React components should be wrapped with memo",
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
    // Test case for component with complex props and export -> should fix only the export
    {
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
          message: "React components should be wrapped with memo",
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
    // Components that are enhanced with a HOC should be wrapped with memo
    {
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
          message: "React components should be wrapped with memo",
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

console.log("All 'enforce-memo' tests passed!")
