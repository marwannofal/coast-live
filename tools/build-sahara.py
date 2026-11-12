"""Prepare layered terrain and lit stills from the Sahara concept images (art-source/*.png).

The sky in the stills comes from the shared core (tools/render-frame.mjs), so Node.js is required.
"""
from pathlib import Path
import sys
import json
import subprocess
import numpy as np
from PIL import Image
from scipy.ndimage import distance_transform_edt, median_filter, uniform_filter1d

ROOT=Path(__file__).resolve().parents[1]
SIZE=(960,540)
ANCHORS=[0,300,360,440,650,1000,1380,1560,1640,1800,1999]
SKY_SCALES={'dunes':0.69,'plateau':0.78,'oasis':0.80}
PROFILES={
    'dunes':[(0,297),(40,294),(70,286),(115,284),(145,284),(181,291),(220,299),(260,292),(300,298),(340,287),(375,284),(405,287),(445,295),(480,291),(530,298),(560,293),(600,291),(650,284),(680,284),(710,294),(760,301),(800,290),(850,296),(900,288),(930,291),(959,295)],
    'plateau':[(0,317),(28,317),(35,315),(60,314),(82,315),(90,322),(94,349),(128,348),(168,340),(202,333),(233,332),(256,338),(287,343),(310,351),(316,323),(326,317),(372,314),(400,311),(415,308),(457,301),(485,297),(515,294),(558,298),(565,319),(570,348),(604,348),(650,343),(674,336),(705,334),(722,345),(756,352),(779,346),(801,327),(821,320),(846,320),(859,329),(866,349),(894,345),(930,338),(959,338)],
    'oasis':[(0,342),(36,340),(65,332),(100,325),(114,325),(133,331),(172,339),(209,341),(233,338),(268,341),(300,336),(333,333),(370,338),(402,340),(443,334),(470,338),(500,330),(537,326),(555,320),(578,327),(600,333),(641,338),(675,339),(720,340),(758,335),(790,337),(840,328),(875,332),(911,337),(959,329)],
}
# Color multipliers at each solar anchor, in order from midnight to night.
TINTS=np.array([
 [0.30,0.35,0.56],[0.43,0.44,0.65],[0.62,0.53,0.70],[1.04,0.76,0.70],
 [1.02,0.95,0.89],[1.0,1.0,1.0],[1.02,0.95,0.87],[1.06,0.69,0.63],
 [0.58,0.46,0.62],[0.37,0.38,0.60],[0.30,0.35,0.56],
])
PALM_REGIONS=[(229,266,374,389),(586,312,730,399)]

def terrain_profile(rgb,guide,theme):
    x=np.arange(SIZE[0])
    expected=np.interp(x,*np.array(guide).T)
    smooth=uniform_filter1d(rgb.astype(float),3,axis=0)
    contrast=np.linalg.norm(smooth[3:]-smooth[:-3],axis=2)
    out=expected.copy()
    for col,y0 in enumerate(expected):
        a=max(0,int(y0)-9)
        b=min(364,int(y0)+10)
        if b<=a: continue
        yy=np.arange(a,b)
        top=smooth[np.maximum(0,yy-3),col]
        bottom=smooth[yy+2,col]
        strength=contrast[yy-1,col] - 0.75*np.abs(yy-y0)
        # Exclude palm crowns from the underlying skyline detection.
        if theme=='oasis':
            strength[(bottom[:,0]<162)&(top[:,0]<175)]=-100
        best=int(np.argmax(strength))
        if strength[best]>4: out[col]=yy[best]
    return np.rint(median_filter(out,3)).astype(int)

def rgba(rgb,alpha,tint):
    arr=np.empty((*rgb.shape[:2],4),dtype=np.uint8)
    arr[:,:,:3]=np.clip(rgb*tint,0,255).astype(np.uint8)
    arr[:,:,3]=np.where(alpha,255,0)
    return Image.fromarray(arr)

def save_png(image,path):
    image.quantize(colors=192,method=Image.Quantize.FASTOCTREE,dither=Image.Dither.NONE).save(path,optimize=True)

def sky(frame,theme):
    raw=subprocess.run(['node',str(ROOT/'tools'/'render-frame.mjs'),str(frame),'424'],capture_output=True,check=True).stdout
    im=Image.frombytes('RGB',(SIZE[0],424),raw)
    height=round(424*SKY_SCALES[theme])
    sky=im.resize((SIZE[0],height),Image.Resampling.BILINEAR)
    out=Image.new('RGB',SIZE)
    out.paste(sky,(0,0))
    strip=sky.crop((0,height-1,SIZE[0],height)).resize((SIZE[0],SIZE[1]-height))
    out.paste(strip,(0,height))
    return out

def palette(frame):
    pos=np.searchsorted(ANCHORS,frame,side='right')
    if pos==len(ANCHORS): return TINTS[-1]
    a=pos-1
    f=(frame-ANCHORS[a])/(ANCHORS[pos]-ANCHORS[a])
    return TINTS[a]*(1-f)+TINTS[pos]*f

def prepare(theme,source):
    folder=ROOT/'assets'/'themes'/theme
    folder.mkdir(parents=True,exist_ok=True)
    rgb=np.asarray(Image.open(source).convert('RGB').resize(SIZE,Image.Resampling.NEAREST)).copy()
    skyline=terrain_profile(rgb,PROFILES[theme],theme)
    y=np.arange(SIZE[1])[:,None]
    land=y>=skyline
    original=rgb.copy()
    palms=[]
    if theme=='oasis':
        for x1,y1,x2,y2 in PALM_REGIONS:
            crop=rgb[y1:y2,x1:x2].astype(float)
            r,g,b=np.moveaxis(crop,-1,0)
            crown=(r<172)&(g>0.64*r)&(b<113)
            full=np.zeros(land.shape,dtype=bool)
            full[y1:y2,x1:x2]=crown
            palms.append((x1,y1,x2,y2,crown))
            # Keep dune geometry under palm silhouettes.
            remove=full&land
            nearest=distance_transform_edt(remove,return_distances=False,return_indices=True)
            rgb[remove]=rgb[nearest[0][remove],nearest[1][remove]]
    for slot,(frame,tint) in enumerate(zip(ANCHORS,TINTS)):
        save_png(rgba(rgb,land,tint),folder/f'ground-{slot:02}.png')
        for j,(x1,y1,x2,y2,mask) in enumerate(palms):
            sprite=rgba(original[y1:y2,x1:x2],mask,tint)
            save_png(sprite,folder/f'palm-{j}-{slot:02}.png')
    # Every second slot of a 33-step ladder: still-00, still-02 ... still-32 (see core/themes.js).
    for slot in range(0,33,2):
        frame=round(slot*1999/32)
        still=Image.new('RGB',SIZE)
        still.paste(sky(frame,theme),(0,0))
        tint=palette(frame)
        terrain=rgba(rgb,land,tint)
        still.paste(terrain,mask=terrain.getchannel('A'))
        for x1,y1,x2,y2,mask in palms:
            sprite=rgba(original[y1:y2,x1:x2],mask,tint)
            still.paste(sprite,(x1,y1),sprite.getchannel('A'))
        still.save(folder/f'still-{slot:02}.jpg',quality=87,optimize=True)

if __name__=='__main__':
    if len(sys.argv)!=4:
        raise SystemExit('Usage: build-sahara.py art-source/dunes.png art-source/plateau.png art-source/oasis.png')
    for theme,path in zip(PROFILES,sys.argv[1:]):
        prepare(theme,path)
    (ROOT/'assets'/'themes'/'layout.json').write_text(json.dumps({'anchors':ANCHORS,'skyScales':SKY_SCALES,'palms':PALM_REGIONS}))
