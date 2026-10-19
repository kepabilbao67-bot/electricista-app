import { NextRequest, NextResponse } from "next/server";
import { getDbClient, initializeDatabase } from "@/lib/db";
import { normalizeAppearance } from "@/lib/appearance";
async function database() {
 await initializeDatabase();
 const db=getDbClient();
 await db.execute("CREATE TABLE IF NOT EXISTS app_appearance (id TEXT PRIMARY KEY, colors TEXT NOT NULL, updated_at TEXT NOT NULL)");
 return db;
}
export async function GET() {
 try {
  const db=await database();
  const r=await db.execute("SELECT colors FROM app_appearance WHERE id='default'");
  return NextResponse.json(normalizeAppearance(r.rows[0] ? JSON.parse(String(r.rows[0].colors)) : {}), {headers:{"Cache-Control":"no-store"}});
 } catch { return NextResponse.json({error:"No se pudieron cargar los colores"},{status:500}); }
}
export async function POST(request:NextRequest) {
 try {
  const colors=normalizeAppearance(await request.json());
  const db=await database();
  await db.execute({sql:"INSERT INTO app_appearance(id,colors,updated_at) VALUES('default',?,?) ON CONFLICT(id) DO UPDATE SET colors=excluded.colors,updated_at=excluded.updated_at",args:[JSON.stringify(colors),new Date().toISOString()]});
  return NextResponse.json(colors);
 } catch { return NextResponse.json({error:"No se pudieron guardar los colores"},{status:500}); }
}
