# Copyright 2019 Streamlit Inc. All rights reserved.
"""Manage the user's Streamlit credentials."""
from collections import namedtuple
import hashlib
import hmac
import os
import sys
import textwrap

import click
import base58
import toml

from streamlit.logger import get_logger
from streamlit import util

LOGGER = get_logger(__name__)

Activation = namedtuple('Activation', [
    'code',  # str: the user's activation code, sent via email.
    'email',  # str : the user's email.
    'is_valid',  # boolean : whether the code+email combination is valid.
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
        self._conf_file = util.get_streamlit_file_path('credentials.toml')

        Credentials._singleton = self

    def load(self, auto_resolve=False):
        """Load from toml file."""
        if self.activation is not None:
            LOGGER.error('Credentials already loaded. Not rereading file.')
            return

        try:
            with open(self._conf_file, 'r') as f:
                data = toml.load(f).get('general')
            self.activation = _verify_code(
                data['email'], getattr(data, 'code', None))
        except FileNotFoundError:
            if auto_resolve:
                return self.activate(show_instructions=not auto_resolve)
            raise RuntimeError(
                'Credentials not found. Please run "streamlit activate".')
        except Exception as e:
            if auto_resolve:
                self.reset()
                return self.activate(show_instructions=not auto_resolve)
            raise Exception(textwrap.dedent('''
                Unable to load credentials from %s.
                Run "streamlit reset" and try again.
                ''') % (self._conf_file))

    def check_activated(self, auto_resolve=False):
        """Check if streamlit is activated.

        Used by `streamlit run script.py`
        """
        try:
            self.load(auto_resolve)
        except (Exception, RuntimeError) as e:
            _exit(str(e))

        if not self.activation.is_valid:
            _exit('Activation code/email not valid.')

    @classmethod
    def reset(cls):
        """Reset credentials by removing file.

        This is used by `streamlit activate reset` in case a user wants
        to start over.
        """
        Credentials._singleton = None
        c = Credentials()
        try:
            os.remove(c._conf_file)
        except OSError as e:
            LOGGER.error('Error removing credentials file: %s' % e)

    def save(self):
        """Save to toml file."""
        data = {
            'email': self.activation.email,
            'code': self.activation.code,
        }
        with open(self._conf_file, 'w') as f:
            toml.dump({'general': data}, f)

    def activate(self, show_instructions=True):
        """Activate Streamlit.

        Used by `streamlit activate`.
        """
        try:
            self.load()
        except RuntimeError:
            pass

        if self.activation:
            if self.activation.is_valid:
                _exit('Already activated')
            else:
                _exit(
                    'Activation not valid. Please run '
                    '`streamlit activate reset` then `streamlit activate`'
                )
        else:
            activated = False

            while not activated:
                code = None  #code = _get_data('Enter your invite code')
                email = _get_data('Enter your email for access to our beta')

                self.activation = _verify_code(email, code)
                if self.activation.is_valid:
                    self.save()
                    click.secho('')
                    click.secho('  Welcome to Streamlit!', fg='green')
                    click.secho('')
                    if show_instructions:
                        click.secho('  Get started by typing:')
                        click.secho('  $ ', nl=False)
                        click.secho('streamlit hello', bold=True)
                        click.secho('')
                    activated = True
                else:  # pragma: nocover
                    LOGGER.error('Please try again.')


def _generate_code(secret, email):
    """Generate code for activation.

    This is here so streamlit developers can create activation codes if
    needed that are not in the spreadsheet.
    """
    secret = secret.encode('utf-8')
    email = email.encode('utf-8')

    salt = hmac.new(secret, email, hashlib.sha512).hexdigest()[0:4]
    salt_encoded = salt.encode('utf-8')
    hash = hmac.new(salt_encoded, email, hashlib.md5).hexdigest()[0:4]

    code = base58.b58encode(salt + hash)
    return code.decode('utf-8')


def _verify_code(email, code):
    """Verify activation code with email."""
    # Bypass code verification for now.
    if email.count('@') != 1:
        LOGGER.error('That doesn\'t look like an email :(')
        return Activation(None, None, None)

    if code == None:
        return Activation(None, email, True)

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
    """Exit program with error."""
    LOGGER.error(message)
    sys.exit(-1)


def _get_data(msg):
    """Utility to get data from console."""
    data = None
    while not data:
        if sys.version_info >= (3, 0):
            data = input('%s: ' % msg)
        else:  # pragma: nocover
            data = raw_input('%s: ' % msg)  # noqa: F821
    return data
