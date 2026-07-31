/**
 * Reverso de TODOS os codemods de contrato, usando o valor ATUAL de cada um.
 *
 * O que isto isola: `className={CONTRATO}` vira o literal exato que o contrato
 * contem HOJE. A comparacao before/after passa a medir uma coisa so — "referenciar
 * o contrato muda pixel?" — e nao arrasta junto nenhuma mudanca de conteudo do
 * contrato (o anel de foco do lote 3, por exemplo, fica dos dois lados).
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import console from "node:console";
const ROOT = process.env.TOKENIZE_APP_ROOT || path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const APPLY=process.argv.includes("--apply");
const mod=await import(path.join(ROOT,"src/utils/design-entities.js"));
const ALVOS=Object.keys(mod).filter((k)=>typeof mod[k]==="string");
const SKIP=new Set(["node_modules",".git","dist","build",".tokenize"]);
const EXT=new Set([".js",".jsx",".ts",".tsx"]);
function walk(d,out=[]){let e;try{e=readdirSync(d,{withFileTypes:true});}catch{return out;}
 for(const x of e){if(SKIP.has(x.name))continue;const p=path.join(d,x.name);
 if(x.isDirectory())walk(p,out);else if(EXT.has(path.extname(x.name)))out.push(p);}return out;}
const conta=Object.fromEntries(ALVOS.map((n)=>[n,0]));
let arq=0, imp=0;
for(const f of walk(path.join(ROOT,"src"))){
  if (f.endsWith("design-entities.js")) continue;
  let t;try{t=readFileSync(f,"utf8");}catch{continue;}
  let novo=t,tocou=false;
  for(const nome of ALVOS){
    const uso=new RegExp(`className=\\{${nome}\\}`,"g");
    const a=novo.match(uso); if(!a)continue;
    conta[nome]+=a.length; tocou=true;
    novo=novo.replace(uso,`className="${mod[nome]}"`);
    const ri=new RegExp(`^import \\{ ${nome} \\} from "[^"]*design-entities\\.js";\\r?\\n`,"gm");
    const ia=novo.match(ri); if(ia){imp+=ia.length;novo=novo.replace(ri,"");}
  }
  if(!tocou)continue; arq++;
  if(APPLY) writeFileSync(f,novo);
}
const tot=Object.values(conta).reduce((a,b)=>a+b,0);
for(const n of ALVOS) console.log(`  ${n.padEnd(22)} ${String(conta[n]).padStart(4)}`);
console.log(`  TOTAL ${tot} call sites em ${arq} arquivos, ${imp} imports removidos`);
console.log(APPLY?"  APLICADO.":"  DRY-RUN.");
/*
 * `--esperado N` trava a contagem. Sem ele o reverso roda e so reporta — util
 * quando o numero mudou de proposito (lote novo) e perigoso quando nao mudou.
 */
const ESP = (() => { const i = process.argv.indexOf("--esperado"); return i >= 0 ? Number(process.argv[i + 1]) : null; })();
if (ESP !== null && tot !== ESP) { console.error(`  PAROU: esperava ${ESP}, achei ${tot}`); process.exitCode = 1; }
