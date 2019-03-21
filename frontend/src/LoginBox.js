/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 */

import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';

import { GoogleLogin } from 'react-google-login';


//const GOOGLE_CLIENT_ID =
// '121672393440-k47bl22ndo3lnu5lblfbukg8812osjvp.apps.googleusercontent.com';
const GOOGLE_CLIENT_ID = '230319206599-p4ol9d1ef0otk7o1eetaornovisu0925.apps.googleusercontent.com';


class LoginBox extends PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      loginInProgress: false,
    };

    this.onRequest = this.onRequest.bind(this);
    this.onSuccess = this.onSuccess.bind(this);
    this.onFailure = this.onFailure.bind(this);
  }

  static get propTypes() {
    return {
      /** Function that will be called when login succeeds. */
      onSuccess: PropTypes.func.isRequired,

      /** Function that will be called when login fails. */
      onFailure: PropTypes.func.isRequired,
    };
  }

  render() {
    return (
      <div>
        <h1>Permission required</h1>
        { this.state.loginInProgress ?
          <div>
            <p>Please wait...</p>
          </div>
          :
          <div>
            <p>
              Want in? Ask the owner for access, or sign into a different
              account.
            </p>
            <GoogleLogin
              clientId={GOOGLE_CLIENT_ID}
              buttonText="Login with Google"
              onRequest={this.onRequest}
              onSuccess={this.onSuccess}
              onFailure={this.onFailure}
            />
          </div>
        }
      </div>
    );
  }

  onRequest() {
    console.log('onRequest');
    this.setState({ loginInProgress: true });
  }

  onSuccess(googleUser) {
    console.log('onSuccess');
    const authResult = googleUser.getAuthResponse();
    this.props.onSuccess({
      accessToken: authResult['access_token'],
      idToken: authResult['id_token'],
    });
  }

  onFailure(response) {
    console.log('onFailure', response);
    this.props.onFailure(`Error: ${response.error}. ${response.details}`);
  }
}

export default LoginBox;
