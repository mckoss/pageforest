from datetime import datetime

from google.appengine.api import memcache

from django.conf import settings
from django.test import TestCase, Client

from utils import crypto

from auth.models import User
from apps.models import App
from storage.models import KeyValue


class AppTestCase(TestCase):
    """TestCase with automatic test app."""

    def setUp(self):
        self.peter = User(key_name='peter', username='Peter')
        self.peter.set_password('SecreT!1')
        self.peter.put()
        self.app = App(key_name='app',
                       domains=['app.pageforest.com'],
                       secret="SecreT!1")
        self.app.put()
        # Authenticate.
        self.auth = Client(HTTP_HOST='auth.' + self.app.domains[0])
        challenge = self.auth.get('/challenge').content
        signed = crypto.sign(challenge, self.peter.password)
        data = crypto.join(self.peter.username, signed)
        session_key = self.auth.get('/verify/' + data).content
        self.app_client = Client(HTTP_HOST=self.app.domains[0])
        self.app_client.cookies[settings.SESSION_COOKIE_NAME] = session_key


class KeyValueTest(AppTestCase):

    def setUp(self):
        super(KeyValueTest, self).setUp()
        self.key = 'app/data/key'
        self.value = '<div>{"outside": "HTML", "inside": "JSON"}</div>\n'
        self.data = KeyValue(key_name=self.key, value=self.value)
        self.data.put()

    def test_get_by_key_name(self):
        """Test that get_by_key_name correctly retrieves entity."""
        data = KeyValue.get_by_key_name(self.key)
        self.assertEqual(data.key().name(), self.key)
        self.assertEqual(data.value, self.value)

    def test_get_absolute_url(self):
        """Test the get_absolute_url method."""
        self.assertEqual(self.data.get_absolute_url(),
                         'http://app.pageforest.com/docs/data/key')


class ClientErrorTest(AppTestCase):

    def test_get_404(self):
        """Tests that non-existent data returns 404 Not Found."""
        response = self.app_client.get('/docs/data/does_not_exist/')
        self.assertEqual(response.status_code, 404)

    def test_not_allowed(self):
        """Tests that unknown methods return 405 Method Not Allowed."""
        response = self.app_client.options('/docs/data/key')
        self.assertEqual(response.status_code, 405)
        self.assertEqual(response['Allow'],
                         'DELETE, GET, HEAD, PUSH, PUT, SLICE')
        response = self.app_client.get('/docs/data/key?method=FOOBAR')
        self.assertEqual(response.status_code, 405)


class RestApiTest(AppTestCase):

    def test_crud(self):
        """Tests create, read, update, delete with REST API."""
        key_name = 'app/doc/key'
        self.assertEqual(KeyValue.get_by_key_name(key_name), None)
        # Create.
        url = '/docs/doc/key'
        response = self.app_client.put(url, 'data',
                                       content_type='text/plain')
        self.assertContains(response, '"statusText": "Saved"')
        self.assertEqual(KeyValue.get_by_key_name(key_name).value, 'data')
        # Read.
        response = self.app_client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, 'data')
        # Update.
        response = self.app_client.put(url, 'updated',
                                       content_type='text/plain')
        self.assertContains(response, '"statusText": "Saved"')
        self.assertEqual(KeyValue.get_by_key_name(key_name).value, 'updated')
        # Delete.
        response = self.app_client.delete(url)
        self.assertContains(response, '"statusText": "Deleted"')
        self.assertEqual(KeyValue.get_by_key_name(key_name), None)


class JsonpApiTest(AppTestCase):

    def test_crud(self):
        """Tests create, read, update, delete with JSONP API."""
        key_name = 'app/doc/key'
        self.assertEqual(KeyValue.get_by_key_name(key_name), None)
        # Create.
        url = '/docs/doc/key'
        response = self.app_client.get(url + '?method=PUT&value=data')
        self.assertContains(response, '"statusText": "Saved"')
        self.assertEqual(KeyValue.get_by_key_name(key_name).value, 'data')
        # Read.
        response = self.app_client.get(url + '?method=GET&callback=func')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, 'func("data")')
        self.assertEqual(response['Content-Type'], 'application/javascript')
        # Update.
        response = self.app_client.get(url + '?method=PUT&value=updated')
        self.assertContains(response, '"statusText": "Saved"')
        self.assertEqual(KeyValue.get_by_key_name(key_name).value, 'updated')
        # Delete.
        response = self.app_client.get(url + '?method=DELETE')
        self.assertContains(response, '"statusText": "Deleted"')
        self.assertEqual(KeyValue.get_by_key_name(key_name), None)


class HostTest(AppTestCase):

    def setUp(self):
        super(HostTest, self).setUp()
        self.other = App(key_name='other',
                         domains=['other.pageforest.com'],
                         secret='OtherSecreT')
        self.other.put()
        # Authenticate.
        self.other_auth = Client(HTTP_HOST='auth.' + self.other.domains[0])
        challenge = self.auth.get('/challenge').content
        signed = crypto.sign(challenge, self.peter.password)
        data = crypto.join(self.peter.username, signed)
        session_key = self.other_auth.get('/verify/' + data).content
        self.other_client = Client(HTTP_HOST=self.other.domains[0])
        self.other_client.cookies[settings.SESSION_COOKIE_NAME] = session_key

    def test_host(self):
        """Test namespace isolation with Host header."""
        url = '/docs/doc/key'
        response = self.other_client.put(url, 'o', content_type='text/plain')
        self.assertContains(response, '"statusText": "Saved"')
        self.assertEqual(KeyValue.get_by_key_name('other/doc/key').value, 'o')
        # GET with the same host header should work.
        response = self.other_client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, 'o')
        # GET without host header should fail with 404 Not Found.
        response = self.app_client.get(url)
        self.assertEqual(response.status_code, 404)


class MemcacheTest(AppTestCase):

    def assertProtoBuf(self, binary, data=None):
        """Check binary protocol buffer."""
        self.assertTrue(binary is not None)
        self.assertEqual(binary.count('pageforest'), 1)
        self.assertEqual(binary.count('KeyValue'), 2)
        self.assertEqual(binary.count('app/doc/key/with/slashes'), 2)
        self.assertEqual(binary.count('created'), 2)
        self.assertEqual(binary.count('created_ip'), 1)
        self.assertEqual(binary.count('modified'), 2)
        self.assertEqual(binary.count('modified_ip'), 1)
        if data:
            self.assertEqual(binary.count(data), 1)

    def test_crud(self):
        """Tests create, read, update, delete with memcache."""
        url = '/docs/doc/key/with/slashes'
        key_name = 'app/doc/key/with/slashes'
        cache_key = 'C1~KeyValue~' + key_name
        self.assertEqual(memcache.get(cache_key), None)
        # Create.
        self.app_client.put(url, 'data', content_type='text/plain')
        self.assertEqual(KeyValue.get_by_key_name(key_name).value, 'data')
        binary = memcache.get(cache_key)
        self.assertProtoBuf(binary, 'data')
        # Make sure it reads from memcache if possible.
        binary = binary.replace('data', 'ofop')
        memcache.set(cache_key, binary, 300)
        response = self.app_client.get(url)
        self.assertEqual(response.content, 'ofop')
        # Make sure that GET saves to memcache if necessary.
        memcache.delete(cache_key)
        self.assertEqual(memcache.get(cache_key), None)
        response = self.app_client.get(url)
        self.assertProtoBuf(memcache.get(cache_key))
        # Update.
        self.app_client.put(url, 'updated', content_type='text/plain')
        self.assertProtoBuf(memcache.get(cache_key), 'updated')
        # Delete.
        self.app_client.delete(url)
        self.assertEqual(memcache.get(cache_key), None)


class MimeTest(AppTestCase):

    def put_and_get(self, path):
        """Helper function for MIME tests."""
        self.app_client.put(path, 'data', content_type='text/plain')
        return self.app_client.get(path)

    def test_html(self):
        """Test that the mime type is guessed correctly for HTML."""
        response = self.put_and_get('/doc/index.html')
        self.assertContains(response, 'data')
        self.assertEqual(response['Content-Type'], 'text/html')

    def test_css(self):
        """Test that the mime type is guessed correctly for CSS."""
        response = self.put_and_get('/doc/css/style.css')
        self.assertEqual(response['Content-Type'], 'text/css')

    def test_js(self):
        """Test that the mime type is guessed correctly for JS."""
        response = self.put_and_get('/doc/js/test.js')
        self.assertEqual(response['Content-Type'], 'application/javascript')

    def test_json(self):
        """Test that the mime type is guessed correctly for JSON."""
        response = self.put_and_get('/data/test.json')
        self.assertEqual(response['Content-Type'], 'application/json')

    def test_jpg(self):
        """Test that the mime type is guessed correctly for JPG."""
        response = self.put_and_get('/doc/images/test.jpg')
        self.assertEqual(response['Content-Type'], 'image/jpeg')

    def test_png(self):
        """Test that the mime type is guessed correctly for PNG."""
        response = self.put_and_get('/doc/images/test.png')
        self.assertEqual(response['Content-Type'], 'image/png')

    def test_ico(self):
        """Test that the mime type is guessed correctly for ICO."""
        response = self.put_and_get('/doc/favicon.ico')
        self.assertEqual(response['Content-Type'], 'image/vnd.microsoft.icon')


class JsonArrayTest(AppTestCase):

    def setUp(self):
        """Prepare a simple chat array."""
        super(JsonArrayTest, self).setUp()
        self.chat = KeyValue(key_name='app/doc/chat',
                             value='["hello", "hi", "howdy"]')
        self.chat.put()

    def assertContent(self, url, content):
        """Get array content and compare with expected value."""
        response = self.app_client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, content)

    def test_last(self):
        """Test that the end of the array can be retrieved."""
        url = '/docs/doc/chat'
        self.assertContent(url + '?method=SLICE', '["hello", "hi", "howdy"]')
        self.assertContent(url + '?method=SLICE&start=-1', '["howdy"]')
        self.assertContent(url + '?method=SLICE&start=-2', '["hi", "howdy"]')
        self.assertContent(url + '?method=SLICE&start=-3',
                           '["hello", "hi", "howdy"]')
        self.assertContent(url + '?method=SLICE&start=-4',
                           '["hello", "hi", "howdy"]')
        self.assertContent(url + '?method=SLICE&start=-999999999999999999',
                           '["hello", "hi", "howdy"]')

    def test_push(self):
        """Test that push appends to the end af the array."""
        started = datetime.now()
        response = self.app_client.post('/docs/doc/chat?method=PUSH',
                                        data='bye', content_type="text/plain")
        self.assertContains(response, '"statusText": "Pushed"')
        self.assertContains(response, '"newLength": 4')
        self.assertContent('/docs/doc/chat?method=SLICE&start=-2',
                           '["howdy", "bye"]')
        chat = KeyValue.get_by_key_name('app/doc/chat')
        self.assertTrue(chat.created <= started)
        self.assertTrue(chat.modified >= started)

    def test_push_empty(self):
        """Test that push creates the array if it didn't exist."""
        started = datetime.now()
        response = self.app_client.post('/docs/doc2/chat?method=PUSH',
                                        data='hi', content_type="text/plain")
        self.assertContains(response, '"statusText": "Pushed"')
        self.assertContains(response, '"newLength": 1')
        self.assertContent('/docs/doc2/chat', '["hi"]')
        newchat = KeyValue.get_by_key_name('app/doc2/chat')
        self.assertTrue(newchat.created >= started)
        self.assertTrue(newchat.modified >= started)

    def test_push_max(self):
        """Test that push appends to the end af the array."""
        response = self.app_client.post('/docs/doc/chat?method=PUSH&max=3',
                                        data='bye', content_type="text/plain")
        self.assertContains(response, '"statusText": "Pushed"')
        self.assertContains(response, '"newLength": 3')
        self.assertContent('/docs/doc/chat', '["hi", "howdy", "bye"]')
