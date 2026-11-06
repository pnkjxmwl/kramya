"""Read APK/AAB native libraries without extraction; check 64-bit ELF load alignment.

This does not replace APK zipalign, Play-generated package inspection or a 16 KB
device test. Uses only the Python standard library.
"""
import argparse
import hashlib
import json
import re
import struct
import zipfile
from pathlib import Path


def inspect(path):
    libraries = []
    with zipfile.ZipFile(path) as archive:
        for item in archive.infolist():
            if not re.fullmatch(r"(?:base/)?lib/(?:arm64-v8a|x86_64)/[^/]+\.so", item.filename):
                continue
            if item.file_size > 64 * 1024 * 1024:
                raise ValueError("Native library exceeds the inspection size limit")
            data = archive.read(item)
            if data[:6] != b"\x7fELF\x02\x01":
                raise ValueError(f"Expected a little-endian 64-bit ELF: {item.filename}")
            offset = struct.unpack_from("<Q", data, 32)[0]
            size, count = struct.unpack_from("<HH", data, 54)
            if size < 56 or count > 4096 or offset + size * count > len(data):
                raise ValueError(f"Invalid ELF program-header table: {item.filename}")
            alignments = []
            for index in range(count):
                header = offset + index * size
                if struct.unpack_from("<I", data, header)[0] != 1:  # PT_LOAD
                    continue
                file_offset, address = struct.unpack_from("<QQ", data, header + 8)
                alignment = struct.unpack_from("<Q", data, header + 48)[0]
                if alignment < 16384 or alignment & (alignment - 1) or file_offset % alignment != address % alignment:
                    raise ValueError(f"16 KB ELF load alignment failed: {item.filename}")
                alignments.append(alignment)
            if not alignments:
                raise ValueError(f"No ELF load segments: {item.filename}")
            libraries.append({"name": item.filename, "loadAlignments": alignments})
    with path.open("rb") as source:
        digest = hashlib.file_digest(source, "sha256").hexdigest()
    return {"artifact": str(path.resolve()), "sha256": digest,
            "native64Libraries": libraries, "elf16KbAlignmentPassed": True,
            "deviceAndPlayGeneratedPackageChecks": "pending"}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("artifacts", nargs="+", type=Path)
    args = parser.parse_args()
    print(json.dumps([inspect(path) for path in args.artifacts], indent=2))
