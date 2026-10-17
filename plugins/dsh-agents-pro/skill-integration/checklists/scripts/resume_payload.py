#!/usr/bin/env python3
"""Print resume context with existing checklist/item IDs; never publish or mutate."""
import argparse,json,subprocess,sys
from pathlib import Path

def build(payload):
    if not isinstance(payload.get('id'),str) or not payload['id'].strip():
        raise ValueError('Existing checklist id is required')
    items=payload.get('items',[])
    ids=[item['id'] for item in items]
    if len(ids)!=len(set(ids)):
        raise ValueError('Duplicate item ids')
    pending=[item for item in items if item['status'] in ('pending','blocked')]
    return {'id':payload['id'],'mode':'merge','items':pending,
            'instruction':'Resume this existing checklist. Preserve stable IDs and completed work. Resolve blockers before dependent work; verify before completion.'}

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    group=parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--payload',type=Path);group.add_argument('--record',type=Path)
    args=parser.parse_args()
    try:
        payload=json.loads(args.payload.read_text() if args.payload else subprocess.check_output([sys.executable,str(Path(__file__).with_name('checklist_payload.py')),'--record',str(args.record)],text=True))
        print(json.dumps(build(payload),indent=2))
    except (ValueError,KeyError,OSError,subprocess.CalledProcessError) as error:
        parser.exit(1,str(error)+'\n')
if __name__=='__main__':main()
