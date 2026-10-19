import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { POST, GET as listBudgets } from "@/app/api/budgets/route";
import { GET, PUT } from "@/app/api/budgets/[id]/route";
import { getDbClient, initializeDatabase } from "@/lib/db";
import { budgetWorkSchema } from "@/lib/validations/budget-schema";

process.env.TURSO_DATABASE_URL = "file:" + join(mkdtempSync(join(tmpdir(), "electricista-budget-work-")), "test.db");
delete process.env.TURSO_AUTH_TOKEN;
process.env.DEMO_MODE = "false";

test("same client keeps different works and addresses through create, edit and list", async () => {
  await initializeDatabase();
  const db = getDbClient();
  await db.execute({sql:"INSERT INTO clients (id, name, address) VALUES (?, ?, ?)",args:["site-client","Cliente de prueba","Domicilio fiscal"]});
  const make = (work_name: string, work_address: string) => ({
    client_id:"site-client", date:"2026-10-18", work_name, work_address,
    items:[{description:"Instalación",quantity:2,unit_price:1.5}]
  });
  const create = async (body: object) => {
    const res = await POST(new NextRequest("http://localhost/api/budgets",{method:"POST",body:JSON.stringify(body)}));
    assert.equal(res.status,201);
    return await res.json();
  };
  const a = await create(make("Reforma local","Calle A, 1"));
  const b = await create(make("Cuadro vivienda","Calle B, 2"));
  assert.notEqual(a.work_address,b.work_address);
  assert.equal(a.work_name,"Reforma local");
  assert.equal(a.subtotal,3);
  const context={params:Promise.resolve({id:a.id})};
  const edited=await PUT(new NextRequest("http://localhost/api/budgets/"+a.id,{method:"PUT",body:JSON.stringify({...make("Reforma ampliada","Calle C, 3"),valid_until:null})}),context);
  assert.equal(edited.status,200);
  const detail=await (await GET(new NextRequest("http://localhost/api/budgets/"+a.id),context)).json();
  assert.equal(detail.work_address,"Calle C, 3");
  assert.equal(detail.work_name,"Reforma ampliada");
  assert.equal(detail.client_address,"Domicilio fiscal");
  const other=await (await GET(new NextRequest("http://localhost/api/budgets/"+b.id),{params:Promise.resolve({id:b.id})})).json();
  assert.equal(other.work_address,"Calle B, 2");
  const listed=await (await listBudgets(new NextRequest("http://localhost/api/budgets"))).json();
  assert.equal(listed.find((x:{id:string})=>x.id===a.id).work_address,"Calle C, 3");
  // Status-only updates and older callers must not erase the saved work.
  await PUT(new NextRequest("http://localhost/api/budgets/"+a.id,{method:"PUT",body:JSON.stringify({status:"sent"})}),context);
  await PUT(new NextRequest("http://localhost/api/budgets/"+a.id,{method:"PUT",body:JSON.stringify({client_id:"site-client",date:"2026-10-18",items:make("","").items})}),context);
  const preserved=await (await GET(new NextRequest("http://localhost/api/budgets/"+a.id),context)).json();
  assert.equal(preserved.work_address,"Calle C, 3");
  // Seed a historical row directly; numbering collisions within one second are a separate existing issue.
  await db.execute({sql:"INSERT INTO budgets (id, number, client_id, date) VALUES (?, ?, ?, ?)",args:["historical","HISTORICAL-TEST","site-client","2026-01-01"]});
  const historical=await (await GET(new NextRequest("http://localhost/api/budgets/historical"),{params:Promise.resolve({id:"historical"})})).json();
  assert.equal(historical.work_address,null);
  await initializeDatabase();
  const reloaded=await db.execute({sql:"SELECT work_name, work_address FROM budgets WHERE id = ?",args:[a.id]});
  assert.equal(reloaded.rows[0].work_address,"Calle C, 3");
  db.close();
});
test("work fields trim text, reject overlong and invalid types", () => {
  assert.deepEqual(budgetWorkSchema.parse({work_name:"  Reforma  ",work_address:"  Calle A  "}),{work_name:"Reforma",work_address:"Calle A"});
  assert.equal(budgetWorkSchema.safeParse({work_name:7}).success,false);
  assert.equal(budgetWorkSchema.safeParse({work_address:"a".repeat(501)}).success,false);
});
