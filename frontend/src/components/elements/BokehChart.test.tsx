import React from 'react';
import ReactDOM from 'react-dom';
import { Map as ImmutableMap } from 'immutable';
import BokehChart from './BokehChart';

it('renders without crashing', () => {
  const mountPoint = document.createElement('div');
  const props = {
    element: ImmutableMap({ 'figure': null }),
    id: 0,
    width: 0,
  };
  ReactDOM.render(<BokehChart {...props} />, mountPoint);
  ReactDOM.unmountComponentAtNode(mountPoint);
});
