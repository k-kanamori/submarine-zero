"""Read final MP4 track metadata without requiring a separate FFmpeg install."""
from pathlib import Path
import json, struct

path=Path(__file__).resolve().parents[2]/'output/shinkai-zero-promo-30s.mp4'
data=path.read_bytes()
def boxes(data):
    offset=0
    while offset+8<=len(data):
        size,kind=struct.unpack_from('>I4s',data,offset);header=8
        if size==1:size=struct.unpack_from('>Q',data,offset+8)[0];header=16
        if size==0:size=len(data)-offset
        if size<header or offset+size>len(data):raise ValueError('Incomplete MP4 box')
        yield kind,data[offset+header:offset+size]
        offset+=size
def child(data,kind):return next(payload for name,payload in boxes(data) if name==kind)
moov=child(data,b'moov')
tracks=[]
for kind,track in boxes(moov):
    if kind!=b'trak':continue
    mdia=child(track,b'mdia');header=child(mdia,b'mdhd')
    if header[0]==1:
        timescale=struct.unpack_from('>I',header,20)[0];duration=struct.unpack_from('>Q',header,24)[0]
    else:timescale,duration=struct.unpack_from('>II',header,12)
    handler=child(mdia,b'hdlr')[8:12].decode()
    stbl=child(child(mdia,b'minf'),b'stbl')
    codec=child(stbl,b'stsd')[12:16].decode()
    samples=struct.unpack_from('>I',child(stbl,b'stsz'),8)[0]
    result=dict(type=handler,codec=codec,duration=duration/timescale,samples=samples)
    if handler=='vide':
        tkhd=child(track,b'tkhd');width,height=struct.unpack_from('>II',tkhd,len(tkhd)-8)
        result.update(width=width/65536,height=height/65536,fps=samples/(duration/timescale))
    tracks.append(result)
video=next(t for t in tracks if t['type']=='vide')
sound=next(t for t in tracks if t['type']=='soun')
assert video['samples']==720 and video['duration']==30 and video['fps']==24,video
assert (video['width'],video['height'],video['codec'])==(1920,1080,'avc1'),video
assert sound['codec']=='mp4a' and abs(sound['duration']-30)<.1,sound
report=dict(file=path.name,bytes=len(data),tracks=tracks)
path.with_suffix('.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
