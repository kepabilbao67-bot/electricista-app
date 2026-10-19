import {extraerPartidasPresupuesto} from "../src/lib/presupuesto-desde-foto";
const texto=["Cuadro 24 modulos | 1 | 150,00","Cable H07V | 100 | 0,80","IVA | 21 | 161,07","TOTAL | 928,07"].join("\n");
const items=extraerPartidasPresupuesto(texto);
console.log(JSON.stringify(items));
if(items.length!==2||items[1].quantity!==100||items[1].unit_price!==0.8)process.exit(2);
