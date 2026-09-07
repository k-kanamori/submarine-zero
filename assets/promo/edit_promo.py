"""Assemble and encode the 30-second film with Blender's video sequencer."""
import bpy, json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
ASSETS=ROOT/'assets/promo'
scene=bpy.context.scene
scene.render.resolution_x=1920;scene.render.resolution_y=1080
scene.render.resolution_percentage=100;scene.render.fps=24
scene.frame_start=1;scene.frame_end=720
scene.render.use_sequencer=True
scene.render.use_compositing=False
scene.view_settings.view_transform='Standard'
scene.view_settings.look='None'
editor=scene.sequence_editor_create()
strips=editor.strips
black=strips.new_effect(name='Black background',type='COLOR',channel=1,frame_start=1,frame_end=721)
black.color=(0,0,0)

def fade(strip,start,end,fade_in=8,fade_out=8):
    for frame,value in [(start,0),(start+fade_in,1),(end-fade_out,1),(end-1,0)]:
        strip.blend_alpha=value;strip.keyframe_insert('blend_alpha',frame=frame)

board=json.loads((ASSETS/'storyboard.json').read_text())
for i,shot in enumerate(board):
    start=1+shot['start']*24;end=1+shot['end']*24
    image=strips.new_image(shot['kicker'],str(ASSETS/f"stills/{shot['still']:02}.png"),2,start,fit_method='FIT')
    image.frame_final_end=end;image.blend_type='ALPHA_OVER'
    fit_x,fit_y=image.transform.scale_x,image.transform.scale_y
    for frame,scale,offset in [(start,1.04,-12 if i%2 else 12),(end-1,1.12,12 if i%2 else -12)]:
        image.transform.scale_x=fit_x*scale;image.transform.scale_y=fit_y*scale
        image.transform.offset_x=offset;image.transform.offset_y=18
        for prop in ('scale_x','scale_y','offset_x'):image.transform.keyframe_insert(prop,frame=frame)
    fade(image,start,end,12 if i==0 else 5,24 if i==6 else 5)
    title=strips.new_image(shot['title'],str(ASSETS/f'overlays/{i:02}.png'),3,start,fit_method='FIT')
    title.frame_final_end=end;title.blend_type='ALPHA_OVER'
    fade(title,start,end,10,20 if i==6 else 5)

for index,(start,end) in enumerate([(193,225),(225,257),(257,289)]):
    strip=strips.new_image('Green lock selection '+str(index+1),str(ASSETS/f'overlays/lock-{index}.png'),4,start,fit_method='FIT')
    strip.frame_final_end=end;strip.blend_type='ALPHA_OVER'
    fade(strip,start,end,3,3)

sound=strips.new_sound('Original score • Sonar / pulse / impact',str(ASSETS/'soundtrack.wav'),5,1)
sound.frame_final_end=721
scene.render.image_settings.file_format='PNG'
qa=ASSETS/'qa';qa.mkdir(exist_ok=True)
for frame in (36,132,236,324,420,528,660):
    scene.frame_set(frame)
    scene.render.filepath=str(qa/f'{frame:04}.png')
    bpy.ops.render.render(write_still=True)

scene.render.image_settings.file_format='FFMPEG'
scene.render.ffmpeg.format='MPEG4';scene.render.ffmpeg.codec='H264'
scene.render.ffmpeg.constant_rate_factor='HIGH';scene.render.ffmpeg.ffmpeg_preset='GOOD'
scene.render.ffmpeg.gopsize=24
scene.render.ffmpeg.audio_codec='AAC';scene.render.ffmpeg.audio_bitrate=192
scene.render.ffmpeg.audio_mixrate=44100;scene.render.ffmpeg.audio_channels='STEREO'
scene.render.filepath=str(ROOT/'output/shinkai-zero-promo-30s.mp4')
scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(ASSETS/'promo-30s.blend'))
print('ENCODING_30_SECONDS',flush=True)
bpy.ops.render.render(animation=True)
print('PROMO_COMPLETE',scene.render.filepath,flush=True)
