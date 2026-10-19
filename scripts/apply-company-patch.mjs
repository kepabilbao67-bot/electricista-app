// Optional maintenance operation. Personal data is supplied privately through the deployment environment.
import { createClient } from "@libsql/client";
const raw=process.env.E360_COMPANY_SETTINGS_PATCH;
if (!raw) { console.log("No company settings patch requested."); process.exit(0); }
const patch=JSON.parse(raw);
const allowed=["trade_name","legal_name","owner_name","nif","address_line1","address_line2","phone","email"];
if (!patch || typeof patch!=="object" || Object.keys(patch).some(k=>!allowed.includes(k))) throw Error("Invalid company patch fields");
const fields=Object.keys(patch);
if(!fields.length || fields.some(k=>typeof patch[k]!=="string"||patch[k].length>500)) throw Error("Invalid company patch values");
const url=process.env.TEST_DATABASE_URL||process.env.TURSO_DATABASE_URL;
if(!url)throw Error("Missing database configuration");
const db=createClient({url,authToken:process.env.TURSO_AUTH_TOKEN});
try{
 const before=await db.execute("SELECT * FROM company_settings WHERE id='default'");
 if(before.rows.length!==1)throw Error("Expected existing company settings; no defaults overwritten");
 const result=await db.execute({sql:"UPDATE company_settings SET "+fields.map(k=>k+"=?").join(",")+",updated_at=? WHERE id='default'",args:[...fields.map(k=>patch[k]),new Date().toISOString()]});
 if(result.rowsAffected!==1)throw Error("Settings update did not affect exactly one row");
 const after=await db.execute("SELECT * FROM company_settings WHERE id='default'");
 if(fields.some(k=>after.rows[0][k]!==patch[k]))throw Error("Company patch readback mismatch");
 for(const key of Object.keys(before.rows[0])) if(!fields.includes(key)&&key!=="updated_at"&&before.rows[0][key]!==after.rows[0][key]) throw Error("Unrelated settings changed");
 console.log("Company settings patch verified. Updated fields: "+fields.join(", "));
}finally{db.close();}
