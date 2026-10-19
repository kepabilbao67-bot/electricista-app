export type PartidaImportada={description:string;quantity:number;unit_price:number};
function num(s:string){const v=s.trim().replace(/[€\s]/g,"");const dec=v.includes(",")?v.replace(/\./g,"").replace(",","."):v;const n=Number(dec);return Number.isFinite(n)&&n>=0?n:null;}
export function extraerPartidasPresupuesto(texto:string):PartidaImportada[]{
 const lines=texto.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 const out:PartidaImportada[]=[];
 for(const line of lines){
  if(/^(subtotal|total|iva|fecha|cliente|direcci[oó]n|presupuesto|n[ºo]\.?|importe|observaciones|concepto|cant\.|precio|trabajos|tel[eé]fono)/i.test(line))continue;
  const cols=line.split(/\s*\|\s*|\s*;\s*|\t+/).map(s=>s.trim()).filter(Boolean);
  if(cols.length<3)continue;
  let start=0;
  if(/^\d+[.)]?$/.test(cols[0])&&cols.length>=4)start=1;
  const q=num(cols[start+1]??"");
  const p=num(cols[start+2]??"");
  if(q===null||p===null||q===0)continue;
  const description=(cols[start]||"").slice(0,300);
  if(description.length<3)continue;
  out.push({description,quantity:q,unit_price:p});
  if(out.length>=60)break;
 }
 return out;
}
