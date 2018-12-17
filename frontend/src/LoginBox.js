/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 */

import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';

import { GoogleLogin } from 'react-google-login';


const GOOGLE_CLIENT_ID = '121672393440-k47bl22ndo3lnu5lblfbukg8812osjvp.apps.googleusercontent.com';


class LoginBox extends PureComponent {
  static get propTypes() {
    return {
      onSuccess: PropTypes.func.isRequired,
      onFailure: PropTypes.func.isRequired,
    };
  }

  render() {
    const { onSuccess, onFailure } = this.props;
    return (
      <div>
        <h1>Permission required</h1>
        <p>
          Want in? Ask the owner for access or try signing into an account that
          has the right permissions.
        </p>
        <GoogleLogin
          clientId={GOOGLE_CLIENT_ID}
          buttonText="Login with Google"
          onSuccess={onSuccess}
          onFailure={onFailure}
        />
      </div>
    );
  }
}

export default LoginBox;
