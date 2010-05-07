from datetime import datetime

from google.appengine.api import memcache

from django.conf import settings
from django.test import TestCase, Client

from auth.models import User
from apps.models import App
from docs.models import Doc
from blobs.models import Blob


class AppTestCase(TestCase):
    """TestCase with automatic test app."""

    def setUp(self):
        self.peter = User(key_name='peter', username='Peter')
        self.peter.set_password('SecreT!1')
        self.peter.put()
        self.app = App(key_name='myapp',
                       domains=['myapp.pageforest.com'],
                       secret="SecreT!1")
        self.app.put()
        self.doc = Doc(key_name='myapp/mydoc', doc_id='MyDoc',
                       readers=['anybody'], writers=['peter'])
        self.doc.put()
        self.app_client = Client(HTTP_HOST=self.app.domains[0])
        self.app_client.cookies[settings.SESSION_COOKIE_NAME] = \
            self.peter.generate_session_key(self.app)


class BlobTest(AppTestCase):

    def setUp(self):
        super(BlobTest, self).setUp()
        self.key_name = 'myapp/mydoc/key/'
        self.value = '<div>{"outside": "HTML", "inside": "JSON"}</div>\n'
        self.blob = Blob(key_name=self.key_name, value=self.value)
        self.blob.put()

    def test_get_by_key_name(self):
        """The get_by_key_name method should return the blob."""
        blob = Blob.get_by_key_name(self.key_name)
        self.assertEqual(blob.key().name(), self.key_name)
        self.assertEqual(blob.value, self.value)

    def test_get_absolute_url(self):
        """The get_absolute_url method should return the correct path."""
        self.assertEqual(self.blob.get_absolute_url(),
                         'http://myapp.pageforest.com/docs/mydoc/key/')


class ClientErrorTest(AppTestCase):

    def test_get_404(self):
        """Non-existent blob access should return 404 Not Found."""
        response = self.app_client.get('/docs/mydoc/does_not_exist/')
        self.assertContains(response,
            "Blob not found: myapp/mydoc/does_not_exist/", status_code=404)

    def test_http_method_not_allowed(self):
        """Unknown HTTP method should return 405 Method Not Allowed."""
        response = self.app_client.options('/docs/mydoc/key')
        self.assertEqual(response.status_code, 405)
        self.assertEqual(response['Allow'],
                         'DELETE, GET, HEAD, PUSH, PUT, SLICE')

    def test_query_string_method_not_allowed(self):
        """Unknown query string method should return 405 Method Not Allowed."""
        response = self.app_client.get('/docs/mydoc/key?method=FOOBAR')
        self.assertEqual(response.status_code, 405)
        self.assertEqual(response['Allow'],
                         'DELETE, GET, HEAD, PUSH, PUT, SLICE')


class RestApiTest(AppTestCase):

    def test_crud(self):
        """Tests create, read, update, delete with REST API."""
        key_name = 'myapp/mydoc/key/'
        self.assertEqual(Blob.get_by_key_name(key_name), None)
        # Create.
        url = '/docs/mydoc/key'
        response = self.app_client.put(url, 'data',
                                       content_type='text/plain')
        self.assertContains(response, '"statusText": "Saved"')
        self.assertEqual(Blob.get_by_key_name(key_name).value, 'data')
        # Read.
        response = self.app_client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, 'data')
        # Update.
        response = self.app_client.put(url, 'updated',
                                       content_type='text/plain')
        self.assertContains(response, '"statusText": "Saved"')
        self.assertEqual(Blob.get_by_key_name(key_name).value, 'updated')
        # Delete.
        response = self.app_client.delete(url)
        self.assertContains(response, '"statusText": "Deleted"')
        self.assertEqual(Blob.get_by_key_name(key_name), None)


class JsonpApiTest(AppTestCase):

    def test_crud(self):
        """Tests create, read, update, delete with JSONP API."""
        key_name = 'myapp/mydoc/key/'
        self.assertEqual(Blob.get_by_key_name(key_name), None)
        # Create.
        url = '/docs/mydoc/key'
        response = self.app_client.get(url + '?method=PUT&value=data')
        self.assertContains(response, '"statusText": "Saved"')
        self.assertEqual(Blob.get_by_key_name(key_name).value, 'data')
        # Read.
        response = self.app_client.get(url + '?method=GET&callback=func')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, 'func("data")')
        self.assertEqual(response['Content-Type'], 'application/javascript')
        # Update.
        response = self.app_client.get(url + '?method=PUT&value=updated')
        self.assertContains(response, '"statusText": "Saved"')
        self.assertEqual(Blob.get_by_key_name(key_name).value, 'updated')
        # Delete.
        response = self.app_client.get(url + '?method=DELETE')
        self.assertContains(response, '"statusText": "Deleted"')
        self.assertEqual(Blob.get_by_key_name(key_name), None)


class HostTest(AppTestCase):

    def setUp(self):
        super(HostTest, self).setUp()
        self.other = App(key_name='other',
                         domains=['other.pageforest.com'],
                         secret='OtherSecreT')
        self.other.put()
        self.otherdoc = Doc(key_name='other/mydoc', doc_id='MyDoc',
                            readers=['authenticated'],
                            writers=['paul', 'peter'])
        self.otherdoc.put()
        self.other_client = Client(HTTP_HOST=self.other.domains[0])
        self.other_client.cookies[settings.SESSION_COOKIE_NAME] = \
            self.peter.generate_session_key(self.other)

    def test_host(self):
        """Test namespace isolation with Host header."""
        url = '/docs/mydoc/key'
        response = self.other_client.put(url, 'otherdata',
                                         content_type='text/plain')
        self.assertContains(response, '"statusText": "Saved"')
        self.assertEqual(Blob.get_by_key_name('other/mydoc/key/').value,
                         'otherdata')
        # GET with the same host header should work.
        response = self.other_client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, 'otherdata')
        # GET without host header should fail with 404 Not Found.
        response = self.app_client.get(url)
        self.assertEqual(response.status_code, 404)


class MemcacheTest(AppTestCase):

    def assertProtoBuf(self, binary, data=None):
        """Check binary protocol buffer."""
        self.assertTrue(binary is not None)
        self.assertEqual(binary.count('pageforest'), 1)
        self.assertEqual(binary.count('Blob'), 2)
        self.assertEqual(binary.count('myapp/mydoc/key/with/slashes/'), 2)
        self.assertEqual(binary.count('created'), 2)
        self.assertEqual(binary.count('created_ip'), 1)
        self.assertEqual(binary.count('modified'), 2)
        self.assertEqual(binary.count('modified_ip'), 1)
        if data:
            self.assertEqual(binary.count(data), 1)

    def test_crud(self):
        """Tests create, read, update, delete with memcache."""
        url = '/docs/mydoc/key/with/slashes'
        key_name = 'myapp/mydoc/key/with/slashes/'
        cache_key = 'C1~Blob~' + key_name
        self.assertEqual(memcache.get(cache_key), None)
        # Create.
        self.app_client.put(url, 'data', content_type='text/plain')
        self.assertEqual(Blob.get_by_key_name(key_name).value, 'data')
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
        response = self.put_and_get('/index.html')
        self.assertContains(response, 'data')
        self.assertEqual(response['Content-Type'], 'text/html')
        # Try again with the top-level alias for index.html.
        response = self.app_client.get('/')
        self.assertContains(response, 'data')
        self.assertEqual(response['Content-Type'], 'text/html')

    def test_css(self):
        """Test that the mime type is guessed correctly for CSS."""
        response = self.put_and_get('/styles/css/style.css')
        self.assertEqual(response['Content-Type'], 'text/css')

    def test_js(self):
        """Test that the mime type is guessed correctly for JS."""
        response = self.put_and_get('/scripts/test.js')
        self.assertEqual(response['Content-Type'], 'application/javascript')

    def test_json(self):
        """Test that the mime type is guessed correctly for JSON."""
        response = self.put_and_get('/extra/test.json')
        self.assertEqual(response['Content-Type'], 'application/json')

    def test_jpg(self):
        """Test that the mime type is guessed correctly for JPG."""
        response = self.put_and_get('/images/test.jpg')
        self.assertEqual(response['Content-Type'], 'image/jpeg')

    def test_png(self):
        """Test that the mime type is guessed correctly for PNG."""
        response = self.put_and_get('/images/test.png')
        self.assertEqual(response['Content-Type'], 'image/png')

    def test_ico(self):
        """Test that the mime type is guessed correctly for ICO."""
        response = self.put_and_get('/favicon.ico')
        self.assertEqual(response['Content-Type'], 'image/vnd.microsoft.icon')


class JsonArrayTest(AppTestCase):

    def setUp(self):
        """Prepare a simple chat array."""
        super(JsonArrayTest, self).setUp()
        self.chat = Blob(key_name='myapp/mydoc/chat/',
                             value='["hello", "hi", "howdy"]')
        self.chat.put()

    def assertContent(self, url, content):
        """Get array content and compare with expected value."""
        response = self.app_client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, content)

    def test_last(self):
        """Test that the end of the array can be retrieved."""
        url = '/docs/mydoc/chat'
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
        response = self.app_client.post('/docs/mydoc/chat?method=PUSH',
                                        data='bye', content_type="text/plain")
        self.assertContains(response, '"statusText": "Pushed"')
        self.assertContains(response, '"newLength": 4')
        self.assertContent('/docs/mydoc/chat?method=SLICE&start=-2',
                           '["howdy", "bye"]')
        chat = Blob.get_by_key_name('myapp/mydoc/chat/')
        self.assertTrue(chat.created <= started)
        self.assertTrue(chat.modified >= started)

    def test_push_empty(self):
        """Test that push creates the array if it didn't exist."""
        started = datetime.now()
        response = self.app_client.post('/docs/mydoc/chat2?method=PUSH',
                                        data='hi', content_type="text/plain")
        self.assertContains(response, '"statusText": "Pushed"')
        self.assertContains(response, '"newLength": 1')
        self.assertContent('/docs/mydoc/chat2', '["hi"]')
        newchat = Blob.get_by_key_name('myapp/mydoc/chat2/')
        self.assertTrue(newchat.created >= started)
        self.assertTrue(newchat.modified >= started)

    def test_push_max(self):
        """Test that push appends to the end af the array."""
        response = self.app_client.post('/docs/mydoc/chat?method=PUSH&max=3',
                                        data='bye', content_type="text/plain")
        self.assertContains(response, '"statusText": "Pushed"')
        self.assertContains(response, '"newLength": 3')
        self.assertContent('/docs/mydoc/chat', '["hi", "howdy", "bye"]')
