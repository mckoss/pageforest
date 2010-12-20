from django.conf import settings
from django.test import Client

from apps.tests import AppTestCase

from apps.models import App
from blobs.models import Blob


class MirrorTest(AppTestCase):

    def setUp(self):
        super(MirrorTest, self).setUp()
        self.editor = App(key_name='editor', readers=['public'])
        self.editor.put()
        App(key_name='other', readers=['authenticated']).put()
        Blob(key_name='apps/other/index.html/', value='<html>').put()

    def test_editor(self):
        """The editor app should include /mirror/ with other apps."""
        editor_client = Client(
            HTTP_HOST='editor.pageforest.com',
            HTTP_REFERER='http://editor.pageforest.com/')
        editor_client.cookies[settings.SESSION_COOKIE_NAME] = \
            self.peter.generate_session_key(self.editor)
        self.assertContains(
            editor_client.get('/mirror/other/index.html'),
            '<html>')
        result = editor_client.get('/mirror?method=list')
        print result
        self.assertContains(result, \
"""{
  "items": {
    "myapp": {
      "cloneable": false,""")

    def test_untrusted(self):
        """The prefix filter should return only matching blobs."""
        self.assertContains(
            self.app_client.get('/mirror/other/index.html'),
            "Mirror is only available on trusted apps.",
            status_code=403)
