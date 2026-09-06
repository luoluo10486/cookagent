#!/usr/bin/env python3
"""校验 FoodMate 公共营养资料清单、来源元数据和文件完整性。"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import urlparse


SECRET_PATTERN = re.compile(r"(?i)(?:sk-[a-z0-9_-]{12,}|api[_ -]?key\s*[:=]|authorization\s*[:=])")
PLACEHOLDER_PATTERN = re.compile(r"(?i)(?:local test material|codex-public-|example\.com)")


def sha256(path: Path) -> str:
    """计算资料文件摘要，用于发现内容被替换或损坏。"""
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def front_matter(path: Path) -> dict[str, str]:
    """读取资料头部的简单键值元数据，正文仍由知识库 Markdown 解析器处理。"""
    lines = path.read_text(encoding="utf-8").splitlines()
    if not lines or lines[0].strip() != "---":
        raise ValueError(f"缺少 Front Matter：{path.name}")
    try:
        end = lines.index("---", 1)
    except ValueError as error:
        raise ValueError(f"Front Matter 未闭合：{path.name}") from error
    result: dict[str, str] = {}
    for line in lines[1:end]:
        key, separator, value = line.partition(":")
        if not separator or not key.strip() or not value.strip():
            raise ValueError(f"Front Matter 字段无效：{path.name}")
        result[key.strip()] = value.strip()
    return result


def validate(root: Path) -> dict[str, object]:
    """校验公共资料目录并返回可写入执行记录的摘要。"""
    manifest_path = root / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    documents = manifest.get("documents")
    if not isinstance(documents, list) or not documents:
        raise ValueError("manifest 必须包含非空 documents")

    seen_urls: set[str] = set()
    seen_hashes: set[str] = set()
    validated: list[dict[str, object]] = []
    for item in documents:
        if not isinstance(item, dict):
            raise ValueError("manifest 文档项必须为对象")
        filename = str(item.get("file", ""))
        if not re.fullmatch(r"[a-z0-9][a-z0-9._-]+\.md", filename):
            raise ValueError(f"资料文件名不安全：{filename}")
        path = root / filename
        if not path.is_file():
            raise ValueError(f"资料文件不存在：{filename}")
        source_url = str(item.get("source_url", ""))
        parsed_url = urlparse(source_url)
        if parsed_url.scheme != "https" or parsed_url.hostname != "www.who.int":
            raise ValueError(f"资料来源必须是 WHO HTTPS 页面：{source_url}")
        if source_url in seen_urls:
            raise ValueError(f"资料来源重复：{source_url}")
        seen_urls.add(source_url)
        actual_hash = sha256(path)
        if actual_hash != str(item.get("sha256", "")):
            raise ValueError(f"资料摘要不匹配：{filename}")
        if actual_hash in seen_hashes:
            raise ValueError(f"资料内容重复：{filename}")
        seen_hashes.add(actual_hash)
        text = path.read_text(encoding="utf-8")
        if SECRET_PATTERN.search(text):
            raise ValueError(f"资料疑似包含敏感信息：{filename}")
        if PLACEHOLDER_PATTERN.search(text):
            raise ValueError(f"资料疑似包含测试占位内容：{filename}")
        metadata = front_matter(path)
        for field in ("title", "source_name", "source_url", "source_version", "retrieved_at"):
            if not metadata.get(field):
                raise ValueError(f"资料缺少元数据 {field}：{filename}")
        if metadata["source_url"] != source_url or metadata["title"] != str(item.get("title", "")):
            raise ValueError(f"资料头部与 manifest 不一致：{filename}")
        validated.append({"file": filename, "bytes": path.stat().st_size, "sha256": actual_hash})

    return {
        "dataset": manifest.get("dataset"),
        "dataset_version": manifest.get("dataset_version"),
        "document_count": len(validated),
        "embedding_status": manifest.get("embedding_status"),
        "documents": validated,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path("script/data/knowledge/public"))
    args = parser.parse_args()
    print(json.dumps(validate(args.root), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
