"""streamlit.credentials module.

Copyright 2019 Streamlit Inc. All rights reserved.
"""
import hashlib
import hmac
import os
import sys

from collections import namedtuple

import base58
import toml

from streamlit.logger import get_logger

LOGGER = get_logger(__name__)

Activation = namedtuple('Activation', [
    'code',
    'email',
    'valid',
])

# For python 2.7
try:
    FileNotFoundError
except NameError:  # pragma: nocover
    FileNotFoundError = IOError


class Credentials(object):
    """Credentials class."""
    _singleton = None

    @classmethod
    def get_current(cls):
        """Return the singleton instance."""
        if cls._singleton is None:
            Credentials()

        return Credentials._singleton

    def __init__(self):
        """Initialize class."""
        if Credentials._singleton is not None:
            raise RuntimeError(
                'Credentials already initialized. Use .get_current() instead')

        self.activation = None
        self._conf_file = os.path.join(os.path.expanduser('~'), '.streamlit',
                                       'credentials.toml')

        Credentials._singleton = self

    def load(self):
        """Load from toml file."""
        if self.activation is not None:
            LOGGER.error('Credentials already loaded. Not rereading file.')
        else:
            try:
                with open(self._conf_file, 'r') as f:
                    data = toml.load(f).get('general')
                self.activation = verify_code(data['email'], data['code'])
            except FileNotFoundError:
                raise RuntimeError(
                    'Credentials file not found. Please run `streamlit activate`'
                )
            except Exception as e:
                raise Exception('Unable to load credentials from %s: %s' %
                                (self._conf_file, e))

    def check_activated(self):
        try:
            self.load()
        except (Exception, RuntimeError) as e:
            _exit(str(e))

        if not self.activation.valid:
            _exit('Activation code/email not valid.')

    @classmethod
    def reset(cls):
        Credentials._singleton = None
        c = Credentials()
        try:
            os.remove(c._conf_file)
        except OSError as e:
            LOGGER.error('Error removing credentials file: %s' % e)

    def activate(self):
        try:
            self.load()
        except RuntimeError:
            pass

        if self.activation:
            if self.activation.valid:
                _exit('Already activated')
            else:
                _exit(
                    'Activation not valid. Please run '
                    '`streamlit activate reset` then `streamlit activate`'
                )


def generate_code(secret, email):
    secret = secret.encode('utf-8')
    email = email.encode('utf-8')

    salt = hmac.new(secret, email, hashlib.sha512).hexdigest()[0:4]
    salt_encoded = salt.encode('utf-8')
    hash = hmac.new(salt_encoded, email, hashlib.md5).hexdigest()[0:4]

    code = base58.b58encode(salt + hash)
    return code.decode('utf-8')


def verify_code(email, code):
    # Python2/3 Madness
    email_encoded = email
    code_encoded = code
    if sys.version_info >= (3, 0):
        email_encoded = email.encode('utf-8')
    else:
        code_encoded = code.encode('utf-8')  # pragma: nocover

    try:
        decoded = base58.b58decode(code_encoded)

        salt, hash = decoded[0:4], decoded[4:8]

        calculated_hash = hmac.new(salt, email_encoded,
                                   hashlib.md5).hexdigest()

        if hash.decode('utf-8') == calculated_hash[0:4]:
            return Activation(code, email, True)
        else:
            return Activation(code, email, False)

    except Exception as e:
        LOGGER.error('Unable to verify code: %s', e)
        return Activation(None, None, None)


def _exit(message):  # pragma: nocover
    LOGGER.error(message)
    sys.exit(-1)
