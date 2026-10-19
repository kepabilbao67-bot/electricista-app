import {createClient} from "@libsql/client";
import {randomBytes,randomUUID,createHash} from "node:crypto";
import {pathToFileURL} from "node:url";
const adapter=pathToFileURL("C:\\Users\\foca-\\OneDrive\\Escritorio\\01_PROYECTOS_ACTIVOS\\kepa-setup-360\\adapters\\electricista360-runtime.mjs").href;
const {issueElectricista360ScopedEnv,ELECTRICISTA360_IDENTITIES:E}=await import(adapter);
const lease=issueElectricista360ScopedEnv({actor:E.DATABASE,service:"database"});
if(!lease?.allowed)throw new Error("DATABASE_LEASE_DENIED");
const db=createClient({url:lease.env.BUNKER_ELECTRICISTA360_TURSO_DATABASE_URL,authToken:lease.env.BUNKER_ELECTRICISTA360_TURSO_AUTH_TOKEN});
try{
 const users=await db.execute("SELECT id,tenant_id FROM app_users WHERE is_active=1 AND role='owner'");
 if(users.rows.length!==1)throw new Error("Exactly one active owner required; refusing ambiguous invitation");
 await db.execute("CREATE TABLE IF NOT EXISTS e360_client_invites (id TEXT PRIMARY KEY,token_hash TEXT NOT NULL UNIQUE,user_id TEXT NOT NULL,tenant_id TEXT NOT NULL,expires_at TEXT NOT NULL,used_at TEXT)");
 const token=randomBytes(32).toString("base64url");
 const expires=new Date(Date.now()+24*3600000).toISOString();
 await db.execute({sql:"INSERT INTO e360_client_invites(id,token_hash,user_id,tenant_id,expires_at,used_at) VALUES(?,?,?,?,?,NULL)",args:[randomUUID(),createHash("sha256").update(token).digest("hex"),String(users.rows[0].id),String(users.rows[0].tenant_id),expires]});
 console.log(JSON.stringify({url:"https://electricista-app-two.vercel.app/activar-cliente#token="+token,expiresAt:expires}));
}finally{db.close();}
