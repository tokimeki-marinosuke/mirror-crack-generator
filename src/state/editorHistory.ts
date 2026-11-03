import type { EditorSnapshot } from './editorState';
/** Selection alone is navigation, not an edit. Snapshots contain no generated geometry or image. */
function same(a:EditorSnapshot,b:EditorSnapshot):boolean {
 const comparable=(s:EditorSnapshot)=>({...s,selected:null,impacts:s.impacts.map(i=>({...i,overrides:i.overrides??{},surfaceOverrides:i.surfaceOverrides??{}}))});
 return JSON.stringify(comparable(a))===JSON.stringify(comparable(b));
}
type Entry={before:EditorSnapshot;after:EditorSnapshot};
export class EditorHistory {
 private past:Entry[]=[];
 private future:Entry[]=[];
 private groupFuture:Entry[]=[];
 private groupEvicted:Entry|undefined;
 private group:string|undefined;
 constructor(private readonly limit=50){if(!Number.isInteger(limit)||limit<1)throw new Error('履歴上限が不正です。');}
 get canUndo():boolean{return this.past.length>0;}
 get canRedo():boolean{return this.future.length>0;}
 endGroup():void{this.group=undefined;this.groupFuture=[];this.groupEvicted=undefined;}
 record(before:EditorSnapshot,after:EditorSnapshot,group?:string):void {
  if(same(before,after))return;
  const last=this.past.at(-1);
  if(group&&group===this.group&&last){
   last.after=after;
   if(same(last.before,after)){this.past.pop();if(this.groupEvicted)this.past.unshift(this.groupEvicted);this.future=this.groupFuture;this.endGroup();return;}
  }else{
   this.endGroup();this.groupFuture=group?this.future:[];
   this.past.push({before,after});if(this.past.length>this.limit){const removed=this.past.shift();if(group)this.groupEvicted=removed;}
  }
  this.group=group;this.future=[];
 }
 undo():EditorSnapshot|undefined {
  this.endGroup();const entry=this.past.pop();if(!entry)return;
  this.future.push(entry);return entry.before;
 }
 redo():EditorSnapshot|undefined {
  this.endGroup();const entry=this.future.pop();if(!entry)return;
  this.past.push(entry);return entry.after;
 }
}
