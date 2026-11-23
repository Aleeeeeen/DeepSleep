"""Local test model for the two synthetic conversations in make_history.py."""
import json
import re
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


class ContextModel(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != "/v1/models":
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"object":"list","data":[{"id":"local-memory","object":"model","owned_by":"test"}]}')

    def do_POST(self):
        if self.path != "/v1/chat/completions":
            self.send_error(404)
            return
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        history = [(m["role"], str(m.get("content", ""))) for m in body["messages"]
                   if m["role"] in ("user", "assistant")]
        code = None
        confirmed = question = False
        for role, content in history:
            if role == "user" and code is None:
                match = re.search(r"MAPLE-\d+", content)
                if match:
                    code = match.group(0)
            elif role == "assistant" and code and code in content:
                confirmed = True
            elif role == "user" and confirmed and "trip code" in content.lower():
                question = True
        selected_branch = all("未选中的旧分支" not in v for _, v in history)
        tools = body.get("tools", [])
        new_chat_probe = not code and any(r == "user" and "DeepSleep ping" in v for r, v in history)
        passed = (bool(code and question and selected_branch) or new_chat_probe) and not tools
        print(json.dumps({"passed": passed, "questionAfterOldReply": question,
                          "discardedBranchAbsent": selected_branch,
                          "modelTools": [tool.get("function", {}).get("name") for tool in tools]}), flush=True)
        if passed and new_chat_probe:
            answer = "DeepSleep ping received."
        elif passed:
            answer = f"The trip code is {code}."
        else:
            answer = "Context check did not pass."
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.end_headers()
        words = answer.split(" ", 2)
        for delta, reason in [({"role": "assistant", "content": " ".join(words[:2]) + " "}, None),
                              ({"content": words[2]}, None), ({}, "stop")]:
            chunk = {"id": "chatcmpl-fixture", "object": "chat.completion.chunk",
                     "created": int(time.time()), "model": "local-memory",
                     "choices": [{"index": 0, "delta": delta, "finish_reason": reason}]}
            self.wfile.write(("data: " + json.dumps(chunk) + "\n\n").encode())
            self.wfile.flush()
            if "role" in delta:
                time.sleep(1)
        self.wfile.write(b"data: [DONE]\n\n")


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", 18642), ContextModel).serve_forever()
