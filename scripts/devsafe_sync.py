#!/usr/bin/env python3
"""
DEV SAFE automatic sanitization workflow.
Walks security_raw_inbox/ and generates sanitized samples in samples/security/auto/.
Python standard library only.
"""
import argparse
import sys
from pathlib import Path
from sanitize_security_samples import sanitize_file, is_text_file

DEFAULT_INPUT = 'security_raw_inbox'
DEFAULT_OUTPUT = 'samples/security/auto'

def sync_samples(input_dir, output_dir, custom_replacements, dry_run=False):
    """Walk input directory and sanitize all supported files."""
    input_path = Path(input_dir)
    output_path = Path(output_dir)

    if not input_path.exists():
        print(f"Input directory not found: {input_path}")
        print("Create it and add raw reports, then run this script again.")
        return 0, 0, 0

    scanned = 0
    sanitized = 0
    skipped = 0
    failed = []

    for file_path in input_path.rglob('*'):
        if not file_path.is_file():
            continue

        scanned += 1

        if not is_text_file(file_path):
            skipped += 1
            continue

        # Generate output path preserving structure
        rel_path = file_path.relative_to(input_path)
        out_file = output_path / rel_path.parent / f"{rel_path.stem}.redacted{rel_path.suffix}"

        success, message = sanitize_file(file_path, out_file, custom_replacements, dry_run)

        if success:
            sanitized += 1
        else:
            skipped += 1
            failed.append((file_path, message))

    # Summary
    print("\n" + "="*60)
    print("DEV SAFE Sanitization Summary")
    print("="*60)
    print(f"Scanned files:    {scanned}")
    print(f"Sanitized files:  {sanitized}")
    print(f"Skipped files:    {skipped}")
    print(f"Output directory: {output_path.resolve()}")

    if failed:
        print("\nFailed files:")
        for path, reason in failed:
            print(f"  {path}: {reason}")

    if dry_run:
        print("\n[DRY RUN] No files were written.")

    return scanned, sanitized, len(failed)

def main():
    parser = argparse.ArgumentParser(description='DEV SAFE automatic sanitization workflow')
    parser.add_argument('--input-dir', default=DEFAULT_INPUT, help=f'Input directory (default: {DEFAULT_INPUT})')
    parser.add_argument('--output-dir', default=DEFAULT_OUTPUT, help=f'Output directory (default: {DEFAULT_OUTPUT})')
    parser.add_argument('--dry-run', action='store_true', help='Dry run mode')
    parser.add_argument('--replace', action='append', default=[], help='Custom replacement OLD=NEW')

    args = parser.parse_args()

    # Parse custom replacements
    custom_replacements = []
    for r in args.replace:
        if '=' not in r:
            print(f"Warning: Invalid replacement format: {r}", file=sys.stderr)
            continue
        old, new = r.split('=', 1)
        custom_replacements.append((old, new))

    scanned, sanitized, failed = sync_samples(
        args.input_dir,
        args.output_dir,
        custom_replacements,
        args.dry_run
    )

    if failed > 0:
        return 1

    return 0

if __name__ == '__main__':
    sys.exit(main())
