import { EFFECT_PRESETS, type Impact } from '../state/editorState';
/** A single impact group with tree keyboard navigation; no change to render order. */
export function mountImpactLayers(container:HTMLElement, select:(id:number)=>void){
 let expanded=true;
 const parent=document.createElement('div');parent.setAttribute('role','treeitem');parent.dataset.layerRoot='';parent.tabIndex=0;
 const heading=document.createElement('span');heading.className='layer-heading';
 const children=document.createElement('div');children.setAttribute('role','group');
 parent.append(heading,children);container.append(parent);
 function expand(value:boolean){expanded=value;parent.setAttribute('aria-expanded',String(value));children.hidden=!value;parent.tabIndex=!value||!children.querySelector('[aria-selected="true"]')?0:-1;heading.textContent=`${value?'▾':'▸'} 衝撃点`;}expand(true);
 container.addEventListener('click',event=>{
  const target=event.target;if(!(target instanceof Element))return;
  const row=target.closest<HTMLElement>('[data-impact-id]');
  if(row){select(Number(row.dataset.impactId));return;}
  if(target===parent||target.closest('.layer-heading')){expand(!expanded);parent.focus();}
 });
 container.addEventListener('keydown',event=>{
  const target=event.target;if(!(target instanceof HTMLElement))return;
  if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End','Enter',' '].includes(event.key))return;
  event.preventDefault();
  const rows=Array.from(children.querySelectorAll<HTMLElement>('[data-impact-id]'));
  const items=expanded?[parent,...rows]:[parent],index=items.indexOf(target);
  if(event.key==='ArrowLeft'){if(target===parent)expand(false);else parent.focus();return;}
  if(event.key==='ArrowRight'){if(target===parent){if(!expanded)expand(true);else rows[0]?.focus();}return;}
  if(event.key==='Enter'||event.key===' '){if(target===parent)expand(!expanded);else target.click();return;}
  const next=event.key==='Home'?0:event.key==='End'?items.length-1:Math.max(0,Math.min(items.length-1,index+(event.key==='ArrowUp'?-1:1)));
  const item=items[next];if(!item)return;item.focus();if(item.dataset.impactId)select(Number(item.dataset.impactId));
 });
 return {
  render(impacts:readonly Impact[],selected:number|null){
   const focused=document.activeElement,hadFocus=focused instanceof HTMLElement&&container.contains(focused);
   const focusedId=focused instanceof HTMLElement?focused.dataset.impactId:undefined;
   const ids=new Set(impacts.map(i=>String(i.id)));
   for(const row of children.querySelectorAll<HTMLElement>('[data-impact-id]'))if(!ids.has(row.dataset.impactId!))row.remove();
   children.querySelector('.layer-empty')?.remove();
   parent.setAttribute('aria-label',`衝撃点 ${impacts.length}点`);
   parent.tabIndex=selected===null||!expanded?0:-1;
   for(const [index,impact] of [...impacts].reverse().entries()){
    let row=children.querySelector<HTMLButtonElement>(`[data-impact-id="${impact.id}"]`);
    if(!row){row=document.createElement('button');row.append(document.createElement('span'),document.createElement('span'));}
    row.type='button';row.className='impact-layer';row.dataset.impactId=String(impact.id);
    row.setAttribute('role','treeitem');row.setAttribute('aria-selected',String(impact.id===selected));row.tabIndex=impact.id===selected?0:-1;
    row.setAttribute('aria-label',`衝撃点 ${impact.id}`);
    const icon=row.children[0] as HTMLSpanElement;icon.className='layer-icon';icon.setAttribute('aria-hidden','true');icon.textContent='✳';
    const text=row.children[1] as HTMLSpanElement;
    let name=text.querySelector('strong'),detail=text.querySelector('small');
    if(!name||!detail){name=document.createElement('strong');detail=document.createElement('small');text.replaceChildren(name,detail);}
    name.textContent=`衝撃点 ${impact.id}`;detail.textContent=`${impact.effectPreset?EFFECT_PRESETS[impact.effectPreset].label:impact.preset==='realistic'?'Realistic':'Anime'} · シード ${impact.seed}`;if(children.children[index]!==row)children.insertBefore(row,children.children[index]??null);
   }
   if(!impacts.length){const empty=document.createElement('p');empty.className='layer-empty';empty.textContent='衝撃点なし';children.append(empty);}
   if(hadFocus){const row=focusedId?children.querySelector<HTMLElement>(`[data-impact-id="${focusedId}"]`):null;(row??(focusedId?children.querySelector<HTMLElement>('[aria-selected="true"]'):null)??parent).focus({preventScroll:true});}
  }
 };
}
