"""Logging module."""
import inspect
import logging
import sys

LOGGERS = {}
LOG_LEVEL = logging.DEBUG


def set_log_level(level):
    """Set log level."""
    logger = get_logger()

    if isinstance(level, str):
        level = level.upper()
    if level == 'CRITICAL' or level == logging.CRITICAL:
        log_level = logging.CRITICAL
        logger.debug('log level set to CRITICAL')
    elif level == 'ERROR' or level == logging.ERROR:
        log_level = logging.ERROR
        logger.debug('log level set to ERROR')
    elif level == 'WARNING' or level == logging.WARNING:
        log_level = logging.WARNING
        logger.debug('log level set to WARNING')
    elif level == 'INFO' or level == logging.INFO:
        log_level = logging.INFO
        logger.debug('log level set to INFO')
    elif level == 'DEBUG' or level == logging.DEBUG:
        log_level = logging.DEBUG
        logger.debug('log level set to DEBUG')
    else:
        msg = 'undefined log level "{}"'.format(level)
        logger.critical(msg)
        sys.exit(1)

    for log in LOGGERS.values():
        log.setLevel(log_level)

    global LOG_LEVEL
    LOG_LEVEL = log_level


def init_aiohttp_logs():
    """Initialize aiohttp logs."""
    global LOGGER

    # https://docs.aiohttp.org/en/stable/logging.html
    logs = ['access', 'client', 'internal', 'server', 'web', 'websocket']
    for log in logs:
        name = 'aiohttp.{}'.format(log)
        get_logger(name)

    logger = get_logger()
    logger.debug('Initialized aiohttp logs')


def init_tornado_logs():
    """Initialize tornado logs."""
    global LOGGER

    # http://www.tornadoweb.org/en/stable/log.html
    logs = ['access', 'application', 'general']
    for log in logs:
        name = 'tornado.{}'.format(log)
        get_logger(name)

    logger = get_logger()
    logger.debug('Initialized tornado logs')


def get_logger(name=None):
    """Return a logger."""
    global LOG_LEVEL

    if not name:
        caller = sys._getframe(1)

        filename = inspect.getfile(caller)
        module = inspect.getmodule(caller)

        package = module.__package__
        if package is None:
            package = ''
        modulename = inspect.getmodulename(filename)

        name = '.'.join([package, modulename])

    if name in LOGGERS.keys():
        return LOGGERS[name]

    formatter = logging.Formatter(
        fmt='%(asctime)s.%(msecs)03d %(levelname)s:%(name)s:%(message)s',
        datefmt='%Y-%m-%d, %H:%M:%S')

    console = logging.StreamHandler()
    console.setFormatter(formatter)

    if name == 'root':
        log = logging.getLogger()
    else:
        log = logging.getLogger(name)

    log.setLevel(LOG_LEVEL)
    log.propagate = False
    log.addHandler(console)

    LOGGERS[name] = log

    return log
