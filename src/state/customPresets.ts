import type { GlassMaterialSettings } from '../core/glassMaterial';
import type { ImpactParams, StylePreset } from './editorState';
import type { ShardImageSettings } from './shardImageState';
export type PresetGroup = 'material' | 'shard' | 'point';
export type PresetValues = {
 material: GlassMaterialSettings;
 shard: ShardImageSettings;
 point: { params: ImpactParams; darkness: number; style: StylePreset };
};
export type SavedPreset = { [K in PresetGroup]: { group: K; name: string; values: PresetValues[K] } }[PresetGroup];
export const PRESET_STORAGE_KEY = 'mirror-crack.custom-presets.v1';
const ranges: Record<string, [number, number]> = {radialCount:[4,45],lengthPercent:[10,300],complexity:[0,180],concentricDensity:[0,190],centerRadius:[0,80],centerDensity:[0,100],maxSegments:[1,5000],lineWidth:[.5,9],opacity:[0,100],highlight:[0,100]};
function numeric(value:unknown, schema:Record<string,[number,number]>):boolean {
 if(!value || typeof value!=='object')return false;
 const data=value as Record<string,unknown>;
 return Object.keys(data).length===Object.keys(schema).length&&Object.entries(schema).every(([k,[min,max]])=>typeof data[k]==='number'&&Number.isFinite(data[k])&&(data[k] as number)>=min&&(data[k] as number)<=max);
}
export function validPreset(value:unknown):value is SavedPreset {
 if(!value||typeof value!=='object')return false;
 const p=value as Record<string,unknown>;
 if(typeof p.name!=='string'||!p.name.trim()||p.name.length>40)return false;
 if(p.group==='shard')return numeric(p.values,{displacement:[0,200],rotation:[0,200],reflection:[0,200],gap:[0,200]});
 if(p.group==='material'){
  if(!p.values||typeof p.values!=='object')return false;
  const {enabled,...rest}=p.values as Record<string,unknown>;
  return typeof enabled==='boolean'&&numeric(rest,{thickness:[0,200],lightDirection:[0,360],reflectionWidth:[0,200],edgeReflection:[0,200],interiorReflection:[0,200],microDetail:[0,200]});
 }
 if(p.group==='point'){
  const v=p.values as PresetValues['point']|undefined;
  return !!v&&['realistic','anime'].includes(v.style)&&numeric(v.params,ranges)&&Number.isInteger(v.params.radialCount)&&Number.isInteger(v.params.maxSegments)&&Number.isFinite(v.darkness)&&v.darkness>=0&&v.darkness<=100;
 }
 return false;
}
export function decodePresets(raw:string|null):SavedPreset[]{
 if(!raw)return [];
 if(raw.length>100000)throw new Error('保存データが大きすぎます。');
 const data:unknown=JSON.parse(raw);
 if(!Array.isArray(data)||data.length>60||!data.every(validPreset))throw new Error('保存済みプリセットを読み込めません。');
 return data;
}
/** Same-name saves replace only that group's preset. Storage must succeed before UI state changes. */
export function savePreset(existing:readonly SavedPreset[], preset:SavedPreset):SavedPreset[]{
 if(!validPreset(preset))throw new Error('名前は1〜40文字で設定してください。');
 const next=existing.filter(p=>p.group!==preset.group||p.name!==preset.name);
 if(next.filter(p=>p.group===preset.group).length>=20)throw new Error('保存は各種類20件までです。');
 return [...next,structuredClone(preset)];
}
