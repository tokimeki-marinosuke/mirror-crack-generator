/** Compact explanations: hover, keyboard focus or tap, with one viewport-clamped tooltip. */
export function mountHelp(root:HTMLElement):void {
 const tooltip=document.createElement('div');tooltip.id='editor-help-tooltip';tooltip.className='help-tooltip';tooltip.setAttribute('role','tooltip');tooltip.hidden=true;root.append(tooltip);
 let active:HTMLButtonElement|undefined,pinned=false,timer:ReturnType<typeof setTimeout>|undefined;
 function hide(){clearTimeout(timer);active?.removeAttribute('aria-describedby');active?.setAttribute('aria-expanded','false');active=undefined;pinned=false;tooltip.hidden=true;}
 function position(){
  if(!active)return;const r=active.getBoundingClientRect();
  tooltip.style.left=`${Math.max(8,Math.min(r.left,innerWidth-tooltip.offsetWidth-8))}px`;
  const below=r.bottom+6;tooltip.style.top=`${Math.max(8,below+tooltip.offsetHeight<=innerHeight-8?below:r.top-tooltip.offsetHeight-6)}px`;
 }
 function show(button:HTMLButtonElement){clearTimeout(timer);if(active!==button){hide();active=button;tooltip.textContent=button.dataset.help??'';}tooltip.hidden=false;button.setAttribute('aria-describedby',tooltip.id);button.setAttribute('aria-expanded','true');position();}
 function leave(){clearTimeout(timer);timer=setTimeout(()=>{if(!pinned&&document.activeElement!==active)hide();},120);}
 for(const paragraph of root.querySelectorAll<HTMLElement>('p.hint:not([id])')){
  const button=document.createElement('button');button.type='button';button.className='help-button';button.textContent='?';button.dataset.help=paragraph.textContent??'';button.setAttribute('aria-label',`説明：${(paragraph.textContent??'').slice(0,24)}`);button.setAttribute('aria-expanded','false');
  paragraph.replaceWith(button);
  button.addEventListener('mouseenter',()=>show(button));button.addEventListener('mouseleave',leave);
  button.addEventListener('focus',()=>show(button));button.addEventListener('blur',hide);
  button.addEventListener('click',event=>{event.preventDefault();if(active===button&&pinned)hide();else{show(button);pinned=true;}});
 }
 tooltip.addEventListener('mouseenter',()=>clearTimeout(timer));tooltip.addEventListener('mouseleave',leave);
 document.addEventListener('pointerdown',event=>{if(event.target!==active&&!tooltip.contains(event.target as Node))hide();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&active){event.preventDefault();hide();}});
 window.addEventListener('resize',position);window.addEventListener('scroll',event=>{if(event.target instanceof Node&&tooltip.contains(event.target))return;if(active){const r=active.getBoundingClientRect();if(r.bottom<0||r.top>innerHeight)hide();else position();}},true);
}
