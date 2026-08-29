#!/usr/bin/env python3
"""Browser smoke test for the recipe cooking mode."""
from __future__ import annotations

import contextlib
import http.server
import os
import socketserver
import threading
import unittest
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:
        pass


class CookingModeTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        os.chdir(ROOT)
        cls.server = socketserver.TCPServer(("127.0.0.1", 0), QuietHandler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.browser_context = sync_playwright().start()
        cls.browser = cls.browser_context.chromium.launch(headless=True)
        cls.page = cls.browser.new_page(viewport={"width": 390, "height": 844})
        cls.page.goto(f"http://127.0.0.1:{cls.server.server_address[1]}", wait_until="networkidle")

    @classmethod
    def tearDownClass(cls) -> None:
        cls.browser.close()
        cls.browser_context.stop()
        cls.server.shutdown()
        cls.server.server_close()

    def test_cooking_mode_toggles_and_releases_wake_lock(self) -> None:
        self.page.locator(".card-link").first.click()
        self.page.wait_for_selector(".cooking-mode-button")
        button = self.page.get_by_role("button", name="Kochmodus aktivieren")
        self.assertTrue(button.is_visible())
        self.page.evaluate("""
          () => {
            window.__wakeLockRequests = 0;
            window.__wakeLockReleases = 0;
            Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async () => {
              window.__wakeLockRequests += 1;
              return {
                released: false,
                release: async function() { this.released = true; window.__wakeLockReleases += 1; },
                addEventListener: () => {},
              };
            } } });
          }
        """)
        button.click()
        self.page.wait_for_function("window.__wakeLockRequests === 1")
        self.assertEqual(self.page.get_by_role("button", name="Kochmodus beenden").get_attribute("aria-pressed"), "true")
        self.page.get_by_role("button", name="Kochmodus beenden").click()
        self.page.wait_for_function("window.__wakeLockReleases === 1")
        self.assertEqual(self.page.get_by_role("button", name="Kochmodus aktivieren").get_attribute("aria-pressed"), "false")


if __name__ == "__main__":
    unittest.main()
