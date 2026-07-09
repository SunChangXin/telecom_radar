from __future__ import annotations

import threading
import unittest
from email.header import decode_header, make_header
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from telecom_radar.notifier import Notifier
from telecom_radar.cli import configure_console


class _CaptureHandler(BaseHTTPRequestHandler):
    title = ""

    def do_POST(self) -> None:  # noqa: N802
        type(self).title = self.headers.get("Title", "")
        self.send_response(200)
        self.end_headers()

    def log_message(self, format: str, *args: object) -> None:
        return


class NtfyNotifierTests(unittest.TestCase):
    def test_ntfy_encodes_non_latin_title_as_rfc2047(self) -> None:
        server = ThreadingHTTPServer(("127.0.0.1", 0), _CaptureHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            notifier = Notifier(
                ntfy_server=f"http://127.0.0.1:{server.server_port}",
                ntfy_topic="test-topic",
            )
            self.assertEqual(
                notifier._send_ntfy("通信前沿雷达：1 条新动态", "测试正文"),
                "ntfy: ok",
            )
            decoded = str(make_header(decode_header(_CaptureHandler.title)))
            self.assertEqual(decoded, "通信前沿雷达：1 条新动态")
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)

    def test_console_is_reconfigured_for_unicode_output(self) -> None:
        configure_console()
        self.assertEqual(getattr(__import__("sys").stdout, "encoding", "").lower(), "utf-8")


if __name__ == "__main__":
    unittest.main()
