// SPDX-License-Identifier: GPL-2.0-or-later
// Animated Sahara layers: dust, tufts and oasis water, drawn through the same
// `paint` interface as scene.js.
import { TAU, seededRandom, wrap } from './math.js';

// Top row of the effects layer (everything above it is sky or distant terrain).
export const DESERT_FX_TOP = 325;

const mix = (a, b, amount) => a.map((value, i) => value + (b[i] - value) * amount);

const next = seededRandom(1933);
const grains = Array.from({length: 108}, () => [
    next(), next(), next(), next(), next(),
]);
const oasisWater = [[135,455],[183,448],[260,441],[364,438],[488,440],[599,438],[678,440],
    [755,448],[812,459],[806,469],[763,476],[701,485],[628,492],[506,496],[395,493],
    [308,489],[227,482],[155,468]];
const plateauTufts = [[51,513],[62,515],[78,518],[222,508],[237,511],[250,514],[843,516],[866,521],[880,521]];
const reeds = [[167,457],[185,470],[222,487],[577,495],[796,470],[813,472]];

export function palmAngle(index, elapsed) {
    return Math.sin(elapsed * 0.82 + index * 1.37) * 1.8 + Math.sin(elapsed * 2.1 + index) * 0.45;
}

function paintDust(paint, elapsed, light, theme) {
    const dunes = theme === 'dunes';
    const illumination = 0.32 + 0.68 * light.day / 255;
    const color = mix([146,153,200], [255,216,141], illumination);
    for (let layer=0; layer<3; layer++) {
        paint.color(color, illumination * (0.10 + layer * 0.046));
        for (let i=layer; i<grains.length; i+=3) {
            const [a,b,c,d,e] = grains[i];
            const phase = wrap(elapsed * (0.11+b*0.14)+a,1);
            const x = dunes ? 684 + phase*206 + d*57 : 125 + phase*650 + d*126;
            const y = dunes ? 356 - Math.sin(phase*Math.PI)*23 + (b-0.5)*19
                : 426 + c*48 - Math.sin(phase*Math.PI)*14 + Math.sin(elapsed+e*TAU)*3;
            paint.rectangle(Math.round(x),Math.round(y),1+Math.floor(c*4),1);
        }
        paint.fill();
    }
}

function paintTufts(paint, elapsed, light, positions, oasis) {
    const daylight=light.day/255;
    const color=mix([132,141,174],oasis?[205,207,113]:[255,207,103],daylight);
    paint.color(color,0.46+daylight*0.29);
    for (const [x,y] of positions) {
        for (let blade=-2; blade<=2; blade++) {
            const height=6+Math.abs(blade)*2;
            const wind=Math.sin(elapsed*2.25+x*0.08);
            for (let row=0; row<height; row++) {
                const f=row/height;
                paint.rectangle(Math.round(x+blade*f*4+wind*f*f*4),y-row,1,1);
            }
        }
    }
    paint.fill();
}

function paintOasisWater(paint, elapsed, light) {
    paint.save();
    paint.moveTo(...oasisWater[0]);
    for (const point of oasisWater.slice(1)) paint.lineTo(...point);
    paint.close();
    paint.clip();
    const day=light.day/255;
    const moon=light.moon[2]/255;
    const sun=light.sun[2]/255;
    const celestial=sun>=moon?light.sun:light.moon;
    const tint=sun>=moon?light.sunlight:[172,198,248];
    const source=mix([110,175,220],tint,0.3+Math.max(sun,moon)*0.47);
    for (let layer=0;layer<4;layer++) {
        paint.color(source,(0.10+0.07*layer)*(0.65+day*0.5));
        for (let i=layer;i<80;i+=4) {
            const [a,b,c,d,e]=grains[i];
            const shift=wrap(a+elapsed*(0.015+e*0.019),1);
            const x=128+shift*690;
            const y=441+b*55+Math.sin(elapsed*(0.8+c)+d*TAU)*1.8;
            const glint=Math.exp(-(((x-celestial[0])/115)**2));
            const length=2+c*10+glint*Math.max(sun,moon)*11;
            paint.rectangle(Math.round(x),Math.round(y),Math.round(length),1);
        }
        paint.fill();
    }
    paint.restore();
}

export function paintDesert(paint, elapsed, light, theme) {
    if (theme==='oasis') {
        paintOasisWater(paint,elapsed,light);
        paintTufts(paint,elapsed,light,reeds,true);
    } else {
        paintDust(paint,elapsed,light,theme);
        if(theme==='plateau') paintTufts(paint,elapsed,light,plateauTufts,false);
    }
}
