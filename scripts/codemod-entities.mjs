/**
 * Codemod parametrizado: troca `className="<bundle exato>"` por
 * `className={CONTRATO}` e insere o import relativo.
 *
 * Regras, cada uma comprada com um erro real:
 * 1. casamento por CONJUNTO ORDENADO, nao substring — mesma regra do censo;
 * 2. so literal estatico; `className={...}` fica de fora;
 * 3. import com path relativo CALCULADO, nunca cravado;
 * 4. dry-run por padrao;
 * 5. PARA se a contagem divergir do censo esperado.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import console from "node:console";

const ROOT = process.env.TOKENIZE_APP_ROOT || path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const MODULO = "src/utils/design-entities.js";
const arg = (n, d = null) => { const i = process.argv.indexOf(n); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const APPLY = process.argv.includes("--apply");
const nomes = process.argv.slice(2).filter((a) => !a.startsWith("--"));
/*
 * Contagem do censo por contrato. O codemod PARA se divergir: censo e mutacao
 * discordando faz "aplicado com sucesso" significar outra coisa. Passe
 * `--esperado NOME=N,NOME=N` para um lote novo; sem entrada, o contrato roda
 * sem trava e o total e so reportado.
 */
const ESPERADO = Object.fromEntries(
  (arg("--esperado", "") || "").split(",").filter(Boolean)
    .map((par) => { const [n, v] = par.split("="); return [n.trim(), Number(v)]; })
);

const mod = await import(path.join(ROOT, MODULO));
const CHAVE = Object.fromEntries(nomes.map((n) => {
  if (typeof mod[n] !== "string") throw new Error(`contrato ${n} nao existe`);
  return [n, mod[n].trim().split(/\s+/).filter(Boolean).sort().join(" ")];
}));

const SKIP = new Set(["node_modules", ".git", "dist", "build", ".tokenize"]);
const EXT = new Set([".js", ".jsx", ".ts", ".tsx"]);
function walk(d, out = []) {
  let e; try { e = readdirSync(d, { withFileTypes: true }); } catch { return out; }
  for (const x of e) {
    if (SKIP.has(x.name)) continue;
    const p = path.join(d, x.name);
    if (x.isDirectory()) walk(p, out); else if (EXT.has(path.extname(x.name))) out.push(p);
  }
  return out;
}

const conta = Object.fromEntries(nomes.map((n) => [n, 0]));
const arquivos = new Set();
for (const f of walk(path.join(ROOT, "src"))) {
  let t; try { t = readFileSync(f, "utf8"); } catch { continue; }
  let novo = t; const usados = new Set();
  novo = novo.replace(/className="([^"]*)"/g, (all, cls) => {
    const chave = cls.trim().split(/\s+/).filter(Boolean).sort().join(" ");
    for (const n of nomes) {
      if (chave === CHAVE[n]) { conta[n]++; usados.add(n); return `className={${n}}`; }
    }
    return all;
  });
  if (!usados.size) continue;
  arquivos.add(f);
  for (const n of usados) {
    if (new RegExp(`import\\s*\\{[^}]*\\b${n}\\b`).test(novo)) continue;
    let rel = path.relative(path.dirname(f), path.join(ROOT, MODULO)).replace(/\\/g, "/");
    if (!rel.startsWith(".")) rel = `./${rel}`;
    const linha = `import { ${n} } from "${rel}";\n`;
    const ult = [...novo.matchAll(/^import .*;$/gm)].pop();
    novo = ult ? novo.slice(0, ult.index + ult[0].length + 1) + linha + novo.slice(ult.index + ult[0].length + 1) : linha + novo;
  }
  if (APPLY) writeFileSync(f, novo);
}

let falhou = false;
for (const n of nomes) {
  const esp = ESPERADO[n];
  const ok = esp === undefined || conta[n] === esp;
  if (!ok) falhou = true;
  console.log(`  ${ok ? "OK  " : "ERRO"} ${n}: ${conta[n]} call sites (censo: ${esp ?? "?"})`);
}
console.log(`  arquivos tocados: ${arquivos.size}`);
console.log(APPLY ? "\n  APLICADO." : "\n  DRY-RUN.");
if (falhou) { console.error("\n  PAROU: censo e mutacao discordam."); process.exitCode = 1; }
