import {createClient} from "@libsql/client";
import {randomBytes,randomUUID,createHash} from "node:crypto";
import {pathToFileURL} from "node:url";
const adapter=pathToFileURL("C:\\Users\\foca-\\OneDrive\\Escritorio\\01_PROYECTOS_ACTIVOS\\kepa-setup-360\\adapters\\electricista360-runtime.mjs").href;
const {issueElectricista360ScopedEnv,ELECTRICISTA360_IDENTITIES:E}=await import(adapter);
const lease=issueElectricista360ScopedEnv({actor:E.DATABASE,service:"database"});
if(!lease?.allowed)throw Error("DATABASE_LEASE_DENIED");
const db=createClient({url:lease.env.BUNKER_ELECTRICISTA360_TURSO_DATABASE_URL,authToken:lease.env.BUNKER_ELECTRICISTA360_TURSO_AUTH_TOKEN});
const email="sh.instalacioneselectricas@gmail.com";
try{
 const users=await db.execute("SELECT DISTINCT tenant_id FROM app_users WHERE is_active=1");
 if(users.rows.length!==1)throw Error("Expected exactly one active customer company");
 const tenant=String(users.rows[0].tenant_id);
 const exists=await db.execute({sql:"SELECT id FROM app_users WHERE lower(email)=lower(?)",args:[email]});
 if(exists.rows.length!==0)throw Error("ACCOUNT_ALREADY_EXISTS_NO_INVITE_CREATED");
 await db.execute("CREATE TABLE IF NOT EXISTS e360_password_invites (id TEXT PRIMARY KEY,token_hash TEXT NOT NULL UNIQUE,email TEXT NOT NULL,tenant_id TEXT NOT NULL,expires_at TEXT NOT NULL,used_at TEXT)");
 const token=randomBytes(32).toString("base64url");
 const expiresAt=new Date(Date.now()+48*3600000).toISOString();
 await db.execute({sql:"INSERT INTO e360_password_invites(id,token_hash,email,tenant_id,expires_at,used_at) VALUES(?,?,?,?,?,NULL)",args:[randomUUID(),createHash("sha256").update(token).digest("hex"),email,tenant,expiresAt]});
 console.log(JSON.stringify({email,url:"https://electricista-app-two.vercel.app/registro-cliente#token="+token,expiresAt}));
}finally{db.close();}
