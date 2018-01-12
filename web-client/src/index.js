import React from 'react';
import ReactDOM from 'react-dom';

import 'bootstrap/dist/css/bootstrap.css';
import './index.css';

import WebClient from './WebClient';
import registerServiceWorker from './registerServiceWorker';

ReactDOM.render(<WebClient />, document.getElementById('root'));
registerServiceWorker();
