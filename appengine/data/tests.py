from datetime import datetime

from google.appengine.api import memcache

from django.test import TestCase, Client

from data.models import KeyValue


class KeyValueTest(TestCase):

    def setUp(self):
        self.key = 'http://test.pageforest.com/data/key'
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


class ClientErrorTest(TestCase):

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


class RestApiTest(TestCase):

    def test_crud(self):
        """Tests create, read, update, delete with REST API."""
        key_name = 'http://testserver/data/entity'
        self.assertEqual(KeyValue.get_by_key_name(key_name), None)
        # Create.
        response = self.client.put('/data/entity', 'data',
                                   content_type='text/plain')
        self.assertContains(response, 'saved')
        self.assertEqual(KeyValue.get_by_key_name(key_name).value, 'data')
        # Read.
        response = self.client.get('/data/entity')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, 'data')
        # Update.
        response = self.client.put('/data/entity', 'updated',
                                   content_type='text/plain')
        self.assertContains(response, 'saved')
        self.assertEqual(KeyValue.get_by_key_name(key_name).value, 'updated')
        # Delete.
        response = self.client.delete('/data/entity')
        self.assertContains(response, 'deleted')
        self.assertEqual(KeyValue.get_by_key_name(key_name), None)


class JsonpApiTest(TestCase):

    def test_crud(self):
        """Tests create, read, update, delete with JSONP API."""
        key_name = 'http://testserver/data/entity'
        self.assertEqual(KeyValue.get_by_key_name(key_name), None)
        # Create.
        response = self.client.get('/data/entity?method=PUT&value=data')
        self.assertContains(response, 'saved')
        self.assertEqual(KeyValue.get_by_key_name(key_name).value, 'data')
        # Read.
        response = self.client.get('/data/entity?method=GET&callback=func')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, 'func("data")')
        self.assertEqual(response['Content-Type'], 'application/javascript')
        # Update.
        response = self.client.get('/data/entity?method=PUT&value=updated')
        self.assertContains(response, 'saved')
        self.assertEqual(KeyValue.get_by_key_name(key_name).value, 'updated')
        # Delete.
        response = self.client.get('/data/entity?method=DELETE')
        self.assertContains(response, 'deleted')
        self.assertEqual(KeyValue.get_by_key_name(key_name), None)


class HostTest(TestCase):

    def test_host(self):
        """Test namespaces by Host header."""
        host_client = Client(HTTP_HOST='test.pageforest.com')
        response = host_client.put('/data/entity', 'data',
                                   content_type='text/html')
        self.assertContains(response, 'saved')
        key_name = 'http://test.pageforest.com/data/entity'
        self.assertEqual(KeyValue.get_by_key_name(key_name).value, 'data')
        # GET with the same host header should work.
        response = host_client.get('/data/entity')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, 'data')
        # GET without host header should fail with 404 Not Found.
        response = self.client.get('/data/entity')
        self.assertEqual(response.status_code, 404)


class MemcacheTest(TestCase):

    def test_crud(self):
        """Tests create, read, update, delete with memcache."""
        key_name = 'http://testserver/data/entity'
        self.assertEqual(memcache.get(key_name), None)
        # Create.
        self.client.put('/data/entity', 'data', content_type='text/plain')
        self.assertEqual(memcache.get(key_name)[26:], 'GMT|data')
        # Make sure it reads from memcache if possible.
        last_modified = 'Tue, 15 Nov 1994 12:45:26 GMT'
        memcache.set(key_name, last_modified + '|cached', 300)
        response = self.client.get('/data/entity')
        self.assertEqual(response.content, 'cached')
        self.assertEqual(response['Last-Modified'], last_modified)
        # Make sure that GET saves to memcache if necessary.
        memcache.delete(key_name)
        self.assertEqual(memcache.get(key_name), None)
        response = self.client.get('/data/entity')
        self.assertEqual(memcache.get(key_name)[26:], 'GMT|data')
        # Update.
        self.client.put('/data/entity', 'updated', content_type='text/plain')
        self.assertEqual(memcache.get(key_name)[26:], 'GMT|updated')
        # Delete.
        self.client.delete('/data/entity')
        self.assertEqual(memcache.get(key_name), None)


class MimeTest(TestCase):

    def put_and_get(self, path):
        """Helper function for MIME tests."""
        self.client.put(path, 'data', content_type='text/plain')
        return self.client.get(path)

    def test_html(self):
        """Test that the mime type is guessed correctly for HTML."""
        response = self.put_and_get('/index.html')
        self.assertEqual(response['Content-Type'], 'text/html')
        response = self.client.get('/index.html')
        self.assertEqual(response['Content-Type'], 'text/html')

    def test_css(self):
        """Test that the mime type is guessed correctly for CSS."""
        response = self.put_and_get('/style.css')
        self.assertEqual(response['Content-Type'], 'text/css')

    def test_js(self):
        """Test that the mime type is guessed correctly for JS."""
        response = self.put_and_get('/test.js')
        self.assertEqual(response['Content-Type'], 'application/javascript')

    def test_json(self):
        """Test that the mime type is guessed correctly for JSON."""
        response = self.put_and_get('/data/test.json')
        self.assertEqual(response['Content-Type'], 'application/json')

    def test_jpg(self):
        """Test that the mime type is guessed correctly for JPG."""
        response = self.put_and_get('/test.jpg')
        self.assertEqual(response['Content-Type'], 'image/jpeg')

    def test_png(self):
        """Test that the mime type is guessed correctly for PNG."""
        response = self.put_and_get('/test.png')
        self.assertEqual(response['Content-Type'], 'image/png')

    def test_ico(self):
        """Test that the mime type is guessed correctly for ICO."""
        response = self.put_and_get('/test.ico')
        self.assertEqual(response['Content-Type'], 'image/vnd.microsoft.icon')


class JsonArrayTest(TestCase):

    def setUp(self):
        """Prepare a simple chat array."""
        self.chat = KeyValue(key_name='http://testserver/chat',
                             value='["hello", "hi", "howdy"]')
        self.chat.put()

    def assertContent(self, url, content):
        """Get array content and compare with expected value."""
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, content)

    def test_last(self):
        """Test that the end of the array can be retrieved."""
        self.assertContent('/chat?method=SLICE&start=-1', '["howdy"]')
        self.assertContent('/chat?method=SLICE&start=-2', '["hi", "howdy"]')
        self.assertContent('/chat?method=SLICE&start=-3',
                           '["hello", "hi", "howdy"]')
        self.assertContent('/chat?method=SLICE&start=-4',
                           '["hello", "hi", "howdy"]')
        self.assertContent('/chat?method=SLICE&start=-999999999999999999',
                           '["hello", "hi", "howdy"]')
        self.assertContent('/chat?method=SLICE',
                           '["hello", "hi", "howdy"]')

    def test_push(self):
        """Test that push appends to the end af the array."""
        started = datetime.now()
        response = self.client.post('/chat?method=PUSH', data='bye',
                                    content_type="text/plain")
        self.assertContains(response, 'saved')
        self.assertContent('/chat?method=SLICE&start=-2', '["howdy", "bye"]')
        chat = KeyValue.get_by_key_name('http://testserver/chat')
        self.assertTrue(chat.created <= started)
        self.assertTrue(chat.modified >= started)

    def test_push_empty(self):
        """Test that push creates the array if it didn't exist."""
        started = datetime.now()
        response = self.client.post('/newchat?method=PUSH', data='hi',
                                    content_type="text/plain")
        self.assertContains(response, 'saved')
        self.assertContent('/newchat', '["hi"]')
        newchat = KeyValue.get_by_key_name('http://testserver/newchat')
        self.assertTrue(newchat.created >= started)
        self.assertTrue(newchat.modified >= started)

    def test_push_max(self):
        """Test that push appends to the end af the array."""
        response = self.client.post('/chat?method=PUSH&max=3', data='bye',
                                    content_type="text/plain")
        self.assertContains(response, 'saved')
        self.assertContent('/chat', '["hi", "howdy", "bye"]')
