#!/usr/bin/env python3
"""
Sanitize security report samples by replacing real identifiers with safe placeholders.
Python standard library only.
"""
import argparse
import re
import sys
from pathlib import Path

SUPPORTED_EXTENSIONS = {'.txt', '.csv', '.log', '.eml', '.json'}

def is_text_file(path):
    """Check if file is text-like and supported."""
    return path.suffix.lower() in SUPPORTED_EXTENSIONS

def sanitize_content(content, custom_replacements):
    """Apply redaction rules to content."""
    replacements = {}

    # Apply custom replacements first
    for old, new in custom_replacements:
        content = content.replace(old, new)

    # Email addresses
    email_map = {}
    emails = re.findall(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', content)
    for i, email in enumerate(set(emails), 1):
        if 'example.local' not in email and 'example.com' not in email:
            safe = f"user{i}@example.local"
            email_map[email] = safe
            content = content.replace(email, safe)
            replacements[email] = safe

    # IPv4 addresses
    ip_map = {}
    ips = re.findall(r'\b(?:\d{1,3}\.){3}\d{1,3}\b', content)
    rfc_pools = ['192.0.2.', '198.51.100.', '203.0.113.']
    for i, ip in enumerate(set(ips), 1):
        if not any(ip.startswith(pool) for pool in rfc_pools):
            pool = rfc_pools[i % len(rfc_pools)]
            safe = f"{pool}{i % 255}"
            ip_map[ip] = safe
            content = content.replace(ip, safe)
            replacements[ip] = safe

    # UUIDs
    uuid_pattern = r'\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b'
    content = re.sub(uuid_pattern, '00000000-0000-0000-0000-000000000000', content)

    # API keys/tokens
    content = re.sub(r'\b(sk|pk|api|token)[-_][A-Za-z0-9]{20,}\b', r'\1-redacted', content, flags=re.IGNORECASE)

    # URLs
    content = re.sub(r'https?://[^\s]+', 'https://example.com/redacted', content)

    # Internal domains
    content = re.sub(r'\b([a-z0-9-]+\.)+local\b', 'example.local', content, flags=re.IGNORECASE)

    # Hostnames
    hostname_pattern = r'\b[A-Z]{2,}[-_][A-Z0-9]{2,}[-_]?[A-Z0-9]*\b'
    hostnames = re.findall(hostname_pattern, content)
    for i, hostname in enumerate(set(hostnames), 1):
        safe = f"EXAMPLE-HOST-{i}"
        content = content.replace(hostname, safe)
        replacements[hostname] = safe

    return content, replacements

def sanitize_file(input_path, output_path, custom_replacements, dry_run=False):
    """Sanitize a single file."""
    if not is_text_file(input_path):
        return False, "Unsupported file type"

    if input_path.resolve() == output_path.resolve():
        return False, "Cannot overwrite input file"

    try:
        content = input_path.read_text(encoding='utf-8', errors='ignore')
    except Exception as e:
        return False, f"Read error: {e}"

    sanitized, replacements = sanitize_content(content, custom_replacements)

    # Prepend header for text files
    if input_path.suffix.lower() in {'.txt', '.log', '.eml'}:
        header = "[DEV SAFE REDACTED SAMPLE]\nThis file was generated from a local raw input and must contain no real secrets or operational identifiers.\n\n"
        sanitized = header + sanitized

    if not dry_run:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(sanitized, encoding='utf-8')

    return True, f"{len(replacements)} replacements"

def main():
    parser = argparse.ArgumentParser(description='Sanitize security report samples')
    parser.add_argument('--input', required=True, help='Input file path')
    parser.add_argument('--output', required=True, help='Output file path')
    parser.add_argument('--dry-run', action='store_true', help='Dry run mode')
    parser.add_argument('--replace', action='append', default=[], help='Custom replacement OLD=NEW')

    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)

    if not input_path.exists():
        print(f"Error: Input file not found: {input_path}", file=sys.stderr)
        return 1

    # Parse custom replacements
    custom_replacements = []
    for r in args.replace:
        if '=' not in r:
            print(f"Warning: Invalid replacement format: {r}", file=sys.stderr)
            continue
        old, new = r.split('=', 1)
        custom_replacements.append((old, new))

    success, message = sanitize_file(input_path, output_path, custom_replacements, args.dry_run)

    if success:
        print(f"{'[DRY RUN] ' if args.dry_run else ''}Sanitized: {input_path} -> {output_path}")
        print(f"  {message}")
        return 0
    else:
        print(f"Error: {message}", file=sys.stderr)
        return 1

if __name__ == '__main__':
    sys.exit(main())
