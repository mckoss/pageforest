import os
import imp
import doctest

from django.test import TestCase


class DocTest(TestCase):

    def has_doctest_testmod(self, filename):
        for line in file(filename):
            if line.strip() == 'doctest.testmod()':
                return True

    def test_utils(self):
        dir = os.path.dirname(__file__)
        for filename in os.listdir(dir):
            if not filename.endswith('.py'):
                continue
            full_path = os.path.join(dir, filename)
            if not self.has_doctest_testmod(full_path):
                continue
            base, ext = os.path.splitext(filename)
            fm = imp.find_module(base, [dir])
            mod = imp.load_module('utils.' + base, *fm)
            failures, tests = doctest.testmod(mod)
            self.assertEqual(failures, 0)
