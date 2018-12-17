/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 */

import AWS from 'aws-sdk';
import { FETCH_PARAMS } from './baseconsts';


let s3 = null;
let credentialsRequired = false;


export function getObject(props) {
  if (credentialsRequired) {
    return getPrivateObject(props);
  } else {
    return getPublicObject(props);
  }
}


export async function getPublicObject(props) {
  const response = await fetch(props.Key, FETCH_PARAMS);

  if (!response.ok) {
    if (response.status === 403) {
      credentialsRequired = true;
      // Can't subclass Error class in Babel, so this is my crappy solution.
      throw new Error('PermissionError');
    } else {
      const responseText = await response.text();
      throw new Error(
          `HTTP status code: ${response.status}\n` +
          `Response text: ${responseText}`);
    }
  }

  return response;
}


export async function getPrivateObject(props) {
  if (!s3) {
    s3 = new AWS.S3();
  }

  const data = await s3.getObject(props).promise();
  return {
    json: () => Promise.resolve(JSON.parse(data.Body.toString('utf-8'))),
    text: () => Promise.resolve(data.Body.toString('utf-8')),
    arrayBuffer: () => Promise.resolve(data.Body),
  };
}


export function configureCredentials(id_token) {
  // Add access token to Cognito credentials login map
  AWS.config.region = 'us-west-2';
  AWS.config.credentials = new AWS.CognitoIdentityCredentials({
    IdentityPoolId: 'us-west-2:5fe7b884-1665-4a48-a20f-db5d719e02a8',
    Logins: {
      'accounts.google.com': id_token,
    }
  });

  return AWS.config.credentials.getPromise();
}
