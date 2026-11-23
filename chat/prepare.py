"""Prepare assets from the verified GPL source release, without executing its build scripts."""
import hashlib
import io
import json
from pathlib import Path
import shutil
import struct
import sys
import tarfile
import zipfile

ROOT = Path(__file__).resolve().parent
EXPECTED = "895b7a03b421b0347bc00b9b4b0814e1ad2d0362face275c45f78ec4d423a9e6"

def relocate_library_path(raw):
    """Relocate the pinned little-endian ELF64 DT_RUNPATH entries into the private runtime."""
    if raw[:6] != b"\x7fELF\x02\x01":
        return raw
    data = bytearray(raw)
    start, = struct.unpack_from("<Q", data, 40)
    size, count = struct.unpack_from("<HH", data, 58)
    sections = [struct.unpack_from("<IIQQQQIIQQ", data, start + i * size) for i in range(count)]
    for section in sections:
        if section[1] != 6: continue  # SHT_DYNAMIC
        strings = sections[section[6]][4]
        for offset in range(section[4], section[4] + section[5], section[9]):
            tag, value = struct.unpack_from("<QQ", data, offset)
            if tag not in (15, 29): continue  # DT_RPATH / DT_RUNPATH
            pos = strings + value
            previous = b"/data/data/com.termux/files/usr/lib"
            if data[pos:pos + len(previous) + 1] == previous + b"\0":
                data[pos:pos + len(previous)] = b"$ORIGIN/../lib".ljust(len(previous), b"\0")
    return data
source, assets = map(Path, sys.argv[1:])
assets.mkdir(parents=True, exist_ok=True)
with source.open("rb") as handle:
    digest = hashlib.sha256()
    for chunk in iter(lambda: handle.read(2**20), b""):
        digest.update(chunk)
if digest.hexdigest() != EXPECTED:
    raise SystemExit("Source archive SHA-256 mismatch")

prefix = "DSH-Android-0.2.5-source/_payload/"
# DT_NEEDED closure of the pinned Node and bash ELF files. Unversioned aliases for
# unrelated libraries would also shadow Android system libraries on translated devices.
needed = set("""libandroid-support.so libreadline.so.8 libiconv.so libncursesw.so.6
libz.so.1 libcares.so libsqlite3.so libcrypto.so.3 libssl.so.3 libicui18n.so.78
libicuuc.so.78 libc++_shared.so libicudata.so.78""".split())
with zipfile.ZipFile(source) as bundle:
    with bundle.open(prefix + "nm-base.tar.gz") as src, (assets / "engine.tar.gz").open("wb") as dst:
        shutil.copyfileobj(src, dst, 2**20)
    links = dict(line.split("\t", 1) for line in bundle.read(prefix + "termux-links.txt").decode().splitlines() if "\t" in line)
    libraries = {"lib/" + name for name in needed}
    for entry in list(libraries):
        while entry in links:
            entry = "lib/" + links[entry]
            if entry in libraries: break
            libraries.add(entry)
    with bundle.open(prefix + "termux.tar.gz") as src, tarfile.open(fileobj=src, mode="r|gz") as old, \
            tarfile.open(assets / "node.tar.gz", "w:gz", compresslevel=3) as out:
        kept = set()
        for member in old:
            library = member.name.removeprefix("usr/") in libraries
            if not library and member.name not in {"usr/bin/node", "usr/bin/bash", "usr/etc/tls/cert.pem"}:
                # Preserve upstream redistribution notices from the Node/userland bundle.
                if not member.name.startswith("usr/share/doc/"): continue
            if member.isfile() or member.isdir():
                member.mode = 0o755 if library or member.isdir() or member.name.startswith("usr/bin/") else 0o644
                data = old.extractfile(member) if member.isfile() else None
                if data and (library or member.name.startswith("usr/bin/")):
                    data = io.BytesIO(relocate_library_path(data.read()))
                out.addfile(member, data)
                kept.add(member.name)
        for name, target in links.items():
            if name not in libraries or "/" in target: continue
            resolved = target
            visited = set()
            while "lib/" + resolved in links and resolved not in visited:
                visited.add(resolved)
                resolved = links["lib/" + resolved]
            if "usr/lib/" + resolved not in kept: continue
            info = tarfile.TarInfo("usr/" + name)
            info.type, info.linkname, info.mode = tarfile.SYMTYPE, target, 0o777
            out.addfile(info)

with tarfile.open(assets / "engine.tar.gz", "r|gz") as archive:
    wanted = "opt/dsh/lib/node_modules/@deepseek-ai/dsh-client-ui-settings-account/lib/client.js"
    web_config = "opt/dsh/lib/node_modules/@deepseek-ai/dsh-web-app/cordis.patch.yml"
    session_module = "opt/dsh/lib/node_modules/@deepseek-ai/dsh-api-session-controller/lib/index.js"
    original = web_patch = session_source = None
    for member in archive:
        if member.name == wanted:
            original = archive.extractfile(member).read().decode()
        if member.name == web_config:
            web_patch = archive.extractfile(member).read().decode()
        if member.name == session_module:
            session_source = archive.extractfile(member).read().decode()
        if original is not None and web_patch is not None and session_source is not None:
            break
    else:
        raise SystemExit("Missing Harness web bundle")
workspace_anchor = "      name: '@deepseek-ai/dsh-api-workspace-controller'"
if web_patch.count(workspace_anchor) != 1:
    raise SystemExit("Unsupported workspace configuration")
web_patch = web_patch.replace(workspace_anchor, workspace_anchor + "\n      config:\n        documentsDirectory: !!js process.env.DSCHAT_DOCUMENTS")
(assets / "web-app.patch.yml").write_text(web_patch, encoding="utf-8")
# Some Android WebViews report a platform-specific time zone. The prompt
# protocol supports an absent zone. Preserve every canonicalizable value;
# omit unknown optional metadata on Android so that the message can be sent.
zone_guard = "if (request.clientTimeZone !== void 0 && clientTimeZone === void 0)"
if session_source.count(zone_guard) != 1:
    raise SystemExit("Unsupported Harness prompt validator")
session_source = session_source.replace(zone_guard, 'if (process.platform !== "android" && request.clientTimeZone !== void 0 && clientTimeZone === void 0)')
# v0.2 web imports have no preset in their immutable header. Choose the
# tool-free composition when reopening those logs; DSH's new-session default
# and all explicit historical presets continue to use their own selection.
historical_preset = "return observation.projections.values.agentPreset ?? void 0;"
if session_source.count(historical_preset) != 1:
    raise SystemExit("Unsupported historical session preset selection")
session_source = session_source.replace(historical_preset, 'return observation.projections.values.agentPreset ?? "deepsleep-chat";')
(assets / "android-session-controller.js").write_text(session_source, encoding="utf-8")
anchor = "if (desktop) {\n\t\t\t\tconst controller = new DesktopOnboardingController"
if original.count(anchor) != 1:
    raise SystemExit("Unsupported Harness account UI version")
mobile_sources = ["mobile-session.js", "mobile-chat.js", "mobile-import.js", "mobile-account.js"]
insertion = "\n".join((ROOT / file).read_text(encoding="utf-8") for file in mobile_sources)
client = original.replace(anchor, insertion + '\nctx.effect(() => mountMobileAccount(operations, ctx), "mobile chat account");\n' + anchor)
(assets / "mobile-client.js").write_text(client, encoding="utf-8")

# Reuse the official host-side converter. The local UI uses the phone's document picker
# and the currently installed Harness navigation APIs instead of the desktop sidebar slot.
plugin = ROOT / "vendor/dsh-deepseek-chat-import-0.2.2-rc.5.tgz"
if hashlib.sha256(plugin.read_bytes()).hexdigest() != "0c4b0178439d9b1b39aa707d7764aa9d6a1f7555c3c54bb550cb24b647cbefd2":
    raise SystemExit("Unexpected history-import package")
with tarfile.open(plugin) as upstream, tarfile.open(assets / "history-import.tar.gz", "w:gz") as out:
    # A preset-scoped restriction follows the preset even when DSH switches
    # a blank session in or out of it. The host also registers global tools.
    chat_tools = b'''export const name = "deepsleep-chat-tools";
export const inject = ["tools"];
export function apply(ctx) {
    ctx.tools.presentAs("native");
    ctx.tools.restrict({ allow: [] });
}
'''
    (assets / "chat-tools.js").write_bytes(chat_tools)
    policy_entry = tarfile.TarInfo("lib/chat-tools.js")
    policy_entry.size = len(chat_tools)
    out.addfile(policy_entry, io.BytesIO(chat_tools))
    for name in ["package.json", "lib/index.js", "lib/typert.host.js", "cordis.patch.yml", "LICENSE", "locale/zh.json", "locale/en.json"]:
        data = upstream.extractfile("package/" + name).read()
        if name == "package.json":
            # This host-only Android port targets the peer APIs shipped in our
            # APK. It has its own identity and never enables a DSH version exemption.
            meta = {
                "name": "@dsconversation/history-import", "version": "0.2.0",
                "type": "module", "license": "MIT", "main": "./lib/index.js",
                "exports": {".": "./lib/index.js", "./typert": "./lib/typert.host.js", "./chat-tools": "./lib/chat-tools.js",
                            "./package.json": "./package.json", "./cordis.patch.yml": "./cordis.patch.yml",
                            "./locale/*.json": "./locale/*.json"},
                "dsh": {"bundle": {"patch": "./cordis.patch.yml"}},
                "peerDependencies": {key: "0.2.1-rc.2" for key in [
                    "@deepseek-ai/dsh-brand", "@deepseek-ai/dsh-typert-protocol", "@deepseek-ai/dsh-llm",
                    "@deepseek-ai/dsh-session", "@deepseek-ai/dsh-session-title", "@deepseek-ai/dsh-tool-web", "@deepseek-ai/dsh-tools"]},
            }
            data = json.dumps(meta).encode()
            (assets / "history-package.json").write_bytes(data)
        elif name == "lib/typert.host.js":
            data = data.replace(b"@deepseek-ai/dsh-deepseek-chat-import", b"@dsconversation/history-import")
        elif name == "lib/index.js":
            anchor = b"createdAt: conversion.createdAt,"
            if data.count(anchor) != 1:
                raise SystemExit("Unsupported importer session header")
            data = data.replace(anchor, anchor + b'\n\t\tagentPreset: "deepsleep-chat",')
            (assets / "history-host.js").write_bytes(data)
        info = tarfile.TarInfo(name)
        info.size = len(data)
        out.addfile(info, io.BytesIO(data))
shutil.copyfile(ROOT / "history.patch.yml", assets / "history.patch.yml")
for name in ["LICENSE", "THIRD_PARTY_NOTICES.md"]:
    shutil.copyfile(ROOT.parent / name, assets / name)
