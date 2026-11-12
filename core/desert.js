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

export const DUST_GRAINS = grains.length;
export const GLINT_GRAINS = 80;

export function dustStyle(light) {
    const illumination = 0.32 + 0.68 * light.day / 255;
    return { illumination, color: mix([146,153,200], [255,216,141], illumination) };
}

// One windblown grain of dust: where it is and how wide. Grain i belongs to layer i % 3.
export function dustAt(i, elapsed, theme) {
    const dunes = theme === 'dunes';
    const [a,b,c,d,e] = grains[i];
    const phase = wrap(elapsed * (0.11+b*0.14)+a,1);
    const x = dunes ? 684 + phase*206 + d*57 : 125 + phase*650 + d*126;
    const y = dunes ? 356 - Math.sin(phase*Math.PI)*23 + (b-0.5)*19
        : 426 + c*48 - Math.sin(phase*Math.PI)*14 + Math.sin(elapsed+e*TAU)*3;
    return { x: Math.round(x), y: Math.round(y), width: 1+Math.floor(c*4) };
}

function paintDust(paint, elapsed, light, theme) {
    const { illumination, color } = dustStyle(light);
    for (let layer=0; layer<3; layer++) {
        paint.color(color, illumination * (0.10 + layer * 0.046));
        for (let i=layer; i<grains.length; i+=3) {
            const g = dustAt(i, elapsed, theme);
            paint.rectangle(g.x, g.y, g.width, 1);
        }
        paint.fill();
    }
}

export const PLATEAU_TUFTS = plateauTufts;
export const REEDS = reeds;

export function tuftStyle(light, oasis) {
    const daylight=light.day/255;
    return { color: mix([132,141,174],oasis?[205,207,113]:[255,207,103],daylight), alpha: 0.46+daylight*0.29 };
}

export const tuftWindAt = (x, elapsed) => Math.sin(elapsed*2.25+x*0.08);

// Draw one tuft whose base is at (x, y). Used for the tufts and for per-tuft sprites.
export function paintTuftAt(paint, x, y, wind) {
    for (let blade=-2; blade<=2; blade++) {
        const height=6+Math.abs(blade)*2;
        for (let row=0; row<height; row++) {
            const f=row/height;
            paint.rectangle(Math.round(x+blade*f*4+wind*f*f*4),y-row,1,1);
        }
    }
}

function paintTufts(paint, elapsed, light, positions, oasis) {
    const style = tuftStyle(light, oasis);
    paint.color(style.color, style.alpha);
    for (const [x,y] of positions)
        paintTuftAt(paint, x, y, tuftWindAt(x, elapsed));
    paint.fill();
}

export const OASIS_WATER = oasisWater;

// Colour of the oasis water sparkles and where the light comes from. Glint i belongs to layer i % 4.
export function glintStyle(light) {
    const day=light.day/255;
    const moon=light.moon[2]/255;
    const sun=light.sun[2]/255;
    const celestial=sun>=moon?light.sun:light.moon;
    const tint=sun>=moon?light.sunlight:[172,198,248];
    const strength=Math.max(sun,moon);
    return { day, celestialX: celestial[0], strength, color: mix([110,175,220],tint,0.3+strength*0.47) };
}

export const glintAlpha = (layer, style) => (0.10+0.07*layer)*(0.65+style.day*0.5);

export function glintAt(i, elapsed, style) {
    const [a,b,c,d,e]=grains[i];
    const shift=wrap(a+elapsed*(0.015+e*0.019),1);
    const x=128+shift*690;
    const y=441+b*55+Math.sin(elapsed*(0.8+c)+d*TAU)*1.8;
    const glint=Math.exp(-(((x-style.celestialX)/115)**2));
    const length=2+c*10+glint*style.strength*11;
    return { x: Math.round(x), y: Math.round(y), width: Math.round(length) };
}

function paintOasisWater(paint, elapsed, light) {
    paint.save();
    paint.moveTo(...oasisWater[0]);
    for (const point of oasisWater.slice(1)) paint.lineTo(...point);
    paint.close();
    paint.clip();
    const style = glintStyle(light);
    for (let layer=0;layer<4;layer++) {
        paint.color(style.color, glintAlpha(layer, style));
        for (let i=layer;i<GLINT_GRAINS;i+=4) {
            const g = glintAt(i, elapsed, style);
            paint.rectangle(g.x, g.y, g.width, 1);
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
