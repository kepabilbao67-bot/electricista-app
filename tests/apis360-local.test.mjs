import test from "node:test";
import assert from "node:assert/strict";
import { isLocalAiPermitted, isApis360Ready, askApis360 }
  from "../src/lib/apis360-local.ts";

const response = (value, ok = true) => ({ ok, json: async () => value });
const healthy = () => ({
  service: "apis360", localOnly: true,
  ai: { local: { available: true, modelInstalled: true } },
});
const project = () => ({
  id: "electricista360", mode: "local", allowCloudExplicit: false,
  allowAutomaticCloudFallback: false,
});

test("desactivado en producción aunque se solicite explícitamente", () => {
  assert.equal(isLocalAiPermitted("production", "1", "127.0.0.1:3000"), false);
  assert.equal(isLocalAiPermitted("development", "0", "127.0.0.1:3000"), false);
  assert.equal(isLocalAiPermitted("development", "1", "example.com:3000"), false);
  assert.equal(isLocalAiPermitted("development", "1", "localhost:3000"), true);
  assert.equal(isLocalAiPermitted("development", "1", "127.0.0.1:3000"), true);
});

test("comprueba dos endpoints y proyecto aislado sin permiso cloud", async () => {
  const paths=[];
  const fetcher = async (url) => {
    paths.push(url);
    return response(url.endsWith("/status") ? healthy() : project());
  };
  assert.equal(await isApis360Ready(fetcher), true);
  assert.deepEqual(paths, [
    "http://127.0.0.1:3737/v1/status",
    "http://127.0.0.1:3737/v1/projects/electricista360",
  ]);
});

test("rechaza gateway remoto, proyectos ajenos o permisos cloud", async () => {
  for (const config of [
    {...project(), id: "otro-tenant"},
    {...project(), mode: "auto"},
    {...project(), allowCloudExplicit: true},
    {...project(), allowAutomaticCloudFallback: true},
  ]) {
    const fetcher=async(url)=>response(url.endsWith("/status")?healthy():config);
    assert.equal(await isApis360Ready(fetcher), false);
  }
  assert.equal(await isApis360Ready(async()=>{throw new Error("offline")}),false);
});

test("la consulta al gateway fuerza modo local, sin datos de clientes ni ejecución",async()=>{
  let payload;
  const fetcher=async(url,opts)=>{
    payload={url,opts,body:JSON.parse(opts.body)};
    return response({
      source:"local", cost:{requestUsd:0},
      recommendation:{text:"Texto de ejemplo"},
    });
  };
  assert.equal(await askApis360("Crea un borrador de aviso",fetcher),"Texto de ejemplo");
  assert.equal(payload.url,"http://127.0.0.1:3737/v1/ai/ask");
  assert.equal(payload.body.mode,"local");
  assert.equal(payload.body.project,"electricista360");
  assert.match(payload.body.prompt,/No tienes acceso a clientes/);
  assert.equal(payload.opts.headers["x-kepa-project"],"electricista360");
  assert.equal(payload.opts.headers.Authorization,undefined);
});

test("nunca acepta respuestas cloud, con coste, sin respuesta ni prompt inválido",async()=>{
  const invalid=[
    {source:"cloud",cost:{requestUsd:0},recommendation:{text:"insegura"}},
    {source:"local",cost:{requestUsd:0.01},recommendation:{text:"con coste"}},
    {source:"local",cost:{requestUsd:0},recommendation:{text:""}},
    {source:"local",recommendation:{text:"sin coste verificado"}},
  ];
  for(const data of invalid){
    await assert.rejects(()=>askApis360("hola",async()=>response(data)),/AI360_LOCAL_RESPONSE_NOT_VERIFIED/);
  }
  await assert.rejects(()=>askApis360(""),/AI360_INVALID_QUESTION/);
  await assert.rejects(()=>askApis360("x".repeat(1201)),/AI360_INVALID_QUESTION/);
});
