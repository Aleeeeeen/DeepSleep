"""Generate a synthetic official-format v3 ZIP for Android smoke tests."""
import json
import sys
from zipfile import ZIP_DEFLATED, ZipFile

STAMP = "2026-11-20T08:00:00Z"

def message(id_, parent, role, text):
    kind = "REQUEST" if role == "USER" else "RESPONSE"
    return dict(id=id_, parent_id=parent, role=role, status="FINISHED", inserted_at=STAMP,
                fragments=[dict(type=kind, content=text)])

chats = [
    dict(id="trip-731", title="旅行笔记", current_message_id=3, inserted_at=STAMP, messages=[
        message(1, None, "USER", "请记住行程编号 MAPLE-731。"),
        message(2, 1, "ASSISTANT", "未选中的旧分支。"),
        message(3, 1, "ASSISTANT", "已记下 MAPLE-731。"),
    ]),
    dict(id="packing", title="行李清单", current_message_id=2, inserted_at=STAMP, messages=[
        message(1, None, "USER", "带哪两件物品？"),
        message(2, 1, "ASSISTANT", "雨衣和水壶。"),
    ]),
]
with ZipFile(sys.argv[1], "w", compression=ZIP_DEFLATED) as out:
    def write(name, value):
        out.writestr(name, json.dumps(value, ensure_ascii=False).encode("utf-8"))
    write("manifest.json", {"export_format_version": 3})
    write("chat_session_index.json", [
        dict(id=c["id"], title=c["title"], inserted_at=STAMP, updated_at=STAMP) for c in chats])
    for chat in chats:
        write("chat_sessions/" + chat["id"] + ".json", chat)
