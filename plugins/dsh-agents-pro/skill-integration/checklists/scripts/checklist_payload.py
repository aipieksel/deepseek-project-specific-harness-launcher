#!/usr/bin/env python3
"""Convert a Markdown checklist to agents_pro_update_checklist arguments.
Stdlib only. Prints JSON; the calling agent publishes it through the chat-scoped tool.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re


def parse_checklist(markdown):
    items = []
    seen = set()
    fence = None
    current = None
    for line in markdown.splitlines():
        marker = re.match(r'^\s*(`{3,}|~{3,})', line)
        if marker:
            token = marker[1]
            if fence is None:
                fence = token
            elif token[0] == fence[0] and len(token) >= len(fence):
                fence = None
            current = None
            continue
        if fence:
            continue
        match = re.match(r'^(\s*)(?:[-*+]|\d+[.)])\s+\[([ xX~!])\]\s+(.+?)\s*$', line)
        if match:
            label = match[3]
            explicit = re.match(r'^(R\d+)\b[\s:.-]*(.*)$', label)
            item_id = explicit[1] if explicit else 'item-' + hashlib.sha256(label.encode()).hexdigest()[:16]
            if item_id in seen:
                raise ValueError(f'Duplicate item ID {item_id}; give each item a unique stable R ID.')
            seen.add(item_id)
            current = {'id': item_id, 'text': label, 'status': {' ': 'pending', 'x': 'completed', '~': 'in_progress', '!': 'blocked'}[match[2].lower()]}
            items.append(current)
        elif current and line.strip() and line[:1].isspace() and not re.match(r'^\s*(?:[-*+]|\d+[.)])\s', line):
            current['text'] += ' ' + line.strip()
        else:
            current = None
    if not items:
        raise ValueError('No checklist items found; refusing to publish an empty replacement.')
    return items


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument('--record', type=Path, help='Development record containing checklist.md and record.json')
    source.add_argument('--checklist', type=Path, help='Any skill Markdown checklist')
    parser.add_argument('--id', help='Stable checklist ID (defaults to record directory name)')
    parser.add_argument('--title')
    parser.add_argument('--mode', choices=['merge', 'replace'], default='merge')
    parser.add_argument('--output', type=Path, help='Write JSON here instead of stdout')
    args = parser.parse_args()
    try:
        metadata = json.loads((args.record / 'record.json').read_text()) if args.record else {}
        checklist = args.record / 'checklist.md' if args.record else args.checklist
        identifier = args.id or (args.record.name if args.record else None)
        if not identifier:
            raise ValueError('--id is required with --checklist')
        payload = {'id': identifier, 'title': args.title or metadata.get('title') or checklist.stem, 'mode': args.mode, 'items': parse_checklist(checklist.read_text())}
        result = json.dumps(payload, ensure_ascii=False, indent=2) + '\n'
        if args.output:
            args.output.write_text(result)
        else:
            print(result, end='')
    except (OSError, ValueError) as error:
        parser.exit(1, str(error) + '\n')


if __name__ == '__main__':
    main()
