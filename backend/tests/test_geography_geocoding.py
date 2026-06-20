import json
from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APIClient


class FakeUrlopenResponse:
    status = 200

    def __init__(self, payload):
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def read(self):
        return json.dumps(self.payload).encode("utf-8")


class GeographyGeocodingApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_search_proxies_nominatim_without_browser_cors(self):
        payload = [
            {
                "place_id": 1,
                "lat": "10.9878",
                "lon": "-74.7889",
                "display_name": "Carrera 17, Barranquilla, Atlantico, Colombia",
                "address": {"city": "Barranquilla", "state": "Atlantico", "country": "Colombia"},
            }
        ]
        with patch(
            "apps.geography.interfaces.views.urlopen",
            return_value=FakeUrlopenResponse(payload),
        ) as urlopen_mock:
            response = self.client.get(
                "/api/v1/geography/geocoding/search/",
                {"q": "Carrera 17", "state": "Atlantico", "country": "Colombia"},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, payload)
        request = urlopen_mock.call_args.args[0]
        self.assertIn("nominatim.openstreetmap.org/search", request.full_url)
        self.assertIn("Carrera+17%2C+Atlantico%2C+Colombia", request.full_url)

    def test_reverse_requires_lat_and_lon(self):
        response = self.client.get(
            "/api/v1/geography/geocoding/reverse/",
            {"lat": "10.9878"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("detail", response.data)

    def test_reverse_proxies_nominatim(self):
        payload = {
            "place_id": 1,
            "lat": "10.9878",
            "lon": "-74.7889",
            "display_name": "Barranquilla, Atlantico, Colombia",
            "address": {"city": "Barranquilla", "state": "Atlantico", "country": "Colombia"},
        }
        with patch(
            "apps.geography.interfaces.views.urlopen",
            return_value=FakeUrlopenResponse(payload),
        ) as urlopen_mock:
            response = self.client.get(
                "/api/v1/geography/geocoding/reverse/",
                {"lat": "10.9878", "lon": "-74.7889"},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, payload)
        self.assertIn("nominatim.openstreetmap.org/reverse", urlopen_mock.call_args.args[0].full_url)
