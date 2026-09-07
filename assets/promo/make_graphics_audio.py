"""Original typography and procedural score; no external music or stock footage."""
from pathlib import Path
import json, math, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/promo'
W,H=1920,1080
FONT='/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc'
LIGHT='/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc'
def font(size,light=False):return ImageFont.truetype(LIGHT if light else FONT,size)
CYAN=(113,245,222,255); WHITE=(228,245,245,255)
shots=[
 ('INTO THE ABYSS','深海のゼロ','闇に音を放ち、重い一撃を見届ける。'),
 ('01 / SONAR','音を放て。闇を暴け。','索敵は、敵への合図にもなる。'),
 ('02 / TARGET LOCK','狙う敵を、切り替えろ。','右クリック / E で対象切替。ロックした敵は緑に。'),
 ('03 / TORPEDO','一撃を、見届けろ。','追尾する誘導魚雷。進路を読む手動魚雷。'),
 ('DISCOVER / UNLOCK','発見が、次を開く。','コーバック号を発見し、任務クリアで解放。'),
 ('BOUNTY TARGET','賞金首は、氷の深部に。','円盤型巨大潜水艦に挑め。'),
 ('SUBMARINE ACTION / PC BROWSER','深海のゼロ','潜航を開始せよ。'),
]
durations=[4,4,4,4,4,5,5]
stills=[0,3,5,6,9,10,14]
(OUT/'storyboard.json').write_text(json.dumps([
 dict(start=sum(durations[:i]),end=sum(durations[:i+1]),still=stills[i],kicker=k,title=t,subtitle=s) for i,(k,t,s) in enumerate(shots)
],ensure_ascii=False,indent=2))

for i,(kicker,title,subtitle) in enumerate(shots):
    im=Image.new('RGBA',(W,H));d=ImageDraw.Draw(im)
    # Bottom veil preserves legibility against both cold ice and warm explosions.
    for y in range(H):
        a=int(220*max(0,(y-540)/(H-540))**.65)
        if y<110:a=max(a,int(95*(1-y/110)))
        d.line((0,y,W,y),fill=(1,11,17,a))
    d.text((84,52),'深海のゼロ  /  PROMOTION FILM',font=font(22),fill=(172,212,215,220))
    label=f'{i+1:02} / 07'
    d.text((W-84-d.textlength(label,font=font(23)),52),label,font=font(23),fill=CYAN)
    d.line((84,760,150,760),fill=CYAN,width=4)
    d.text((175,742),kicker,font=font(25),fill=CYAN)
    d.text((80,790),title,font=font(94 if i in (0,6) else 66),fill=WHITE)
    d.text((86,919),subtitle,font=font(30,True),fill=(193,223,227,255))
    d.text((86,1020),'GAME ASSET CINEMATICS  •  ゲーム内モデルを用いた演出映像',font=font(17,True),fill=(130,166,177,220))
    im.save(OUT/f'overlays/{i:02}.png')

# A restrained graphical sonar inset for the targeting explanation. The green
# selected contact changes across three separate overlay strips.
for selection in range(3):
    im=Image.new('RGBA',(W,H));d=ImageDraw.Draw(im)
    cx,cy,r=1570,345,155
    d.ellipse((cx-r-24,cy-r-24,cx+r+24,cy+r+24),fill=(0,15,23,210))
    for rr in (50,100,155):d.ellipse((cx-rr,cy-rr,cx+rr,cy+rr),outline=(83,163,165,180),width=2)
    d.line((cx-r,cy,cx+r,cy),fill=(69,126,143,180),width=1)
    d.line((cx,cy-r,cx,cy+r),fill=(69,126,143,180),width=1)
    d.polygon([(cx,cy-10),(cx-8,cy+10),(cx,cy+5),(cx+8,cy+10)],fill=CYAN)
    for j,(x,y) in enumerate([(-80,-85),(75,-55),(30,100)]):
        c=(101,255,143,255) if j==selection else (255,124,111,255)
        d.ellipse((cx+x-7,cy+y-7,cx+x+7,cy+y+7),fill=c)
        if j==selection:d.ellipse((cx+x-17,cy+y-17,cx+x+17,cy+y+17),outline=c,width=2)
    d.text((cx-140,cy+r+34),f'TARGET 0{selection+1} / LOCKED',font=font(22),fill=(101,255,143,255))
    d.text((cx-135,cy-r-65),'TARGETING / 操作イメージ',font=font(19),fill=WHITE)
    im.save(OUT/f'overlays/lock-{selection}.png')

# Generate 30 seconds of stereo music in sections: sub bass, suspended chords,
# pulse, percussion and sonar. Frequencies are composed here from scratch.
SR=44100;DURATION=30
audio=np.zeros((SR*DURATION,2),dtype=np.float32)
rng=np.random.default_rng(719)
def add(start,signal,level=1,pan=0):
    at=int(start*SR);signal=np.asarray(signal,dtype=np.float32)
    if at>=len(audio):return
    n=min(len(signal),len(audio)-at)
    audio[at:at+n,0]+=signal[:n]*level*math.sqrt((1-pan)/2)
    audio[at:at+n,1]+=signal[:n]*level*math.sqrt((1+pan)/2)
def tone(freq,length,attack=.05,release=.4):
    t=np.arange(int(SR*length))/SR
    env=np.minimum(1,t/max(.001,attack))*np.minimum(1,(length-t)/max(.001,release))
    return t,env
for sec in range(0,30,6):
    root=[36.708,32.703,43.654,38.891][(sec//6)%4]
    t,env=tone(root,6,.6,1)
    bass=(np.sin(2*np.pi*root*t)+.18*np.sin(2*np.pi*root*2*t))*.13*env
    add(sec,bass)
    for j,ratio in enumerate((4,6,9)):
        pad=(np.sin(2*np.pi*root*ratio*t)+.35*np.sin(2*np.pi*(root*ratio+.4)*t))*.035*env
        add(sec,pad,pan=(j-1)*.5)
    if sec>=6 and sec<24:
        intensity=.6 if sec<12 else 1 if sec<18 else 1.3
        for beat in range(12):
            start=sec+beat*.5
            tt,ee=tone(100,.3,.002,.28)
            kick=np.sin(2*np.pi*(42*tt+32*(1-np.exp(-tt*24))/24))*np.exp(-tt*15)
            add(start,kick,.18*intensity)
            if beat%2:
                noise=rng.normal(0,1,len(tt));noise[1:]-=.85*noise[:-1]
                add(start,noise*np.exp(-tt*45),.026*intensity,pan=.3)
            f=root*([4,6,8,9][beat%4]);tt,ee=tone(f,.4,.012,.35)
            add(start,np.sin(2*np.pi*f*tt)*ee,.042*intensity,pan=(-1 if beat%2 else 1)*.35)
for start in (0.5,4.2,8.2,9.5,10.8,16.2,20.2,25.1):
    t=np.arange(SR*3)/SR
    ping=np.sin(2*np.pi*(740*t+40*(1-np.exp(-t))))*np.exp(-t*2.9)*(1-np.exp(-t*90))
    add(start,ping,.23,pan=-.2)
    add(start+.36,ping,.065,pan=.5)
for start in (12.2,14.2,20.3,22.3,24.7):
    t=np.arange(SR*3)/SR;noise=rng.normal(0,1,len(t))
    rumble=np.sin(2*np.pi*(33*t+20*(1-np.exp(-t*6))/6))*np.exp(-t*1.8)
    noise=np.convolve(noise,np.ones(45)/45,mode='same')*np.exp(-t*3)
    add(start,(rumble+noise*1.5)*(1-np.exp(-t*70)),.35)
fade=np.minimum(1,np.arange(len(audio))/(SR*.7))*np.minimum(1,(len(audio)-1-np.arange(len(audio)))/(SR*2))
audio*=fade[:,None]
audio=np.tanh(audio*1.25)
audio*=.87/max(1e-6,float(np.max(np.abs(audio))))
with wave.open(str(OUT/'soundtrack.wav'),'wb') as f:
    f.setnchannels(2);f.setsampwidth(2);f.setframerate(SR)
    f.writeframes((audio*32767).astype('<i2').tobytes())
print('Wrote 7 title overlays, 3 radar overlays and 30-second stereo soundtrack.')
