# -*- coding: future_fstrings -*-

"""A library of useful utilities."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import hashlib
import inspect
import os
import pickle
import re
import shutil

from functools import wraps

import streamlit as st
from streamlit.util import streamlit_read, streamlit_write
from streamlit.util import __STREAMLIT_LOCAL_ROOT as local_root
from streamlit.logger import get_logger

LOGGER = get_logger()

def cache(func):
	"""A function decorator which enables the function to cache its
	input/output behavior to disk."""

	CACHE_PATH = '.streamlit'

	@wraps(func)
	def wrapped_func(*argc, **argv):
		"""This function wrapper will only call the underlying function in
		the case of a cache miss. Cached objects are stored in the cache/
		directory."""
		# Temporarily display this message while computing this function.
		if len(argc) == 0 and len(argv == 0):
			message = f'Caching {func.__name__}().'
		else:
			message = f'Caching {func.__name__}(...).'
		with st.spinner(message):
			# Calculate the filename hash.
			hasher = hashlib.new('md5')
			LOGGER.debug('Created the hasher. (%s)' % func.__name__)
			arg_string = pickle.dumps([argc, argv], pickle.HIGHEST_PROTOCOL)
			LOGGER.debug('Hashing %i bytes. (%s)' % (len(arg_string), func.__name__))
			hasher.update(arg_string)
			hasher.update(inspect.getsource(func).encode('utf-8'))
			path = f'cache/f{hasher.hexdigest()}.pickle'
			LOGGER.debug('Cache filename: ' + path)

			# Load the file (hit) or compute the function (miss)
			try:
				with streamlit_read(path, binary=True) as input:
					rv = pickle.load(input)
					LOGGER.debug('Cache HIT: ' + str(type(rv)))
			except FileNotFoundError:
				rv = func(*argc, **argv)
				with streamlit_write(path, binary=True) as output:
					pickle.dump(rv, output, pickle.HIGHEST_PROTOCOL)
				LOGGER.debug('Cache MISS: ' + str(type(rv)))
		return rv

	# make this a well-behaved decorator by preserving important function attributes
	try:
		wrapped_func.__dict__.update(func.__dict__)
	except AttributeError:
		pass

	# return the funciton which wraps our function
	return wrapped_func

def clear_cache(verbose=False):
	"""Clears the memoization cache."""
	cache_path = os.path.join(local_root, 'cache')
	if os.path.isdir(cache_path):
		shutil.rmtree(cache_path)
		if verbose:
			print(f'Cleared {cache_path} directory.')
	elif verbose:
		print(f'No such directory {cache_path} so nothing to clear. :)')

# def timed_iter(iterator, length=None, interval=60.0):
# 	"""Takes an iterator and returns an iterator which prints out
# 	estimated time remaining each interval seconds.
#
# 	iterator - the iterable object (or an int for xrange behavior)
# 	length   - the length of iterator, if len(iterator) doesn't work
# 	interval - the interval to display information
# 	"""
# 	import time
#
# 	# figure out how many iterations are required
# 	if type(iterator) == int:
# 		length = iterator
# 		iterator = range(iterator)
# 	elif length == None:
# 		length = len(iterator)
#
# 	# iterate estimating runtime
# 	start_time = time.time()
# 	prev_time = start_time
# 	for ii, xx in enumerate(iterator):
# 		curr_time = time.time()
# 		if curr_time - prev_time > interval:
# 			elapsed = curr_time - start_time
# 			complete = ii / float(length)
# 			estimated = elapsed * (1.0 - complete) / complete
# 			print('%.2i%% - % 7s (elapsed) - % 7s (remain) - % 7s (total)' % \
# 				(int(complete * 100),
# 				readable_time(elapsed),
# 				readable_time(estimated),
# 				readable_time(elapsed + estimated)))
# 			prev_time = curr_time
# 		yield xx
#
# def timed_function(func):
# 	"""A function decorator which simply measures the amount of time it
# 	takes a function to execute."""
# 	import time
#
# 	def wrapped_func(*argc, **argv):
# 		# call the function, measuring the elapsed time
# 		start_time = time.time()
# 		rv = func(*argc, **argv)
# 		delta = time.time() - start_time
#
# 		# write the elapsed time
# 		print('%s() : %s (%s)' % (func.__name__, readable_time(delta), delta))
#
# 		# all done
# 		return rv
#
# 	# make this a well-behaved decorator by preserving important function attributes
# 	try:
# 		wrapped_func.__name__ = func.__name__
# 		wrapped_func.__doc__ = func.__doc__
# 		wrapped_func.__dict__.update(func.__dict__)
# 	except AttributeError:
# 		pass
#
# 	# return the funciton which wraps our function
# 	return wrapped_func
#
# @timed_function
# def example(xx):
# 	the_list = []
# 	for ii in timed_iter(list(range(xx)), interval=1):
# 		the_list.append(ii)
#
# def unit_test():
# 	print(example(int(1e8)))
#
# if __name__ == '__main__':
# 	unit_test()
