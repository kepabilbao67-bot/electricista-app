"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

interface Conversation { id:string; contact_name:string; contact_identifier:string; channel:string; status:string; assigned_to:string|null; unread_count:number; tags:string; last_message_text:string; last_message_at:string }
interface Message { id:string; sender_type:string; sender_name:string; content:string; status:string; attempts:number; is_internal_note:number; created_at:string }
interface Detail { conversation:Conversation; contact?:{id:string;name:string;email:string;phone:string}; lead?:{id:string;name:string;status:string}; messages:Message[]; audit:{id:string;action:string;actor:string;created_at:string;details:string}[] }
const labels:Record<string,string>={open:"Abierto",pending:"Pendiente",resolved:"Resuelto",archived:"Archivado",client:"Cliente",agent:"Agente",system:"Sistema",ai:"IA",failed:"Error DEMO",sent_demo:"Enviado DEMO",delivered:"Recibido DEMO",internal:"Nota interna"};
const date=(s:string)=>s ? new Date(s.endsWith('Z')||s.includes('+')?s:s.replace(' ','T')+'Z').toLocaleString('es-ES') : '—';
function tags(s:string):string[] {try {const v=JSON.parse(s);return Array.isArray(v)?v.filter(x=>typeof x==='string'):[];} catch{return [];}}
async function api(body?:object,id?:string) {
  const res=await fetch('/api/communications/chats'+(id?'?id='+encodeURIComponent(id):''),body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'});
  const data=await res.json(); if(!res.ok) throw new Error(data.error || 'Error de comunicación'); return data;
}
export default function ChatInbox() {
  const [conversations,setConversations]=useState<Conversation[]>([]),[contacts,setContacts]=useState<{id:string;name:string}[]>([]);
  const [detail,setDetail]=useState<Detail|null>(null),[selected,setSelected]=useState('');
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [search,setSearch]=useState(''),[state,setState]=useState(''),[channel,setChannel]=useState(''),[assigned,setAssigned]=useState(''),[tag,setTag]=useState('');
  const [clientId,setClientId]=useState(''),[incoming,setIncoming]=useState(''),[draft,setDraft]=useState(''),[note,setNote]=useState(false),[simulateError,setSimulateError]=useState(false);
  const [owner,setOwner]=useState(''),[editTags,setEditTags]=useState('');
  const requestId=useRef(0), event=useRef<{key:string;id:string}|null>(null);
  const refresh=useCallback(async()=>{const data=await api();setConversations(data.conversations);setContacts(data.contacts);},[]);
  useEffect(()=>{refresh().catch(e=>setError(e.message)).finally(()=>setLoading(false));},[refresh]);
  async function open(id:string) {
    const token=++requestId.current;setSelected(id);setDetail(null);setError('');setBusy(true);
    try {await api({action:'read',conversationId:id});const d:Detail=await api(undefined,id);if(token!==requestId.current)return;setDetail(d);setOwner(d.conversation.assigned_to||'');setEditTags(tags(d.conversation.tags).join(', '));setDraft('');await refresh();}catch(e){setError(e instanceof Error?e.message:'Error');}finally{if(token===requestId.current)setBusy(false);}
  }
  async function mutate(body:Record<string,unknown>,clear?:()=>void) {
    if(busy)return;setBusy(true);setError('');
    const key=JSON.stringify(body);
    if(['receive','reply','note'].includes(String(body.action))){if(event.current?.key!==key)event.current={key,id:crypto.randomUUID()};body={...body,eventId:event.current.id};}
    try {const result=await api(body);clear?.();event.current=null;await refresh();if(selected){const d:Detail=await api(undefined,selected);setDetail(d);}if(result.status==='failed')setError('Fallo simulado: el mensaje se conserva. Puedes reintentar hasta 3 intentos totales.');}catch(e){setError(e instanceof Error?e.message:'Error');}finally{setBusy(false);}
  }
  const shown=conversations.filter(c=>(!state||c.status===state)&&(!channel||c.channel===channel)&&(!assigned||(assigned==='__none'?!c.assigned_to:c.assigned_to===assigned))&&(!tag||tags(c.tags).includes(tag))&&[c.contact_name,c.contact_identifier,c.last_message_text].join(' ').toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  return <section className="space-y-5" aria-busy={busy||loading}>
    <header><h1 className="page-title">Chats <span className="text-sm text-emerald-700">DEMO</span></h1><p className="page-subtitle">Bandeja local de Barymont. No envía WhatsApp, email, llamadas ni solicitudes a IA.</p><Link href="/comunicaciones" className="underline">Comunicaciones</Link></header>
    {error&&<div role="alert" className="rounded-lg bg-red-50 text-red-800 p-3">{error}</div>}
    <form className="card-static flex flex-wrap gap-3 items-end" onSubmit={e=>{e.preventDefault();void mutate({action:'receive',clientId,content:incoming},()=>setIncoming(''));}}>
      <label>Contacto existente<select className="input-field" value={clientId} onChange={e=>setClientId(e.target.value)} required><option value="">Selecciona un contacto</option>{contacts.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label className="flex-1 min-w-48">Mensaje simulado<input className="input-field" value={incoming} onChange={e=>setIncoming(e.target.value)} required maxLength={4000}/></label>
      <button className="btn-primary" disabled={busy||!clientId}>Recibir mensaje DEMO</button>
      {!loading&&!contacts.length&&<p>Crea un contacto de prueba en <Link className="underline" href="/clientes">Clientes</Link> dentro de la base local dedicada.</p>}
    </form>
    <div className="flex flex-wrap gap-3">
      <label>Buscar<input className="input-field" type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Contacto o último mensaje"/></label>
      <label>Estado<select className="input-field" value={state} onChange={e=>setState(e.target.value)}><option value="">Todos</option>{['open','pending','resolved','archived'].map(s=><option key={s} value={s}>{labels[s]}</option>)}</select></label>
      <label>Canal<select className="input-field" value={channel} onChange={e=>setChannel(e.target.value)}><option value="">Todos</option><option>DEMO</option></select></label>
      <label>Responsable<select className="input-field" value={assigned} onChange={e=>setAssigned(e.target.value)}><option value="">Todos</option><option value="__none">Sin asignar</option>{[...new Set(conversations.map(c=>c.assigned_to).filter(Boolean))].map(s=><option key={s} value={s!}>{s}</option>)}</select></label>
      <label>Etiqueta<select className="input-field" value={tag} onChange={e=>setTag(e.target.value)}><option value="">Todas</option>{[...new Set(conversations.flatMap(c=>tags(c.tags)))].map(s=><option key={s}>{s}</option>)}</select></label>
      <button className="btn-secondary" disabled={busy} onClick={()=>{setError('');void refresh().catch(e=>setError(e.message));}}>Actualizar</button>
    </div>
    {loading?<p role="status">Cargando conversaciones…</p>:<div className="grid grid-cols-1 xl:grid-cols-[minmax(240px,1fr)_minmax(0,2fr)] gap-5">
      <nav aria-label="Conversaciones" className="space-y-2 max-h-[65vh] overflow-y-auto">
        {!shown.length&&<p className="card-static">No hay conversaciones con estos filtros.</p>}
        {shown.map(c=><button disabled={busy} key={c.id} aria-current={selected===c.id?'true':undefined} onClick={()=>void open(c.id)} className={'w-full text-left rounded-xl border p-4 '+(selected===c.id?'border-emerald-600 bg-emerald-50':'border-slate-200 bg-white')}><strong>{c.contact_name}</strong><span className="float-right">{c.unread_count>0?c.unread_count+' sin leer':''}</span><p className="text-sm">{c.channel} · {labels[c.status]} · {c.assigned_to||'Sin asignar'}</p><p className="truncate">{c.last_message_text}</p><time className="text-xs">{date(c.last_message_at)}</time><p className="text-sm">{tags(c.tags).join(' · ')}</p></button>)}
      </nav>
      {!detail?<p role="status">{busy?'Cargando hilo…':'Selecciona una conversación para ver el hilo.'}</p>:<article className="card-static space-y-4 min-w-0">
        <h2 className="font-bold text-lg">{detail.conversation.contact_name}</h2>
        <div className="flex flex-wrap gap-3"><label>Estado del hilo<select className="input-field" disabled={busy} value={detail.conversation.status} onChange={e=>void mutate({action:'update',conversationId:selected,status:e.target.value})}>{['open','pending','resolved','archived'].map(s=><option key={s} value={s}>{labels[s]}</option>)}</select></label>
        <label>Asignar a<input className="input-field" maxLength={100} value={owner} onChange={e=>setOwner(e.target.value)}/></label><label>Etiquetas separadas por comas<input className="input-field" value={editTags} onChange={e=>setEditTags(e.target.value)}/></label><button className="btn-secondary" disabled={busy} onClick={()=>void mutate({action:'update',conversationId:selected,assignedTo:owner,tags:editTags.split(',').map(s=>s.trim()).filter(Boolean)})}>Guardar asignación y etiquetas</button></div>
        <ol className="space-y-3 max-h-[55vh] overflow-y-auto" aria-label="Mensajes del hilo">{detail.messages.map(m=><li key={m.id} className={'rounded-lg p-3 border whitespace-pre-wrap break-words '+(m.is_internal_note?'bg-amber-50 border-amber-200':m.sender_type==='client'?'bg-slate-50':m.sender_type==='ai'?'bg-violet-50':m.sender_type==='system'?'bg-gray-100':'bg-blue-50')}><strong>{m.is_internal_note?'Nota interna':labels[m.sender_type]||m.sender_type} · {m.sender_name}</strong><p>{m.content}</p><small>{date(m.created_at)} · {labels[m.status]||m.status}</small>{m.status==='failed'&&!m.is_internal_note&&m.attempts<3&&<button className="btn-secondary ml-2" disabled={busy} onClick={()=>void mutate({action:'retry',conversationId:selected,messageId:m.id,simulateError})}>Reintentar DEMO ({m.attempts}/3)</button>}</li>)}</ol>
        <form className="space-y-2" onSubmit={e=>{e.preventDefault();void mutate({action:note?'note':'reply',conversationId:selected,content:draft,...(!note?{simulateError}:{})},()=>setDraft(''));}}>
          <label className="block">{note?'Nota privada: nunca se envía':'Respuesta DEMO'}<textarea className="input-field" rows={3} required maxLength={4000} value={draft} onChange={e=>setDraft(e.target.value)}/></label>
          <label className="mr-4"><input type="checkbox" checked={note} onChange={e=>setNote(e.target.checked)}/> Nota interna</label><label><input type="checkbox" checked={simulateError} onChange={e=>setSimulateError(e.target.checked)}/> Simular error de envío/reintento</label><button className="btn-primary" disabled={busy||(!note&&detail.conversation.status==='archived')}>{note?'Guardar nota':'Responder DEMO'}</button>
        </form>
        <details><summary className="cursor-pointer font-semibold">Ficha del contacto y CRM</summary><p>{detail.contact?.name} · {detail.contact?.email} · {detail.contact?.phone}</p><Link className="underline mr-3" href="/clientes">Clientes</Link><Link className="underline mr-3" href="/crm">Seguimiento CRM</Link>{detail.lead?<p>Lead: {detail.lead.name} · {detail.lead.status} · <Link className="underline" href="/leads">Ver leads</Link></p>:<p>Sin lead vinculado. Se reutilizan las relaciones de oportunidades del CRM.</p>}</details>
        <details><summary className="cursor-pointer font-semibold">Historial de auditoría ({detail.audit.length})</summary><ol>{detail.audit.map(a=><li key={a.id} className="border-b py-2 break-words">{date(a.created_at)} · {a.actor} · {a.action}<pre className="whitespace-pre-wrap text-xs">{a.details}</pre></li>)}</ol></details>
      </article>}
    </div>}
  </section>;
}
