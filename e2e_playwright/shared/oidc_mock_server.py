# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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
import argparse
import base64
import json
import time
import uuid
from functools import partial
from typing import Any, Callable
from urllib.parse import parse_qs
from wsgiref.simple_server import make_server

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding, rsa

# Generate key once
private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
public_key = private_key.public_key()

numbers = public_key.public_numbers()

n = (
    base64.urlsafe_b64encode(
        numbers.n.to_bytes((numbers.n.bit_length() + 7) // 8, byteorder="big")
    )
    .decode("utf-8")
    .rstrip("=")
)
e = (
    base64.urlsafe_b64encode(
        numbers.e.to_bytes((numbers.e.bit_length() + 7) // 8, byteorder="big")
    )
    .decode("utf-8")
    .rstrip("=")
)


NONCE_REGISTRY = {}


def generate_token(payload: dict[str, Any]) -> str:
    # Create JWT header
    header = {
        "typ": "JWT",
        "alg": "RS256",
        "kid": "1",  # Match the kid in JWKS
    }

    # Encode header and payload
    header_b64 = base64.urlsafe_b64encode(json.dumps(header).encode()).rstrip(b"=")
    payload_b64 = base64.urlsafe_b64encode(json.dumps(payload).encode()).rstrip(b"=")

    # Sign
    message = b".".join([header_b64, payload_b64])
    signature = private_key.sign(message, padding.PKCS1v15(), hashes.SHA256())
    signature_b64 = base64.urlsafe_b64encode(signature).rstrip(b"=")

    # Combine all parts
    return b".".join([header_b64, payload_b64, signature_b64]).decode()


def oidc_app(
    environ: dict[str, Any],
    start_response: Callable[[str, list[tuple[str, str]]], Callable[[bytes], Any]],
    success: bool = True,
) -> list[bytes]:
    path = environ["PATH_INFO"]
    current_port = environ["SERVER_PORT"]

    if path == "/.well-known/openid-configuration":
        response = {
            "authorization_endpoint": f"http://localhost:{current_port}/auth",
            "token_endpoint": f"http://localhost:{current_port}/token",
            "jwks_uri": f"http://localhost:{current_port}/jwks",
        }
        status = "200 OK"
        headers = [("Content-Type", "application/json")]
        start_response(status, headers)
        return [json.dumps(response).encode()]

    if path == "/auth":
        # Accept any authorization request and return code
        qs = parse_qs(environ.get("QUERY_STRING", ""))

        redirect_uri = qs.get("redirect_uri", [""])[0]
        state = qs.get("state", [""])[0]
        nonce = qs.get("nonce", [""])[0]

        code = str(uuid.uuid4())
        NONCE_REGISTRY[code] = nonce

        if success:
            location = f"{redirect_uri}?code={code}&state={state}&nonce={nonce}"
        else:
            location = f"{redirect_uri}?error=access_denied&state={state}"

        status = "302 Found"
        headers = [("Location", location)]
        start_response(status, headers)
        return []

    if path == "/token":
        length = int(environ.get("CONTENT_LENGTH", "0"))

        body = environ["wsgi.input"].read(length)

        code = parse_qs(body.decode())["code"][0]

        # Return dummy token
        response = {
            "access_token": str(uuid.uuid4()),
            "token_type": "Bearer",
            "id_token": generate_token(
                {
                    "aud": "test-client-id",
                    "iss": f"http://localhost:{current_port}",
                    "sub": str(uuid.uuid4()),
                    "iat": int(time.time()),
                    "name": "John Doe",
                    "email": "authtest@example.com",
                    "exp": int(time.time()) + 3600,
                    "nonce": NONCE_REGISTRY[code],
                }
            ),
        }
        status = "200 OK"
        headers = [("Content-Type", "application/json")]
        start_response(status, headers)
        return [json.dumps(response).encode()]

    if path == "/jwks":
        jwks = {
            "keys": [
                {
                    "n": n,
                    "use": "sig",
                    "alg": "RS256",
                    "e": e,
                    "kid": "1",
                    "kty": "RSA",
                },
            ]
        }
        status = "200 OK"
        headers = [("Content-Type", "application/json")]
        start_response(status, headers)
        return [json.dumps(jwks).encode()]

    status = "404 Not Found"
    headers = [("Content-Type", "text/plain")]
    start_response(status, headers)
    return [b"Not Found"]


if __name__ == "__main__":
    # read script arguments
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=9999)
    parser.add_argument("--success", action="store_true", dest="success")
    parser.add_argument("--failure", action="store_false", dest="success")

    args = parser.parse_args()
    port = args.port

    httpd = make_server("", port, partial(oidc_app, success=args.success))
    print(f"Serving on port {port}...")
    httpd.serve_forever()
