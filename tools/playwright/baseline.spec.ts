import { test, expect } from "@playwright/test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* baseline.spec.ts — regressão visual (toHaveScreenshot, baselines
   commitadas) + oráculo de conteúdo determinístico (status HTTP < 400 +
   seletor de erro opcional). Complementa evidence.spec.ts: aquele produz
   EVIDÊNCIA rotulada para revisão humana/agente; este é o teste de
   REGRESSÃO que falha o build.

   PORTADO de apps/web/tests/visual/baseline.spec.ts (harness-doador de
   referência) — plano de resgate §R3 item 3. Genericização vs. a
   versão-fonte: o seletor de erro ([data-testid="route-error"]) e as
   máscaras de screenshot (img[alt="User Avatar"]) eram hardcoded ao app
   doador — agora configuráveis via env, ambos default vazio (sem
   comportamento assumido para um app desconhecido):

   Env:
   - HARNESS_UI_EVIDENCE_ERROR_SELECTOR   seletor CSS de uma tela de erro
     renderizada SOB o mesmo layout que as páginas normais (ex.: um
     componente <RouteError data-testid="route-error"/> do error boundary
     deste projeto). Vazio = oráculo de erro pulado (só o status HTTP
     continua sendo checado).
   - HARNESS_UI_EVIDENCE_MASK_SELECTORS   csv de seletores CSS mascarados no
     screenshot (avatares, conteúdo dinâmico não determinístico). Vazio =
     sem máscara. */

type Route = { name: string; path: string };
// lido SÍNCRONO no top-level (a coleta precisa dos testes antes do worker)
const routes: Route[] = JSON.parse(
  readFileSync(path.join(__dirname, "routes.json"), "utf-8")
);

const ERROR_SELECTOR = process.env.HARNESS_UI_EVIDENCE_ERROR_SELECTOR || "";
const MASK_SELECTORS = (process.env.HARNESS_UI_EVIDENCE_MASK_SELECTORS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Baseline COMMITADA é artefato revisado, não subproduto de um run. O default do
// Playwright (gravar snapshot ausente e falhar) transforma qualquer rota nova em
// baseline automática — e se o run estiver mal configurado (sem sessão, página
// ainda em loading) a "verdade" gravada vira um spinner. Aconteceu aqui: ampliar a
// matriz de rotas mintou 23 snapshots de tela de carregamento. Baseline errada é
// pior que baseline ausente, porque o oráculo passa a certificar o lixo.
//
// Então: rota sem snapshot commitado é PULADA com aviso, nunca auto-gravada. Para
// promover uma rota nova a baseline, gere com --update-snapshots, OLHE o PNG e
// commite deliberadamente.
const SNAP_DIR = path.join(__dirname, "baseline.spec.ts-snapshots");
// A checagem e por (rota x PROJETO): o nome do snapshot e `<rota>-<projeto>-<os>.png`.
// Checar so pelo prefixo da rota fazia `home-desktop` commitado liberar o auto-mint
// de `home-mobile-sm` — 8 baselines de viewport nunca revisada, gravadas em silencio.
const hasCommittedBaseline = (name: string, project: string) =>
  existsSync(SNAP_DIR) &&
  readdirSync(SNAP_DIR).some((f) =>
    f.startsWith(`${name.replace(/_/g, "-")}-${project}-`)
  );

for (const route of routes) {
  test(`baseline: ${route.name}`, async ({ page, context }) => {
    test.skip(
      !hasCommittedBaseline(route.name, test.info().project.name),
      `sem baseline commitada para "${route.name}" — gere com --update-snapshots, ` +
        `revise o PNG e commite. Auto-gravar aqui produziria baseline de tela de loading.`
    );
    // AUTH REAL: sem sessao as rotas /settings/* caem em /login com HTTP 200 e
    // a baseline seria a MESMA tela para varias rotas (medido: 3 hashes
    // identicos), tornando o ratchet visual cego a mudancas de cor.
    // Mesmo gate do evidence.spec: aceita credenciais OU sessao ja emitida.
    // So com UI_EVIDENCE_USER, um run com UI_EVIDENCE_SESSION rodava ANONIMO e
    // gravava baseline de tela de loading/login para rota protegida — baseline
    // lixo e pior que baseline ausente, porque passa a valer como verdade.
    if (process.env.UI_EVIDENCE_USER || process.env.UI_EVIDENCE_SESSION) {
      const { loginForVisualEvidence } = await import("./_helpers/login.mjs");
      await loginForVisualEvidence(context);
    }
    const resp = await page.goto(route.path, { waitUntil: "load" }); // baseURL; NÃO 'networkidle'
    // CONTENT ORACLE (1): independe de i18n — status HTTP < 400 (404/erro real).
    expect(
      resp?.status(),
      `${route.name}: HTTP ${resp?.status()} (404/erro?)`
    ).toBeLessThan(400);
    await page.evaluate(() => (document as any).fonts?.ready);
    await page.waitForSelector("[data-evidence-ready]", {
      state: "attached",
      timeout: 10_000,
    });
    // CONTENT ORACLE (2), opcional: sentinela de erro renderizado sob <main>
    // (ex.: SPA que responde 200 mas mostra tela de erro client-side).
    if (ERROR_SELECTOR) {
      await expect(
        page.locator(ERROR_SELECTOR),
        `${route.name} resolveu para tela de erro sob <main>`
      ).toHaveCount(0);
    }
    {
      const landed = new URL(page.url()).pathname.replace(/\/$/, "") || "/";
      const wanted = route.path.replace(/\/$/, "") || "/";
      expect(
        landed,
        `${route.name}: URL na captura era ${landed}, nao ${wanted}`
      ).toBe(wanted);
    }
    // ESPERAR O DOM ASSENTAR — a correcao do "flake" de settings_interface.
    //
    // `data-evidence-ready` significa "a arvore de providers montou", nao "a
    // pagina terminou". Varios componentes fazem `return null` enquanto uma
    // chamada de API esta em voo, e o maior deles derruba a tela inteira:
    // `CanViewChatHistoryProvider` (src/components/CanViewChatHistory/index.jsx)
    // tem `if (loading) return null`, e ele envolve TODO o menu da
    // SettingsSidebar. Medido: em 8 cargas identicas da mesma rota, 2 variantes
    // de render — menu populado e menu VAZIO (so "INSTANCE SETTINGS" + rodape).
    // A baseline batia ora com uma ora com outra: 1,13% de divergencia contra
    // limite de 1,00%, alternando passar/falhar sem mudanca de codigo.
    //
    // POR QUE NAO `networkidle`: o `page.goto` acima evita de proposito (ver
    // comentario la). Rotas de chat mantem SSE/websocket aberto, e esperar a
    // rede silenciar penduraria a captura. Silencio de DOM nao tem esse
    // problema: mede o que a foto realmente depende.
    //
    // Se uma pagina NUNCA assentar (spinner infinito), isto falha com mensagem
    // explicita — que e o correto: pagina que nao assenta nao pode ter baseline
    // estavel, e mascarar isso com um sleep fixo devolveria o flake.
    await page
      .waitForFunction(
        (quietMs) =>
          new Promise((resolve) => {
            let timer: any;
            const obs = new MutationObserver(() => {
              clearTimeout(timer);
              timer = setTimeout(pronto, quietMs);
            });
            function pronto() {
              obs.disconnect();
              resolve(true);
            }
            obs.observe(document.body, {
              childList: true,
              subtree: true,
              attributes: true,
              characterData: true,
            });
            timer = setTimeout(pronto, quietMs);
          }),
        350,
        { timeout: 10_000 }
      )
      .catch(() => {
        throw new Error(
          `${route.name}: o DOM nao ficou 350ms sem mutacao em 10s. A pagina nao ` +
            `assenta (spinner/poll infinito?) e nao pode ter baseline estavel.`
        );
      });

    // CROMO VOLATIL: elementos marcados `data-evidence-volatile` sao ocultados
    // antes da foto. Nao e cosmetica — e correcao do ORACULO.
    //
    // O caso que forcou isto: o avatar do usuario (UserMenu/UserButton) faz
    // `return null` ate `mode` resolver, e o sentinela `data-evidence-ready` so
    // garante que os providers montaram. Entao a captura as vezes pegava o
    // avatar e as vezes nao; e, quando pegava, mostrava as INICIAIS de quem
    // rodou a suite. A baseline `settings_interface` vivia a 1,13% de
    // divergencia contra um limite de 1,00% e alternava entre passar e falhar
    // sem nenhuma mudanca de codigo — "flake" que na verdade era o oraculo
    // medindo estado nao-determinista e dependente de usuario.
    //
    // POR QUE OCULTAR E NAO MASCARAR: `mask` pinta um retangulo sobre os
    // elementos ENCONTRADOS. Se o elemento estiver ausente, nada e pintado — a
    // presenca continuaria mudando pixels. `visibility:hidden` deixa os dois
    // estados (ausente / presente-oculto) com a MESMA renderizacao, e nao
    // remove do layout (o container e absolute, mas a regra vale em geral).
    //
    // So no oraculo: `evidence.spec.ts` continua fotografando a tela real,
    // porque lá o artefato e para olho humano, nao para comparacao automatica.
    await page.addStyleTag({
      content: "[data-evidence-volatile]{visibility:hidden !important}",
    });
    await expect(page).toHaveScreenshot(`${route.name}.png`, {
      animations: "disabled",
      caret: "hide",
      ...(MASK_SELECTORS.length
        ? { mask: MASK_SELECTORS.map((s) => page.locator(s)) }
        : {}),
    });
  });
}
