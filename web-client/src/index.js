import React from 'react';
import ReactDOM from 'react-dom';

import 'bootstrap/dist/css/bootstrap.css';
import './index.css';

import WebClient from './WebClient';

// Disabling this magic for now because we want
// to test without caching on the production build:
/* import registerServiceWorker from './registerServiceWorker'; */

ReactDOM.render(<WebClient />, document.getElementById('root'));

// Disabling this magic for now because we want
// to test without caching on the production build:
/* registerServiceWorker(); */
