from datetime import datetime

from google.appengine.api import memcache

from django.test import TestCase, Client

from apps.models import App
from storage.models import KeyValue


class AppTestCase(TestCase):
    """TestCase with automatic test app."""

    def setUp(self):
        self.meta = App(key_name='meta',
                        domain='meta.pageforest.com')
        self.meta.put()
        self.app = App(key_name='test',
                       domain='test.pageforest.com',
                       alt_domains=['testserver'])
        self.app.put()


class KeyValueTest(AppTestCase):

    def setUp(self):
        super(KeyValueTest, self).setUp()
        self.key = 'test/data/key'
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
                         'http://test.pageforest.com/data/key')


class ClientErrorTest(AppTestCase):

    def test_get_404(self):
        """Tests that non-existent data returns 404 Not Found."""
        response = self.client.get('/data/does_not_exist/')
        self.assertEqual(response.status_code, 404)

    def test_not_allowed(self):
        """Tests that unknown methods return 405 Method Not Allowed."""
        response = self.client.options('/data/key')
        self.assertEqual(response.status_code, 405)
        self.assertEqual(response['Allow'],
                         'DELETE, GET, HEAD, PUSH, PUT, SLICE')
        response = self.client.get('/data/key?method=FOOBAR')
        self.assertEqual(response.status_code, 405)


class RestApiTest(AppTestCase):

    def test_crud(self):
        """Tests create, read, update, delete with REST API."""
        key_name = 'test/data/entity'
        self.assertEqual(KeyValue.get_by_key_name(key_name), None)
        # Create.
        response = self.client.put('/data/entity', 'data',
                                   content_type='text/plain')
        self.assertContains(response, '"statusText": "Saved"')
        self.assertEqual(KeyValue.get_by_key_name(key_name).value, 'data')
        # Read.
        response = self.client.get('/data/entity')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, 'data')
        # Update.
        response = self.client.put('/data/entity', 'updated',
                                   content_type='text/plain')
        self.assertContains(response, '"statusText": "Saved"')
        self.assertEqual(KeyValue.get_by_key_name(key_name).value, 'updated')
        # Delete.
        response = self.client.delete('/data/entity')
        self.assertContains(response, '"statusText": "Deleted"')
        self.assertEqual(KeyValue.get_by_key_name(key_name), None)


class JsonpApiTest(AppTestCase):

    def test_crud(self):
        """Tests create, read, update, delete with JSONP API."""
        key_name = 'test/data/entity'
        self.assertEqual(KeyValue.get_by_key_name(key_name), None)
        # Create.
        response = self.client.get('/data/entity?method=PUT&value=data')
        self.assertContains(response, '"statusText": "Saved"')
        self.assertEqual(KeyValue.get_by_key_name(key_name).value, 'data')
        # Read.
        response = self.client.get('/data/entity?method=GET&callback=func')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, 'func("data")')
        self.assertEqual(response['Content-Type'], 'application/javascript')
        # Update.
        response = self.client.get('/data/entity?method=PUT&value=updated')
        self.assertContains(response, '"statusText": "Saved"')
        self.assertEqual(KeyValue.get_by_key_name(key_name).value, 'updated')
        # Delete.
        response = self.client.get('/data/entity?method=DELETE')
        self.assertContains(response, '"statusText": "Deleted"')
        self.assertEqual(KeyValue.get_by_key_name(key_name), None)


class HostTest(AppTestCase):

    def setUp(self):
        super(HostTest, self).setUp()
        self.myapp = App(key_name='myapp',
                         domain='myapp.pageforest.com')
        self.myapp.put()

    def test_host(self):
        """Test namespaces by Host header."""
        url = '/doc_id/key'
        host_client = Client(HTTP_HOST='myapp.pageforest.com')
        response = host_client.put(url, 'data', content_type='text/plain')
        self.assertContains(response, '"statusText": "Saved"')
        key_name = 'myapp' + url
        self.assertEqual(KeyValue.get_by_key_name(key_name).value, 'data')
        # GET with the same host header should work.
        response = host_client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, 'data')
        # GET without host header should fail with 404 Not Found.
        response = self.client.get(url)
        self.assertEqual(response.status_code, 404)


class MemcacheTest(AppTestCase):

    def assertProtoBuf(self, binary, data=None):
        """Check binary protocol buffer."""
        self.assertTrue(binary is not None)
        self.assertEqual(binary.count('pageforest'), 1)
        self.assertEqual(binary.count('KeyValue'), 2)
        self.assertEqual(binary.count('test/doc/key/with/slashes'), 2)
        self.assertEqual(binary.count('created'), 1)
        self.assertEqual(binary.count('modified'), 1)
        self.assertEqual(binary.count('127.0.0.1'), 1)
        if data:
            self.assertEqual(binary.count(data), 1)

    def test_crud(self):
        """Tests create, read, update, delete with memcache."""
        url = '/doc/key/with/slashes'
        key_name = 'test' + url
        cache_key = 'C1~KeyValue~' + key_name
        self.assertEqual(memcache.get(cache_key), None)
        # Create.
        self.client.put(url, 'data', content_type='text/plain')
        self.assertEqual(KeyValue.get_by_key_name(key_name).value, 'data')
        binary = memcache.get(cache_key)
        self.assertProtoBuf(binary, 'data')
        # Make sure it reads from memcache if possible.
        binary = binary.replace('data', 'ofop')
        memcache.set(cache_key, binary, 300)
        response = self.client.get(url)
        self.assertEqual(response.content, 'ofop')
        # Make sure that GET saves to memcache if necessary.
        memcache.delete(cache_key)
        self.assertEqual(memcache.get(cache_key), None)
        response = self.client.get(url)
        self.assertProtoBuf(memcache.get(cache_key))
        # Update.
        self.client.put(url, 'updated', content_type='text/plain')
        self.assertProtoBuf(memcache.get(cache_key), 'updated')
        # Delete.
        self.client.delete(url)
        self.assertEqual(memcache.get(cache_key), None)


class MimeTest(AppTestCase):

    def put_and_get(self, path):
        """Helper function for MIME tests."""
        self.client.put(path, 'data', content_type='text/plain')
        return self.client.get(path)

    def test_html(self):
        """Test that the mime type is guessed correctly for HTML."""
        response = self.put_and_get('/.global/index.html')
        self.assertEqual(response['Content-Type'], 'text/html')
        response = self.client.get('/')
        self.assertEqual(response['Content-Type'], 'text/html')

    def test_css(self):
        """Test that the mime type is guessed correctly for CSS."""
        response = self.put_and_get('/global/css/style.css')
        self.assertEqual(response['Content-Type'], 'text/css')

    def test_js(self):
        """Test that the mime type is guessed correctly for JS."""
        response = self.put_and_get('/global/js/test.js')
        self.assertEqual(response['Content-Type'], 'application/javascript')

    def test_json(self):
        """Test that the mime type is guessed correctly for JSON."""
        response = self.put_and_get('/data/test.json')
        self.assertEqual(response['Content-Type'], 'application/json')

    def test_jpg(self):
        """Test that the mime type is guessed correctly for JPG."""
        response = self.put_and_get('/global/images/test.jpg')
        self.assertEqual(response['Content-Type'], 'image/jpeg')

    def test_png(self):
        """Test that the mime type is guessed correctly for PNG."""
        response = self.put_and_get('/global/images/test.png')
        self.assertEqual(response['Content-Type'], 'image/png')

    def test_ico(self):
        """Test that the mime type is guessed correctly for ICO."""
        response = self.put_and_get('/global/favicon.ico')
        self.assertEqual(response['Content-Type'], 'image/vnd.microsoft.icon')


class JsonArrayTest(AppTestCase):

    def setUp(self):
        """Prepare a simple chat array."""
        super(JsonArrayTest, self).setUp()
        self.chat = KeyValue(key_name='test/doc/chat',
                             value='["hello", "hi", "howdy"]')
        self.chat.put()

    def assertContent(self, url, content):
        """Get array content and compare with expected value."""
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, content)

    def test_last(self):
        """Test that the end of the array can be retrieved."""
        self.assertContent('/doc/chat?method=SLICE&start=-1',
                           '["howdy"]')
        self.assertContent('/doc/chat?method=SLICE&start=-2',
                           '["hi", "howdy"]')
        self.assertContent('/doc/chat?method=SLICE&start=-3',
                           '["hello", "hi", "howdy"]')
        self.assertContent('/doc/chat?method=SLICE&start=-4',
                           '["hello", "hi", "howdy"]')
        self.assertContent('/doc/chat?method=SLICE&start=-999999999999999999',
                           '["hello", "hi", "howdy"]')
        self.assertContent('/doc/chat?method=SLICE',
                           '["hello", "hi", "howdy"]')

    def test_push(self):
        """Test that push appends to the end af the array."""
        started = datetime.now()
        response = self.client.post('/doc/chat?method=PUSH', data='bye',
                                    content_type="text/plain")
        self.assertContains(response, '"statusText": "Pushed"')
        self.assertContains(response, '"newLength": 4')
        self.assertContent('/doc/chat?method=SLICE&start=-2',
                           '["howdy", "bye"]')
        chat = KeyValue.get_by_key_name('test/doc/chat')
        self.assertTrue(chat.created <= started)
        self.assertTrue(chat.modified >= started)

    def test_push_empty(self):
        """Test that push creates the array if it didn't exist."""
        started = datetime.now()
        response = self.client.post('/doc2/chat?method=PUSH', data='hi',
                                    content_type="text/plain")
        self.assertContains(response, '"statusText": "Pushed"')
        self.assertContains(response, '"newLength": 1')
        self.assertContent('/doc2/chat', '["hi"]')
        newchat = KeyValue.get_by_key_name('test/doc2/chat')
        self.assertTrue(newchat.created >= started)
        self.assertTrue(newchat.modified >= started)

    def test_push_max(self):
        """Test that push appends to the end af the array."""
        response = self.client.post('/doc/chat?method=PUSH&max=3', data='bye',
                                    content_type="text/plain")
        self.assertContains(response, '"statusText": "Pushed"')
        self.assertContains(response, '"newLength": 3')
        self.assertContent('/doc/chat', '["hi", "howdy", "bye"]')
