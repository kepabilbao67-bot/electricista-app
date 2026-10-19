import {createClient} from "@libsql/client";
import {pathToFileURL} from "node:url";
const adapter=pathToFileURL("C:\\Users\\foca-\\OneDrive\\Escritorio\\01_PROYECTOS_ACTIVOS\\kepa-setup-360\\adapters\\electricista360-runtime.mjs").href;
const {issueElectricista360ScopedEnv,ELECTRICISTA360_IDENTITIES:E}=await import(adapter);
const lease=issueElectricista360ScopedEnv({actor:E.DATABASE,service:"database"});
if(!lease?.allowed)throw Error("NO_DATABASE_LEASE");
const db=createClient({url:lease.env.BUNKER_ELECTRICISTA360_TURSO_DATABASE_URL,authToken:lease.env.BUNKER_ELECTRICISTA360_TURSO_AUTH_TOKEN});
try{const x=await db.execute({sql:"SELECT role,is_active,tenant_id FROM app_users WHERE lower(email)=lower(?)",args:["sh.instalacioneselectricas@gmail.com"]}); const tenants=await db.execute("SELECT count(DISTINCT tenant_id) AS n FROM app_users"); console.log(JSON.stringify({accountExists:x.rows.length>0,accountRoles:x.rows.map(r=>({role:r.role,active:!!r.is_active})),tenantCount:Number(tenants.rows[0]?.n??0)}));}finally{db.close()}
