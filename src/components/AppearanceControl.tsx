"use client";
import { useEffect, useState } from "react";
import { Palette, X } from "lucide-react";
import { Appearance, DEFAULT_APPEARANCE, normalizeAppearance, mixColor, contrastColor } from "@/lib/appearance";
const CACHE="electricista360_appearance";
const fields: {key:keyof Appearance;label:string;fallback:string}[]=[
 {key:"writing",label:"Color de escritura (todos los apartados)",fallback:"#0f172a"},
 {key:"text",label:"Texto de toda la página",fallback:"#0f172a"},
 {key:"accent",label:"Botones, enlaces y detalles",fallback:"#2563eb"},
 {key:"background",label:"Fondo de las páginas",fallback:"#f8fafc"},
 {key:"surface",label:"Tarjetas y formularios",fallback:"#ffffff"},
 {key:"sidebar",label:"Fondo del menú",fallback:"#0f172a"},
];
export function applyAppearance(colors:Appearance) {
 const root=document.documentElement;
 const effective={...colors,text:colors.text||colors.writing||(colors.surface?contrastColor(colors.surface):""),writing:colors.writing||colors.text||(colors.surface?contrastColor(colors.surface):"")};
 for(const field of fields) {
  root.toggleAttribute("data-color-"+field.key,Boolean(effective[field.key]));
  if(effective[field.key]) root.style.setProperty("--app-"+field.key,effective[field.key]);
  else root.style.removeProperty("--app-"+field.key);
 }
 if(colors.sidebar) root.style.setProperty("--app-sidebar-ink",contrastColor(colors.sidebar));
 if(colors.accent) {
  const levels:Record<number,number>={50:.94,100:.86,200:.72,300:.5,400:.25,500:0,600:0,700:-.15,800:-.3,900:-.45,950:-.6};
  for(const [level,amount] of Object.entries(levels)) {
   root.style.setProperty("--color-blue-"+level,mixColor(colors.accent,amount<0?"#000000":"#ffffff",Math.abs(amount)));
   root.style.setProperty("--color-indigo-"+level,mixColor(colors.accent,amount<0?"#000000":"#ffffff",Math.abs(amount)));
  }
  root.style.setProperty("--app-accent-ink",contrastColor(colors.accent));
 } else {
  for(const level of [50,100,200,300,400,500,600,700,800,900,950]) {
   root.style.removeProperty("--color-blue-"+level); root.style.removeProperty("--color-indigo-"+level);
  }
 }
}
export default function AppearanceControl() {
 const [open,setOpen]=useState(false);
 const [colors,setColors]=useState<Appearance>(DEFAULT_APPEARANCE);
 const [saved,setSaved]=useState<Appearance>(DEFAULT_APPEARANCE);
 const [saving,setSaving]=useState(false);
 const [message,setMessage]=useState("");
 useEffect(()=>{
  try { const cached=normalizeAppearance(JSON.parse(localStorage.getItem(CACHE)||"{}")); setColors(cached);setSaved(cached);applyAppearance(cached); } catch {}
  let active=true;
  fetch("/api/appearance",{cache:"no-store"}).then(r=>{if(!r.ok) throw Error();return r.json();}).then(data=>{
   if(!active)return;const next=normalizeAppearance(data);setColors(next);setSaved(next);applyAppearance(next);localStorage.setItem(CACHE,JSON.stringify(next));
  }).catch(()=>{if(active)setMessage("No se pudieron cargar los colores guardados.");});
  return ()=>{active=false;};
 },[]);
 const change=(next:Appearance)=>{setColors(next);applyAppearance(next);setMessage("Vista previa: pulsa Guardar colores para conservarla.");};
 const cancel=()=>{setColors(saved);applyAppearance(saved);setOpen(false);setMessage("");};
 async function save() {
  setSaving(true);setMessage("");
  try {
   const response=await fetch("/api/appearance",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(colors)});
   if(!response.ok)throw Error();
   const next=normalizeAppearance(await response.json());setColors(next);setSaved(next);applyAppearance(next);
   try {localStorage.setItem(CACHE,JSON.stringify(next));}catch{}
   setMessage("Colores guardados para toda la aplicación.");
  }catch{setMessage("No se guardaron los colores. Vuelve a intentarlo.");}
  finally{setSaving(false);}
 }
 return <div className="appearance-control no-print">
  <button type="button" onClick={()=>setOpen(!open)} aria-expanded={open} aria-controls="app-colors-panel" className="appearance-trigger"><Palette size={19}/> Colores</button>
  {open&&<section id="app-colors-panel" aria-label="Colores de toda la aplicación" className="appearance-panel">
   <div className="flex items-center justify-between gap-3"><strong>Colores de toda la aplicación</strong><button type="button" aria-label="Cerrar colores" onClick={cancel}><X size={20}/></button></div>
   <p>Elige cómo se ve toda la página y el color con el que escribes en cualquier apartado. Los selectores de cada documento permiten darle otros colores.</p>
   {fields.map(field=><label key={field.key} className="appearance-color-row"><span>{field.label}</span><input type="color" aria-label={field.label} value={colors[field.key]||field.fallback} onChange={e=>change({...colors,[field.key]:e.target.value})}/><button type="button" onClick={()=>change({...colors,[field.key]:""})} aria-label={"Restablecer "+field.label}>Normal</button></label>)}
   <p role="status" aria-live="polite">{message}</p>
   <div className="flex flex-wrap gap-2"><button type="button" disabled={saving} onClick={save} className="appearance-save">{saving?"Guardando...":"Guardar colores"}</button><button type="button" onClick={()=>change({...DEFAULT_APPEARANCE})}>Restablecer todos</button><button type="button" onClick={cancel}>Cancelar</button></div>
  </section>}
 </div>;
}
