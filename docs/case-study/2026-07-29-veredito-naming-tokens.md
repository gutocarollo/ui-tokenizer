# Veredito de naming — todos os 139 tokens de cor consumidos

> ⛔ **ORDEM SUPERADA EM 2026-08-01.** Os nomes deste documento foram derivados
> com a gramática antiga (`entity.anatomy.property.variant`). A ordem canônica
> passou a ser **`entity[.variant][.anatomy][.property][.state]`** — a variante
> fica colada à entidade que ela qualifica (levantamento de 7 sistemas: nenhum
> com dono E propriedade no nome escreve a variante na cauda; ver §6 de
> `docs/law/GRAMMAR.md`). Leia os nomes daqui como MEDIÇÃO da época, nunca como
> alvo: `button.container.background-color.secondary` de então é hoje
> `button.secondary.container.background-color`.

> Classe `event` (`docs/SCHEMA.md` §2). Pedido do dono em 2026-07-29: *"utilize um
> grafo de agents sonnet onde absolutamente todos os tokens em lista de items
> numeradas e o contexto completo de onde estão aplicados. a partir disso, sugira
> os namings dos tokens que estiverem inadequados e os que estiverem adequados,
> coloque um ok."*

**Lei aplicada:** `frontend/tokens/GRAMMAR.md` —
`owner.anatomia.propriedade[.variante][.estado]`, vocabulário fechado no §4,
regras de decisão no §5.

## 0. Conflito de documentação que precisa da sua decisão

O doc `docs/design-system/2026-07-26-tokenization.md` **contradiz a lei**. Ele diz:

> **tier 2 semântico (papéis)** — `--color-surface-*`, `--color-content-*`,
> `--color-border-*`. **É a API pública.**

Isso consagra `surface-*` como API pública, o oposto do `GRAMMAR.md` §2 e do seu
review do PR #193. E o doc abre com *"A wiki vence o source"*, então quem o ler
primeiro conclui que `surface` está correto. **É fonte ativa de erro para agente
e para pessoa.** Precisa ser corrigido ou marcado como superado.

## 1. Resultado

| veredito | tokens | o que significa |
|---|---:|---|
| **OK** | **40** | o nome já obedece a lei |
| **INADEQUADO** | **82** | viola a lei; tem nome sugerido |
| **PENDENTE** | **17** | ambíguo de verdade (§5.5) — não foi chutado |
| total | 139 | 4.141 usos |

**47 tokens precisam ser QUEBRADOS** em vários — servem owners incompatíveis,
então o conserto não é um nome novo, são N tokens (regra §5.1: o owner vem do
contexto renderizado, não do valor).

## 2. Confiança — leia antes de aplicar qualquer sugestão

Cada grupo foi julgado por um agente Sonnet lendo o código e **refutado por um
segundo**, que reabriu os arquivos. Resultado:

| | |
|---|---:|
| vereditos **confirmados** | 84 |
| vereditos **refutados** | 42 |
| tokens **omitidos** pelo agente | 16 |
| grupos com veredito `CORRIGIR` | 9 de 9 |

O erro mais instrutivo: um agente justificou um owner novo (`sso-button`) na
premissa de que "a AuthScene renderiza fora do `ThemeProvider`" — **lida de um
comentário do próprio arquivo**. O refutador provou falso rastreando o router:
`src/App.jsx:27` envolve todo o `<Outlet/>`, e `useTheme.js` seta `data-theme` no
`documentElement`. Evidência adjacente não é prova.

Cada seção traz o que foi refutado nela. **`OK` é o veredito mais perigoso** —
ele fica no repo para sempre; os refutadores foram instruídos a atacá-lo primeiro.
## 4. As telas com o nome do token escrito em cima de cada elemento

**Fonte: o `className` do elemento**, não a cor do pixel. Se a classe não nomeia
o token, o elemento não aparece — zero inferência por valor.

| | |
|---|---|
| 🟥 rótulo **vermelho** | token que **viola a lei** — `surface-`, `semantic-`, `ui-`, ou nome de cor (`pink-`, `grey-`, `static-`) |
| 🟦 rótulo **azul** | os demais |

O rótulo mostra a classe completa, **inclusive o prefixo de estado**:
`hover:bg-x` aparece mesmo sem o cursor em cima, porque a classe está no DOM. É
o único jeito de ver os 337 consumos de `hover:` sem disparar hover elemento a
elemento.

> **Retratação da versão anterior.** A v1 destas imagens buscava por VALOR
> COMPUTADO e desenhava contorno colorido com legenda no canto. Errou duas vezes:
> das 531 marcas, só 2 tinham consumo real (texto branco casava com `raised`, que
> vale `#FFFFFF` no claro), e o nome do token não estava na imagem — obrigava a
> decorar cor. Não servia para atribuir naming, que era o objetivo.

**1.106 elementos rotulados** em **16** rotas × 2 temas.

> **`/login` não aparece: 0 elementos com classe de token.** Confirmação por outra
> via de um achado anterior — a `AuthScene` do login usa estilo inline com hex
> cravado (herança do port do makershub) e **não consome token nenhum**. Era por
> isso que a captura por valor computado marcava 7 elementos ali: todos
> coincidência. A tela está inteiramente fora do design system.

### 4.1 `home` — `/`

72 elementos (claro 36 · escuro 36) · **11 tokens inadequados** · 2 OK

Inadequados nesta tela: `surface-hover` (46) · `content-primary` (22) · `content-secondary` (10) · `static-white` (10) · `content-tertiary` (8) · `sidebar-divider` (4) · `sidebar-bg` (4) · `sidebar-field-bg` (4) · `app-bg` (2) · `sidebar-item-hover` (2) · `prompt-bg` (2)

**Tema claro**

![home claro — cada elemento rotulado com o token que consome](assets/2026-07-29-tokens-rotulados/home-light.png)

**Tema escuro**

![home escuro — cada elemento rotulado com o token que consome](assets/2026-07-29-tokens-rotulados/home-dark.png)

### 4.2 `settings_llm` — `/settings/llm-preference`

58 elementos (claro 29 · escuro 29) · **7 tokens inadequados** · 0 OK

Inadequados nesta tela: `content-primary` (32) · `content-secondary` (4) · `sidebar-divider` (4) · `sidebar-bg` (4) · `surface-hover` (2) · `app-bg` (2) · `border-inverse` (2)

**Tema claro**

![settings_llm claro — cada elemento rotulado com o token que consome](assets/2026-07-29-tokens-rotulados/settings_llm-light.png)

**Tema escuro**

![settings_llm escuro — cada elemento rotulado com o token que consome](assets/2026-07-29-tokens-rotulados/settings_llm-dark.png)

### 4.3 `settings_interface` — `/settings/interface`

42 elementos (claro 21 · escuro 21) · **8 tokens inadequados** · 0 OK

Inadequados nesta tela: `content-primary` (16) · `content-secondary` (4) · `sidebar-divider` (4) · `sidebar-bg` (4) · `content-inverse` (4) · `surface-hover` (2) · `app-bg` (2) · `border-inverse` (2)

**Tema claro**

![settings_interface claro — cada elemento rotulado com o token que consome](assets/2026-07-29-tokens-rotulados/settings_interface-light.png)

**Tema escuro**

![settings_interface escuro — cada elemento rotulado com o token que consome](assets/2026-07-29-tokens-rotulados/settings_interface-dark.png)

### 4.4 `settings_agents` — `/settings/agents`

94 elementos (claro 47 · escuro 47) · **9 tokens inadequados** · 0 OK

Inadequados nesta tela: `surface-hover` (22) · `content-primary` (12) · `content-inverse` (12) · `content-secondary` (4) · `sidebar-divider` (4) · `sidebar-bg` (4) · `app-bg` (2) · `static-black` (2) · `content-danger` (2)

**Tema claro**

![settings_agents claro — cada elemento rotulado com o token que consome](assets/2026-07-29-tokens-rotulados/settings_agents-light.png)

**Tema escuro**

![settings_agents escuro — cada elemento rotulado com o token que consome](assets/2026-07-29-tokens-rotulados/settings_agents-dark.png)

### 4.5 `settings_routers` — `/settings/model-routers`

38 elementos (claro 19 · escuro 19) · **10 tokens inadequados** · 1 OK

Inadequados nesta tela: `content-primary` (10) · `content-secondary` (6) · `content-tertiary` (6) · `sidebar-divider` (4) · `sidebar-bg` (4) · `surface-hover` (2) · `app-bg` (2) · `surface-elevated` (2) · `static-white` (2) · `border-default` (2)

**Tema claro**

![settings_routers claro — cada elemento rotulado com o token que consome](assets/2026-07-29-tokens-rotulados/settings_routers-light.png)

**Tema escuro**

![settings_routers escuro — cada elemento rotulado com o token que consome](assets/2026-07-29-tokens-rotulados/settings_routers-dark.png)

### 4.6 `settings_branding` — `/settings/branding`

90 elementos (claro 45 · escuro 45) · **10 tokens inadequados** · 0 OK

Inadequados nesta tela: `content-primary` (38) · `content-inverse` (14) · `content-secondary` (4) · `sidebar-divider` (4) · `sidebar-bg` (4) · `static-white` (4) · `surface-hover` (2) · `app-bg` (2) · `border-inverse` (2) · `static-black` (2)

**Tema claro**

![settings_branding claro — cada elemento rotulado com o token que consome](assets/2026-07-29-tokens-rotulados/settings_branding-light.png)

**Tema escuro**

![settings_branding escuro — cada elemento rotulado com o token que consome](assets/2026-07-29-tokens-rotulados/settings_branding-dark.png)

### 4.7 `settings_security` — `/settings/security`

36 elementos (claro 18 · escuro 18) · **7 tokens inadequados** · 0 OK

Inadequados nesta tela: `content-primary` (12) · `content-secondary` (4) · `sidebar-divider` (4) · `sidebar-bg` (4) · `border-inverse` (4) · `surface-hover` (2) · `app-bg` (2)

**Tema claro**

![settings_security claro — cada elemento rotulado com o token que consome](assets/2026-07-29-tokens-rotulados/settings_security-light.png)

**Tema escuro**

![settings_security escuro — cada elemento rotulado com o token que consome](assets/2026-07-29-tokens-rotulados/settings_security-dark.png)

### 4.8 `settings_api_keys` — `/settings/api-keys`

40 elementos (claro 20 · escuro 20) · **10 tokens inadequados** · 0 OK

Inadequados nesta tela: `content-secondary` (4) · `sidebar-divider` (4) · `sidebar-bg` (4) · `content-primary` (4) · `content-inverse` (4) · `content-info` (4) · `primary` (4) · `surface-hover` (2) · `app-bg` (2) · `primary-foreground` (2)

**Tema claro**

![settings_api_keys claro — cada elemento rotulado com o token que consome](assets/2026-07-29-tokens-rotulados/settings_api_keys-light.png)

**Tema escuro**

![settings_api_keys escuro — cada elemento rotulado com o token que consome](assets/2026-07-29-tokens-rotulados/settings_api_keys-dark.png)

### 4.9 `settings_beta_features` — `/settings/beta-features`

60 elementos (claro 30 · escuro 30) · **12 tokens inadequados** · 3 OK

Inadequados nesta tela: `content-primary` (16) · `content-info` (12) · `static-white` (6) · `content-success` (6) · `surface-hover` (4) · `content-secondary` (4) · `sidebar-divider` (4) · `sidebar-bg` (4) · `surface-destructive-tint` (4) · `app-bg` (2) · `border-default` (2) · `static-black` (2)

**Tema claro**

![settings_beta_features claro — cada elemento rotulado com o token que consome](assets/2026-07-29-tokens-rotulados/settings_beta_features-light.png)

**Tema escuro**

![settings_beta_features escuro — cada elemento rotulado com o token que consome](assets/2026-07-29-tokens-rotulados/settings_beta_features-dark.png)

### 4.10 `settings_system_prompt_vars` — `/settings/system-prompt-variables`

76 elementos (claro 38 · escuro 38) · **13 tokens inadequados** · 0 OK

Inadequados nesta tela: `content-info` (28) · `content-primary` (24) · `content-inverse` (24) · `info` (14) · `content-success` (12) · `success` (6) · `content-secondary` (4) · `sidebar-divider` (4) · `sidebar-bg` (4) · `primary` (4) · `surface-hover` (2) · `app-bg` (2)

**Tema claro**

![settings_system_prompt_vars claro — cada elemento rotulado com o token que consome](assets/2026-07-29-tokens-rotulados/settings_system_prompt_vars-light.png)

**Tema escuro**

![settings_system_prompt_vars escuro — cada elemento rotulado com o token que consome](assets/2026-07-29-tokens-rotulados/settings_system_prompt_vars-dark.png)

### 4.11 `settings_workspace_chats` — `/settings/workspace-chats`

202 elementos (claro 101 · escuro 101) · **11 tokens inadequados** · 0 OK

Inadequados nesta tela: `content-primary` (246) · `content-inverse` (44) · `static-black` (40) · `surface-destructive-tint` (40) · `surface-hover` (8) · `content-secondary` (6) · `sidebar-divider` (4) · `sidebar-bg` (4) · `static-white` (4) · `app-bg` (2) · `destructive` (2)

**Tema claro**

![settings_workspace_chats claro — cada elemento rotulado com o token que consome](assets/2026-07-29-tokens-rotulados/settings_workspace_chats-light.png)

**Tema escuro**

![settings_workspace_chats escuro — cada elemento rotulado com o token que consome](assets/2026-07-29-tokens-rotulados/settings_workspace_chats-dark.png)

### 4.12 `settings_transcription` — `/settings/transcription-preference`

44 elementos (claro 22 · escuro 22) · **8 tokens inadequados** · 0 OK

Inadequados nesta tela: `content-primary` (18) · `content-secondary` (4) · `sidebar-divider` (4) · `sidebar-bg` (4) · `surface-hover` (2) · `app-bg` (2) · `border-inverse` (2) · `info` (2)

**Tema claro**

![settings_transcription claro — cada elemento rotulado com o token que consome](assets/2026-07-29-tokens-rotulados/settings_transcription-light.png)

**Tema escuro**

![settings_transcription escuro — cada elemento rotulado com o token que consome](assets/2026-07-29-tokens-rotulados/settings_transcription-dark.png)

### 4.13 `settings_mobile_connections` — `/settings/mobile-connections`

50 elementos (claro 25 · escuro 25) · **10 tokens inadequados** · 0 OK

Inadequados nesta tela: `static-white` (8) · `surface-hover` (4) · `content-secondary` (4) · `sidebar-divider` (4) · `sidebar-bg` (4) · `content-primary` (4) · `content-inverse` (4) · `primary` (4) · `app-bg` (2) · `primary-foreground` (2)

**Tema claro**

![settings_mobile_connections claro — cada elemento rotulado com o token que consome](assets/2026-07-29-tokens-rotulados/settings_mobile_connections-light.png)

**Tema escuro**

![settings_mobile_connections escuro — cada elemento rotulado com o token que consome](assets/2026-07-29-tokens-rotulados/settings_mobile_connections-dark.png)

### 4.14 `ws_general_appearance` — `/workspace/glm-test/settings/general-appearance`

62 elementos (claro 31 · escuro 31) · **15 tokens inadequados** · 1 OK

Inadequados nesta tela: `surface-hover` (14) · `content-primary` (14) · `content-info` (14) · `content-inverse` (8) · `destructive` (6) · `content-secondary` (4) · `sidebar-divider` (4) · `sidebar-bg` (4) · `sidebar-field-bg` (4) · `destructive-foreground` (4) · `app-bg` (2) · `static-white` (2)

**Tema claro**

![ws_general_appearance claro — cada elemento rotulado com o token que consome](assets/2026-07-29-tokens-rotulados/ws_general_appearance-light.png)

**Tema escuro**

![ws_general_appearance escuro — cada elemento rotulado com o token que consome](assets/2026-07-29-tokens-rotulados/ws_general_appearance-dark.png)

### 4.15 `ws_vector_database` — `/workspace/glm-test/settings/vector-database`

70 elementos (claro 35 · escuro 35) · **15 tokens inadequados** · 1 OK

Inadequados nesta tela: `content-primary` (20) · `surface-hover` (14) · `content-inverse` (12) · `content-info` (12) · `destructive` (6) · `content-secondary` (4) · `sidebar-divider` (4) · `sidebar-bg` (4) · `sidebar-field-bg` (4) · `destructive-foreground` (4) · `app-bg` (2) · `static-white` (2)

**Tema claro**

![ws_vector_database claro — cada elemento rotulado com o token que consome](assets/2026-07-29-tokens-rotulados/ws_vector_database-light.png)

**Tema escuro**

![ws_vector_database escuro — cada elemento rotulado com o token que consome](assets/2026-07-29-tokens-rotulados/ws_vector_database-dark.png)

### 4.16 `ws_thread_ativa` — `/workspace/glm-test/t/5ee546b3-f567-41be-b8a9-5e3b52df6d5a`

72 elementos (claro 36 · escuro 36) · **11 tokens inadequados** · 2 OK

Inadequados nesta tela: `surface-hover` (46) · `content-primary` (22) · `content-secondary` (10) · `static-white` (10) · `content-tertiary` (8) · `sidebar-divider` (4) · `sidebar-bg` (4) · `sidebar-field-bg` (4) · `app-bg` (2) · `sidebar-item-hover` (2) · `prompt-bg` (2)

**Tema claro**

![ws_thread_ativa claro — cada elemento rotulado com o token que consome](assets/2026-07-29-tokens-rotulados/ws_thread_ativa-light.png)

**Tema escuro**

![ws_thread_ativa escuro — cada elemento rotulado com o token que consome](assets/2026-07-29-tokens-rotulados/ws_thread_ativa-dark.png)

## 5. Reprodutibilidade

```bash
cd frontend
node tokens/inventory-surface.mjs              # inventário da família surface
node tests/visual/capture-token-labels.mjs     # as imagens rotuladas + labels.json
cat frontend/tokens/GRAMMAR.md                 # a lei aplicada
```

Dossiês que alimentaram os agentes: `/tmp/claude-1000/naming/*.txt` (efêmeros —
regeráveis pelo script acima).## 3. A lista — 139 tokens numerados

Cada token: valor por tema, usos, **onde está aplicado** (concreto, com
`path:linha`), veredito, e o nome sugerido quando inadequado.

### 3.1 grupo `05-owners-a — controles (button, field, select, checkbox, radio, toggle, search) — 19 tokens, 67 usos`

> **Refutação:** `CORRIGIR` — 18 confirmados, 2 refutados, 0 omitidos.

#### 1. `button-container-background-color` — ✅ **OK**

| | |
|---|---|
| **valor** | light `#F7F7F7` · dark `#2A2C32` |
| **usos** | 23 |
| **propriedades** | background-color (Tailwind bg-*): 23/23. Nenhum text/border/var() neste token. |
| **risco** | Nenhum. Nome já correto — não há troca a fazer. |

**Onde está aplicado.** Fundo padrão (estado default, sem sufixo de estado) de botões de ação reais (<button>) espalhados em 18 arquivos. Confirmado lendo o JSX, não só o nome da classe: src/components/WorkspaceChat/ChatContainer/ChatHistory/HistoricalMessage/Actions/EditMessage/index.jsx:167-169 (<button type="submit"> 'Submit/Save' da edição de mensagem); src/components/WorkspaceChat/ChatContainer/MemoriesSidebar/MemoryModal/index.jsx:95-99 (<button onClick={handleSubmit}> salvar memória); src/pages/OnboardingFlow/Steps/Home/index.jsx:46-49 (<button> CTA 'Get Started' do onboarding); src/pages/GeneralSettings/ScheduledJobs/index.jsx:120-123 e :186-189 (<button onClick={handleCreate}> 'New Job', estado vazio e header); src/pages/GeneralSettings/ScheduledJobs/RunDetailPage.jsx:237-241 (<button onClick={onContinueInThread}>); src/pages/GeneralSettings/ModelRouters/index.jsx:108-110 e :169-171 (<button> 'New router', header e empty-state); src/pages/GeneralSettings/ModelRouters/RuleBuilder/index.jsx:104-106 e :204-206 (<button> 'Add rule'); src/pages/GeneralSettings/ScheduledJobs/JobFormModal/ToolsSelector.jsx:196-199 (<button> toggle de categoria de ferramentas); src/pages/GeneralSettings/ScheduledJobs/JobFormModal/FormActions.jsx:15-18 (<button type="submit"> salvar/criar job); src/pages/GeneralSettings/Connections/TelegramBot/SetupView/index.jsx:44-47 (<button type="submit"> conectar bot Telegram); src/pages/GeneralSettings/ModelRouters/LLMProviderModelPicker/index.jsx:270-273 (<button type="submit"> salvar credenciais de provider). Todos são elementos <button> reais, sem sub-partes visuais distintas sendo pintadas (o fundo cobre a superfície inteira do botão).

**Por quê.** owner=button (elemento <button> real em todos os 18 sites lidos), anatomia=container (superfície inteira do botão, sem sub-parte distinguível sendo alvo — cumpre a regra 'owner sem partes distinguíveis usa container' de §4.2), propriedade=background-color (bg-*). É exatamente o estado default (sem sufixo, sem '.default' escrito, conforme §4.5). Nome já é owner.anatomia.propriedade.

#### 2. `button-container-background-color-active` — ✅ **OK**

| | |
|---|---|
| **valor** | light `#F7F7F7` · dark `#2A2C32` |
| **usos** | 4 |
| **propriedades** | background-color (bg-*): 4/4. |
| **risco** | Nenhum. Nome já correto. |

**Onde está aplicado.** Fundo do botão-gatilho (<button>) enquanto o painel/menu que ele abre está visível. Confirmado: src/components/WorkspaceChat/ChatContainer/WorkspaceModelPicker/index.jsx:113-120 (<button onClick={() => setShowSelector(!showSelector)}>, classe condicional showSelector ? 'active' : hover-only); src/components/WorkspaceChat/ChatContainer/PromptInput/index.jsx:468-479 (ToolsButton, <button id="tools-btn">, showTools ? active : hover); src/components/WorkspaceChat/ChatContainer/ChatSettingsMenu/index.jsx:30-38 (<button ref={buttonRef}>, showMenu ? active : hover); src/components/WorkspaceChat/ChatContainer/TextSizeMenu/index.jsx:45-53 (mesmo padrão, showMenu). Nos 4 sites, quando o painel está fechado o botão não usa nenhum bg (só hover), então 'active' é literalmente o estado ligado deste mesmo botão-gatilho.

**Por quê.** Mesmo owner/anatomia/propriedade do token #1 (button.container.background-color), estado=active do vocabulário fechado §4.5. O par 'default' do contrato existe no sistema (token #1, $root); o resting state destes botões específicos é transparente (ausência de classe), o que é um default legítimo (CSS sem background), não um 'hover sem base'.

#### 3. `button-container-background-color-disabled` — ✅ **OK**

| | |
|---|---|
| **valor** | light `#F7F7F7` · dark `#2A2C32` |
| **usos** | 1 |
| **propriedades** | background-color (bg-*): 1/1. |
| **risco** | Nenhum. Nome já correto. |

**Onde está aplicado.** Fundo do botão de enviar mensagem (<button type="submit">) quando o campo de prompt está vazio ou desabilitado. src/components/WorkspaceChat/ChatContainer/PromptInput/index.jsx:502-508: `disabled={isDisabled \|\| !promptInput.trim().length}` com ternário `promptInput.trim().length && !isDisabled ? 'cursor-pointer bg-surface-inset-inverse ...' : 'cursor-not-allowed bg-button-container-background-color-disabled'`.

**Por quê.** owner=button (o próprio <button type=submit>), anatomia=container, propriedade=background-color, estado=disabled (§4.5). O par default do CONTRATO button.container.background-color existe no sistema (token #1); o estado habilitado deste botão específico usa outro token (bg-surface-inset-inverse, fora deste grupo de 19), mas isso não invalida o par — a regra 5.4 exige que a árvore do token tenha um default, não que o MESMO elemento consuma ambos.

#### 4. `button-container-background-color-ghost` — ✅ **OK**

| | |
|---|---|
| **valor** | light `transparent` · dark `transparent` |
| **usos** | 1 |
| **propriedades** | background-color (bg-*): 1/1. |
| **risco** | Nenhum. Nome já correto. |

**Onde está aplicado.** Fundo (transparente) da aba não-selecionada do seletor Builder/Custom de agendamento cron. src/pages/GeneralSettings/ScheduledJobs/JobFormModal/JobSchedule.jsx:40-51: <button type="button" onClick={() => onModeChange(tab.value)}> com `scheduleMode === tab.value ? 'bg-...-ghost-selected ...' : 'bg-...-ghost ...'`.

**Por quê.** owner=button (elemento <button> real), anatomia=container, propriedade=background-color, variante=ghost — 'ghost' está no vocabulário fechado de variantes (§4.4). É o $root (base) da variante ghost.

#### 5. `button-container-background-color-ghost-selected` — ✅ **OK**

| | |
|---|---|
| **valor** | light `#F9F9F7` · dark `#2A2C32` |
| **usos** | 1 |
| **propriedades** | background-color (bg-*): 1/1. |
| **risco** | Nenhum. Nome já correto. |

**Onde está aplicado.** Mesmo botão do token #4 (JobSchedule.jsx:40-51), fundo quando a aba (Builder ou Custom) está selecionada.

**Por quê.** Mesmo owner/anatomia/propriedade/variante do token #4, com estado=selected do vocabulário fechado §4.5. Par default (ghost, token #4) existe no mesmo arquivo/mesmo componente — cumpre §5.4.

#### 6. `button-container-background-color-loading` — ✅ **OK**

| | |
|---|---|
| **valor** | light `#F7F7F7` · dark `#2A2C32` |
| **usos** | 1 |
| **propriedades** | background-color (bg-*): 1/1. |
| **risco** | Nenhum na renomeação. Fora de escopo: a div sem role=button é um risco de acessibilidade, não de naming. |

**Onde está aplicado.** Fundo do botão de microfone (speech-to-text) enquanto a transcrição está processando. src/components/WorkspaceChat/ChatContainer/PromptInput/SpeechToText/MicButton/index.jsx:50-61: elemento raiz é um <div onClick={toggle} className="group border-none ... cursor-pointer w-8 h-8 rounded-full ..."> (não é um <button> semântico, mas visualmente/funcionalmente é o mesmo padrão de botão-ícone circular usado pelos irmãos reais <button> na mesma toolbar do PromptInput, ex. AtSign em index.jsx:436-448 e ToolsButton em index.jsx:468-491). Classe condicional: `processing ? 'loading' : listening ? 'on' : ''`.

**Por quê.** Pela regra §5.1 (owner vem do CONTEXTO RENDERIZADO, não do valor nem da tag literal), o papel funcional aqui é inequivocamente de botão-ícone-de-alternância — mesmo padrão visual/comportamental dos botões reais adjacentes na mesma barra. owner=button, anatomia=container, propriedade=background-color, estado=loading (§4.5). Observação não-bloqueante: o elemento é <div>, não <button> semântico — isso é um possível gap de acessibilidade, fora do escopo desta auditoria de naming.

#### 7. `button-container-background-color-on` — ✅ **OK**

| | |
|---|---|
| **valor** | light `#F7F7F7` · dark `#2A2C32` |
| **usos** | 1 |
| **propriedades** | background-color (bg-*): 1/1. |
| **risco** | Nenhum. Nome já correto. |

**Onde está aplicado.** Mesmo MicButton do token #6 (src/components/WorkspaceChat/ChatContainer/PromptInput/SpeechToText/MicButton/index.jsx:57-59), fundo enquanto a captura de áudio está ativa (listening=true).

**Por quê.** Mesmo owner/anatomia/propriedade do token #6, estado=on do vocabulário fechado §4.5 (par lógico de 'off' implícito = ausência de classe/transparente).

#### 8. `button-container-background-color-secondary` — ✅ **OK**

| | |
|---|---|
| **valor** | light `#F7F7F7` · dark `#FFFFFF (consumido com opacidade /5 no call site, isto é, branco a 5% no dark)` |
| **usos** | 2 |
| **propriedades** | background-color (bg-*): 2/2, incluindo variante light: e alpha /5 aplicados no ponto de uso. |
| **risco** | Nenhum. Nome já correto. |

**Onde está aplicado.** Fundo (não-selecionado) dos chips de dia-da-semana do construtor visual de cron. src/pages/GeneralSettings/ScheduledJobs/JobFormModal/CronBuilder.jsx:150-167: <button type="button" onClick={...}> por dia da semana, classe `bg-button-container-background-color-secondary/5 ... light:bg-button-container-background-color-secondary` quando não selecionado.

**Por quê.** owner=button (elemento <button> real), anatomia=container, propriedade=background-color, variante=secondary (§4.4). É o $root (base) da variante secondary.

#### 9. `button-container-background-color-secondary-selected` — ✅ **OK**

| | |
|---|---|
| **valor** | light `#F9F9F7` · dark `#2A2C32` |
| **usos** | 1 |
| **propriedades** | background-color (bg-*): 1/1. |
| **risco** | Nenhum. Nome já correto. |

**Onde está aplicado.** Mesmo botão do token #8 (CronBuilder.jsx:150-163), fundo quando o dia da semana está selecionado (`selected ? 'bg-...-secondary-selected' : ...`).

**Por quê.** Mesmo owner/anatomia/propriedade/variante do token #8, estado=selected (§4.5). Par default (secondary, token #8) existe no mesmo arquivo — cumpre §5.4.

#### 10. `button-icon-background-color` — ✅ **OK**

| | |
|---|---|
| **valor** | light `#F7F7F7` · dark `#2A2C32` |
| **usos** | 1 |
| **propriedades** | background-color (bg-*): 1/1. |
| **risco** | Nenhum. Nome já correto. |

**Onde está aplicado.** Fundo do tile quadrado (24x24) que envolve o ícone '+' dentro do botão 'Nova thread' da sidebar. src/components/Sidebar/ActiveWorkspaces/ThreadContainer/index.jsx:193-199: <button onClick={onClick} className="... bg-sidebar-item-hover ..."> contendo <div className="bg-button-icon-background-color p-2 rounded-lg h-[24px] w-[24px] ..."> (o botão externo usa OUTRO token de fundo; este token pinta só o tile interno do ícone).

**Por quê.** owner=button, anatomia=icon (tile do ícone, distinguível do container/superfície externa do botão — §4.2 lista 'icon' como anatomia própria), propriedade=background-color. Corretamente separado do token #1 (container) porque pinta uma sub-parte diferente do mesmo owner.

#### 11. `checkbox-checkmark` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#FFFFFF` · dark `#FFFFFF` |
| **usos** | 7 |
| **propriedades** | color (Tailwind text-*): 6/7. var() (CSS custom property direta em stopColor de SVG): 1/7. |
| **nome sugerido** | `QUEBRAR — ver campo quebra (nenhum nome único serve; owners incompatíveis)` |
| **classe** | `N/A — sem classe única correta; ver quebra` |
| **risco** | Pixel-idêntico SE os 3 tokens não-PENDENTE herdarem o mesmo valor atual (#FFFFFF, invariante nos 2 temas) — é puro split de identificador/owner, sem mudança de valor. O 4º (PENDENTE) fica parado até decisão do dono; não migrar sem resolver o owner. |

**Onde está aplicado.** NENHUM dos 7 usos pinta o glifo de check de um checkbox de verdade — o checkbox real (ToolsSelector.jsx:43-47, <Check size={12} className="text-content-primary">) usa outro token. Os 7 usos reais são: (1) src/components/ContextualSaveBar/index.jsx:15 — ícone <AlertTriangle> de uma barra de aviso 'alterações não salvas' fixa no topo (bg-dark-input); (2) index.jsx:16 — texto <p> da mesma barra; (3) src/pages/OnboardingFlow/Steps/Home/components/OnboardingLogoSVG.jsx:64 — stopColor de um <linearGradient> decorativo da ilustração hero do onboarding (só no branch isLight; no dark usa var(--color-ui-legacy-x-button), token diferente); (4)-(7) src/pages/GeneralSettings/Settings/components/CustomLogo/index.jsx:130 e :145 — texto+hover dos botões 'Replace'/'Remove' sobre o overlay escuro (bg-static-black/80) ao passar mouse na logo customizada.

**Por quê.** Viola §5.1/§5.2: o nome promete 'checkmark de checkbox' mas o valor (#FFFFFF invariante) está sendo usado como 'branco genérico para texto/ícone sobre fundo escuro' em 3 owners incompatíveis — nenhum deles é checkbox. É o mesmo padrão do H-021 do GRAMMAR (`surface.deep` em backdrop, tabela e botão): reuso por coincidência de hex, não por papel compartilhado.

**⚠ Precisa QUEBRAR** — serve owners incompatíveis (§5.1):

- `4 tokens: (1) banner.icon.color — ContextualSaveBar, ícone AlertTriangle (ContextualSaveBar/index.jsx:15)`
- `(2) banner.label.color — ContextualSaveBar, texto do aviso (index.jsx:16)`
- `(3) button.label.color — CustomLogo, texto dos botões 'Replace'/'Remove' sobre overlay escuro (CustomLogo/index.jsx:130,145)`
- `(4) PENDENTE — OnboardingLogoSVG stopColor decorativo (OnboardingLogoSVG.jsx:64): não há owner no vocabulário fechado §4.1 para 'acento de gradiente de ilustração decorativa'`
- `candidato mais próximo é 'logo' (owner novo/justificativa a confirmar com o dono), e a propriedade mais próxima das 7 fechadas seria fill, embora tecnicamente seja um stop-color de <linearGradient> SVG, não fill de um shape — marcar PENDENTE em vez de chutar, conforme §5.5.`

#### 12. `checkbox-container-background-color` — ✅ **OK**

| | |
|---|---|
| **valor** | light `#FCFCFB` · dark `#21252B` |
| **usos** | 1 |
| **propriedades** | background-color (bg-*): 1/1. |
| **risco** | Nenhum. Nome já correto. |

**Onde está aplicado.** Fundo (estado desmarcado/default) do checkbox visual custom dentro do seletor de ferramentas de job agendado. src/pages/GeneralSettings/ScheduledJobs/JobFormModal/ToolsSelector.jsx:30-41: componente local `Checkbox({state, disabled})` renderiza `<span aria-hidden="true" className={... !disabled && !filled ? 'bg-checkbox-container-background-color border-border-default' : ...}>` — é um checkbox custom (não <input type=checkbox> nativo, decorativo com aria-hidden), não um botão nem um card.

**Por quê.** owner=checkbox (o span É visualmente/funcionalmente um checkbox custom, papel confirmado pelo contexto renderizado conforme §5.1), anatomia=container (sem sub-parte distinguível além do próprio fundo — o glifo de check usa outro elemento/token), propriedade=background-color, estado=default (omitido, correto pela regra 'não escreva .default').

#### 13. `checkbox-container-background-color-checked` — ✅ **OK**

| | |
|---|---|
| **valor** | light `#2563EB` · dark `#2563EB` |
| **usos** | 2 |
| **propriedades** | background-color (bg-*): 2/2 (classe base + variante light: idêntica). |
| **risco** | Nenhum. Nome já correto. |

**Onde está aplicado.** Mesmo componente Checkbox do token #12 (ToolsSelector.jsx:35-39), fundo quando `state === 'checked' \|\| state === 'indeterminate'` (filled=true).

**Por quê.** Mesmo owner/anatomia/propriedade do token #12, estado=checked (§4.5, inclui explicitamente 'checked'). Par default existe no mesmo componente (token #12) — cumpre §5.4.

#### 14. `checkbox-container-background-color-disabled` — ✅ **OK**

| | |
|---|---|
| **valor** | light `#F7F7F7` · dark `#2A2C32` |
| **usos** | 1 |
| **propriedades** | background-color (bg-*): 1/1. |
| **risco** | Nenhum. Nome já correto. |

**Onde está aplicado.** Mesmo componente Checkbox do token #12 (ToolsSelector.jsx:33-37), fundo quando `disabled=true`.

**Por quê.** Mesmo owner/anatomia/propriedade do token #12, estado=disabled (§4.5). Par default existe no mesmo componente — cumpre §5.4.

#### 15. `field-container-background-color` — ✅ **OK**

| | |
|---|---|
| **valor** | light `#F7F7F7` · dark `#2A2C32` |
| **usos** | 9 |
| **propriedades** | background-color (bg-*): 9/9. |
| **risco** | Nenhum. Nome já correto. |

**Onde está aplicado.** Fundo de campos de formulário reais (<textarea>/<input>). src/components/WorkspaceChat/ChatContainer/ChatHistory/HistoricalMessage/Actions/EditMessage/index.jsx:100-107 e :122-129 (<textarea name="editedMessage">, edição de mensagem no chat); src/components/Modals/Password/SingleUserAuth.jsx:94-100 (<input type="password">, modal de senha single-user); src/components/Modals/Password/MultiUserAuth.jsx:55-63 (<input type="text"> username), :70-79 (<input type="text"> recovery codes, 4x), :140,:153,:317,:329 (mais inputs de senha/recovery no mesmo modal).

**Por quê.** owner=field (§4.1, controles), anatomia=container, propriedade=background-color, estado=default. Todos os 9 sites são elementos de formulário reais (<input>/<textarea>), consistente em 3 arquivos.

#### 16. `search-container-background-color` — ✅ **OK**

| | |
|---|---|
| **valor** | light `#F7F7F7` · dark `#2A2C32` |
| **usos** | 2 |
| **propriedades** | background-color (bg-*): 2/2 (classe base com alpha /50 + variante light: sem alpha). |
| **risco** | Nenhum. Nome já correto. |

**Onde está aplicado.** Fundo do campo de busca dedicado dentro do menu de skills/ferramentas do prompt. src/components/WorkspaceChat/ChatContainer/PromptInput/ToolsMenu/Tabs/AgentSkills/index.jsx:268-289: função `SearchInput` renderiza <Search> (ícone lupa) + <input type="text" onKeyDown={Escape limpa, Enter previne}> — comportamento de filtragem dedicado, distinto de um campo genérico.

**Por quê.** owner=search — vocabulário §4.1 lista 'search' como owner distinto de 'field' propositalmente (controle de busca dedicado). Contexto confirma: ícone de lupa + Escape-to-clear + filtragem, não é um campo de formulário genérico. anatomia=container, propriedade=background-color.

#### 17. `toggle-track-background-color-focus` — ✅ **OK**

| | |
|---|---|
| **valor** | light `#1E7C4A` · dark `#1E7C4A` |
| **usos** | 3 |
| **propriedades** | background-color (bg-*, sempre com sufixo de opacidade /15 no call site e prefixado por peer-focus:): 3/3. |
| **risco** | Nenhum. Nome já correto. |

**Onde está aplicado.** Realce (anel/glow) do trilho do toggle switch reutilizável ao receber foco de teclado. src/components/lib/Toggle/index.jsx:122-146: componente `ToggleSwitch` — <input type="checkbox" className="peer sr-only"> + <div className="... bg-toggle-track-background-color-off peer-focus:ring-... peer-focus:light:bg-toggle-track-background-color-focus/15 ... peer-checked:bg-toggle-track-background-color-on peer-focus:peer-checked:bg-toggle-track-background-color-focus/15 ...">. O <div> É o trilho visível do switch (o thumb é um pseudo-elemento `after:` separado, bg-static-white).

**Por quê.** owner=toggle (§4.1), anatomia=track (§4.2, o trilho/pílula de fundo do switch, distinto do thumb), propriedade=background-color, estado=focus (§4.5). É um realce composto com alpha por cima do off/on (não um 'hover sem base' — off e on já são as bases reais).

#### 18. `toggle-track-background-color-off` — ✅ **OK**

| | |
|---|---|
| **valor** | light `#F7F7F7` · dark `#2A2C32` |
| **usos** | 3 |
| **propriedades** | background-color (bg-*): 3/3. |
| **risco** | Nenhum. Nome já correto. |

**Onde está aplicado.** Fundo do trilho do toggle quando desligado. src/components/lib/Toggle/index.jsx:124 (ToggleSwitch, <div> trilho) e :197 (SimpleToggleSwitch, `${enabled ? on : off}` no <div role="switch">); src/pages/GeneralSettings/ScheduledJobs/components/JobRow.jsx:84-98 — aqui o trilho É o próprio <button type="button" role="switch" aria-checked={job.enabled}> (não um div; o botão inteiro tem o formato/cor do trilho, com um <span> thumb interno).

**Por quê.** owner=toggle, anatomia=track (no JobRow, o <button role=switch> desempenha visualmente o papel de trilho — confirma §5.1, owner pelo contexto renderizado, não pela tag), propriedade=background-color, estado=off (§4.5).

#### 19. `toggle-track-background-color-on` — ✅ **OK**

| | |
|---|---|
| **valor** | light `#1E7C4A` · dark `#1E7C4A` |
| **usos** | 3 |
| **propriedades** | background-color (bg-*): 3/3. |
| **risco** | Nenhum. Nome já correto. |

**Onde está aplicado.** Fundo do trilho do toggle quando ligado. Mesmos sites do token #18: src/components/lib/Toggle/index.jsx:125,197; src/pages/GeneralSettings/ScheduledJobs/components/JobRow.jsx:95-96 (`job.enabled ? 'bg-toggle-track-background-color-on' : ...` no <button role="switch">).

**Por quê.** Mesmo owner/anatomia/propriedade do token #18, estado=on (§4.5). Par off/on completo nos 2 componentes — cumpre §5.4.

<details><summary>o que a refutação derrubou neste grupo</summary>

- **`checkbox-checkmark (quebra item 4, PENDENTE do OnboardingLogoSVG)`** — PENDENTE é fuga, não ambiguidade real (viola o critério da Ataque §7 'se o dado determina o owner, PENDENTE é fuga'). O veredito afirma textualmente 'não há owner no vocabulário fechado §4.1 para acento de gradiente de ilustração decorativa' — falso: GRAMMAR.md linha 63 lista `logo` explicitamente na categoria 'Casca e navegação' (page · sidebar · nav-item · thread-item · workspace-item · toolbar · logo). Não é owner novo que precisa de justificativa (o texto do veredito erra ao chamá-lo de 'own
  - evidência: `frontend/tokens/GRAMMAR.md:63 (owners fechados, inclui 'logo'); frontend/tokens/GRAMMAR.md:83-86 (propriedades fechadas, inclui 'fill'); frontend/src/pages/OnboardingFlow/Steps/Home/components/OnboardingLogoSVG.jsx:1-84 (componente inteiro `
  - correção: Trocar o 4º item da quebra de PENDENTE para `logo.container.fill` (owner=logo já fechado, anatomia=container, propriedade=fill), preservando o valor atual #FFFFFF (branco invariante nos 2 temas) para zero mudança de pixel. Não há decisão do dono pendente aqui — só falta aplicar o vocabulário que o p
- **`checkbox-checkmark (citação de regra no campo porQue)`** — Citação de §5.2 é imprecisa/overreach. O porQue diz 'Viola §5.1/§5.2', mas §5.2 é especificamente sobre PROPRIEDADE incompatível (alias de fundo/background pintando texto, ex. `color: theme.surface.panel`). Nos 7 usos de checkbox-checkmark a propriedade é sempre color/text (6× text-*) ou stop-color de gradiente (1×) — nunca background pintando texto. O defeito real e comprovado é 100% owner incompatível por valor compartilhado (§5.1: 'o owner vem do contexto renderizado, não do valor' — dois con
  - evidência: `frontend/tokens/GRAMMAR.md:101-104 (texto de §5.1, sobre owner por contexto) vs GRAMMAR.md:105-107 (texto de §5.2, sobre propriedade incompatível); dossiê 05-owners-a.txt linhas 111-122 (PROPRIEDADES: {'text': 6, 'var()': 1} — nenhum 'bg' e`
  - correção: Ajustar o porQue para citar apenas §5.1 (owner incompatível por contexto renderizado) e opcionalmente §5.3 (repetição não é sentença — motivo de ter revisado os 7 usos individualmente), removendo a referência a §5.2 que não se aplica ao padrão de falha observado aqui.

</details>

### 3.2 grupo `04-cor-crua`

> **Refutação:** `CORRIGIR` — 16 confirmados, 4 refutados, 8 omitidos.

#### 20. `grey-dark` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#4B5563` · dark `#9CA3AF` |
| **usos** | 9 |
| **propriedades** | border: 9 (100% do uso é border-color, nenhum bg/text) |
| **nome sugerido** | `select.header.border-color` |
| **classe** | `border-select-header-border-color` |
| **risco** | Rename puro — mesmo hex nos 2 temas, zero mudança de pixel. Observação à parte (não muda o veredito): nenhum dos 9 sites define `border-width` junto de `border-grey-dark` nesse div; sem utilitário `border`/`border-b-*` a borda pode estar renderizando com espessura 0 (invisível) hoje — vale conferir  |

**Onde está aplicado.** Div 'sticky top-0' que envolve o campo de busca (ícone Search + input + botão X) dentro do popup de busca de 9 páginas de configuração de provedor, classe IDÊNTICA byte-a-byte nos 9 sites (confirmado lendo 5 arquivos completos, inclusive WorkspaceLLMSelection linhas 1-140 na íntegra): frontend/src/pages/WorkspaceSettings/ChatSettings/WorkspaceLLMSelection/index.jsx:101, .../AgentConfig/AgentLLMSelection/index.jsx:144, .../GeneralSettings/EmbeddingPreference/index.jsx:336, .../LLMPreference/index.jsx:636, .../TranscriptionPreference/index.jsx:164, .../AudioPreference/stt.jsx:166, .../AudioPreference/tts.jsx:158, .../VectorDatabase/index.jsx:268, .../Admin/Agents/WebSearchSelection/index.jsx:230. Código: `<div className="flex items-center sticky top-0 z-internal border-grey-dark mx-4 bg-theme-settings-input-bg">`. É a linha-cabeçalho (barra de busca) do combobox, dentro do popup maior que já usa `border-primary-button` na borda do container (linha 99) e `bg-static-black/70` no backdrop (linha 94).

**Por quê.** Nome é o pigmento, não o papel. Owner real = `select` (é um combobox de busca de provedor). Anatomia = `header` (linha superior sticky, separada da lista abaixo). Propriedade = `border-color`. Sem variante/estado (nenhum hover/focus documentado nesta borda). Por §5.3 a repetição em 9 arquivos é evidência — e aqui a leitura confirma que os 9 são de fato o MESMO papel, não uma coincidência de valor.

#### 21. `grey-darker` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#374151` · dark `#6B7280` |
| **usos** | 3 |
| **propriedades** | bg: 3 (via pseudo-classe disabled:) |
| **nome sugerido** | `button.container.background-color.selected` |
| **classe** | `disabled:bg-button-container-background-color-selected` |
| **risco** | Rename puro, mesmo hex nos 2 temas. O gatilho continua sendo o pseudo-seletor `disabled:` do Tailwind (implementação); só o identificador semântico do token deixa de carregar nome de pigmento. |

**Onde está aplicado.** 3 botões do segmented-control 'Chat Mode' (Automatic/Chat/Query) em frontend/src/pages/WorkspaceSettings/ChatSettings/ChatModeSelection/index.jsx:26,37,48 (arquivo lido por completo). Cada botão usa `disabled={chatMode === <opção>}` para marcar a opção CORRENTE — o atributo HTML `disabled` representa 'selecionado', não 'inativo': `className="...bg-transparent disabled:bg-grey-darker rounded-md hover:bg-surface-hover"`. As opções não-correntes ficam `bg-transparent` e reagem a `hover:bg-surface-hover`; a corrente vira `bg-grey-darker` e para de reagir a hover (efeito nativo do atributo disabled).

**Por quê.** Nome é pigmento. Owner real = `button` (cada opção é um `<button>`), anatomia = `container` (sem partes internas nomeáveis). Propriedade = `background-color`. O gatilho CSS é `disabled:`, mas o SIGNIFICADO renderizado (§5.1) é 'esta é a opção ativa do grupo' — isso é `selected` no vocabulário fechado (§4.5), não inércia real. O par default (`bg-transparent`) existe, satisfazendo §5.4.

#### 22. `grey-lighter` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#D1D5DB` · dark `#F3F4F6` |
| **usos** | 1 |
| **propriedades** | var(): 1 (stop final de um gradient background) |
| **nome sugerido** | `chat-message.backdrop.background-color` |
| **classe** | `bg-chat-message-backdrop-background-color (consumido via var() dentro do gradient inline, não como classe solta)` |
| **risco** | Rename mantendo o hex atual é pixel-idêntico. ATENÇÃO: a correção mais profunda (unificar com `surface-emphasis`, já usado no ramo escuro, eliminando a assimetria) MUDARIA o pixel do tema claro — decisão de valor separada desta tarefa de naming, não fazer junto sem aprovação explícita. |

**Onde está aplicado.** Gradiente de esmaecimento (fade) no rodapé de uma mensagem de chat truncada, só quando `showTruncation` é true: frontend/src/components/WorkspaceChat/ChatContainer/ChatHistory/HistoricalMessage/index.jsx:279-285 (lido com contexto 260-299). É o PAR do gradiente do tema escuro (linhas 272-278, mesmo componente) que termina em `var(--color-surface-emphasis)` — token JÁ semântico; o ramo `light:block` nunca foi migrado e ainda termina em `var(--color-grey-lighter)` cru: `background: linear-gradient(180deg, ... 50%, var(--color-grey-lighter) 100%)`.

**Por quê.** Nome é pigmento. Owner = `chat-message`. Anatomia mais próxima no vocabulário fechado para um véu de esmaecimento é `backdrop` (não existe 'fade/scrim' na lista). Propriedade fechada mais próxima é `background-color` (a cor no ponto final do gradiente). É literalmente a metade clara do MESMO contrato que já usa `surface-emphasis` no escuro — dois valores para o que deveria ser um papel só, dividido por tema por acidente de migração incompleta.

#### 23. `pink-dark` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#9E0A30` · dark `#9E0A30` |
| **usos** | 5 |
| **propriedades** | var(): 5 (100% indireto — nenhum className usa bg-pink-dark diretamente) |
| **nome sugerido** | `N/A — quebrar (ver campo quebra)` |
| **classe** | `N/A — depende do split` |
| **risco** | Item (1): rename puro, mesmo hex nos 2 temas. Item (2): não há valor a mudar agora, é decisão de vocabulário pendente. |

**Onde está aplicado.** 5 usos indiretos. (a) frontend/src/index.css:71,185 define `--theme-button-primary-hover: var(--color-pink-dark)` — CONFIRMADO ÓRFÃ: grep completo em src/**/*.jsx por 'theme-button-primary-hover' não retorna nenhum consumo. (b) index.css:93,207 define `--theme-home-button-primary-hover: var(--color-pink-dark)` — essa É consumida: frontend/src/components/ui/Button/index.jsx:87, variante `brandIcon` do Button compartilhado (`hover:bg-theme-home-button-primary-hover disabled:bg-theme-home-button-primary-hover`, CTA de marca usado em 8 telas conforme o próprio comentário do arquivo linhas 83-86). (c) tailwind.config.js:57 registra o alias `magenta: "var(--color-pink-dark)"`, consumido em frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/Attachments/index.jsx:232 como `bg-magenta` — fundo do ÍCONE de anexo quando o arquivo é PDF, na função `displayFromFile` que também usa `bg-royalblue` (docx), `bg-purple` (html), `bg-success` (csv/xlsx): é uma paleta CATEGÓRICA por tipo de arquivo, não um papel de UI.

**Por quê.** Nome é pigmento. Tem 2 contextos renderizados incompatíveis (§5.1/§5.2): hover/disabled do botão de marca (owner=button, property=background-color) vs. cor categórica de ícone de anexo por tipo de arquivo (owner=attachment, mas a distinção é 'tipo PDF', que não existe no vocabulário fechado de variantes §4.4). Por §5.5 o segundo uso não pode virar palpite de variante.

**⚠ Precisa QUEBRAR** — serve owners incompatíveis (§5.1):

- `2: (1) button.container.background-color.primary.hover — renomeável com segurança (Button.jsx:87, variante brandIcon)`
- `(2) PENDENTE: badge/icon de tipo de arquivo (Attachments/index.jsx:232) — vocabulário fechado não tem slot de variante para paleta categórica de tipo de arquivo`
- `decisão do dono necessária (criar eixo de variante novo, ou aceitar que cor de categoria de dado fica fora da lei owner.anatomia.propriedade).`

#### 24. `pink-light` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#F23666` · dark `#F23666` |
| **usos** | 8 |
| **propriedades** | var(): 8 (100% indireto, via 4 variáveis --theme-*) |
| **nome sugerido** | `N/A — quebrar (ver campo quebra)` |
| **classe** | `N/A — depende do split` |
| **risco** | Rename puro para os 2 itens vivos, mesmo hex nos 2 temas. As 2 variáveis órfãs não têm risco de pixel (não renderizam nada hoje) mas também não devem ganhar nome novo — candidatas a remoção, fora do escopo desta tarefa. |

**Onde está aplicado.** 8 usos em index.css alimentando 4 variáveis --theme-*: (a) `--theme-home-button-secondary-hover-text` (index.css:97,211) — CONSUMIDA em frontend/src/components/DefaultChat/index.jsx:93, link 'ir para workspace' estilizado como botão secundário: `bg-theme-home-button-secondary hover:bg-surface-hover text-theme-home-button-secondary-text hover:text-theme-home-button-secondary-hover-text`. (b) `--theme-home-update-source` (index.css:100,214) — ÓRFÃ, grep 'update-source' em src/**/*.jsx não retorna nada. (c) `--theme-checklist-button-text` (index.css:112,226) — ÓRFÃ, grep não retorna nada (feature Checklist sem componente vivo). (d) `--theme-attachment-icon-spinner` (index.css:125,238) — CONSUMIDA em frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/Attachments/index.jsx:67, `className="text-theme-attachment-icon-spinner animate-spin"`, cor do ícone de loading durante o upload de anexo.

**Por quê.** Nome é pigmento. Dos 4 contratos que alimenta, só 2 têm consumo renderizado real e são owners incompatíveis (§5.1/§5.2): `button` (texto de hover de botão secundário) e `attachment` (cor de ícone em estado `loading`, que existe no vocabulário fechado §4.5).

**⚠ Precisa QUEBRAR** — serve owners incompatíveis (§5.1):

- `2 (com consumo real): (1) button.container.color.secondary.hover — DefaultChat/index.jsx:93`
- `(2) attachment.icon.color.loading — Attachments/index.jsx:67. As outras 2 variáveis alimentadas por este primitivo (--theme-home-update-source, --theme-checklist-button-text) são órfãs — sem contexto renderizado (§5.1), não entram no split.`

#### 25. `pink-lighter` — ⏸️ **PENDENTE**

| | |
|---|---|
| **valor** | light `#F77E9D` · dark `#F77E9D` |
| **usos** | 2 |
| **propriedades** | var(): 2 (100% indireto, 1 única variável --theme-*) |
| **risco** | N/A — não há uso para medir risco de rename. Ação recomendada fora do escopo: decisão de produto (a feature Checklist volta? se sim, qual o owner; se não, token e variável são candidatos a remoção). |

**Onde está aplicado.** Único consumidor: `--theme-checklist-item-text: var(--color-pink-lighter)` em frontend/src/index.css:104 e :218. Busquei exaustivamente em `src/**/*.jsx` por qualquer classe/uso que resolva 'checklist-item-text' — zero resultado; o único hit para a palavra 'checklist' em JSX é um comentário JSDoc `@checklist-item` em PromptInput/index.jsx:70 (não é className). Também busquei 'checklist-item-hover', 'checklist-item-bg', 'checklist-checkbox*', 'checklist-button*' — todos zero em JSX, e `find src -iname '*checklist*'` não encontra nenhum componente.

**Por quê.** §5.1 exige owner do CONTEXTO RENDERIZADO, e não há nenhum: a variável alimentada por este primitivo é órfã — a feature 'Checklist' não tem componente vivo no código atual. Nomear um owner aqui seria exatamente o palpite que §5.5 proíbe.

#### 26. `pink-medium` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#E60F46` · dark `#E60F46` |
| **usos** | 9 |
| **propriedades** | var(): 9 (100% indireto, via 4 variáveis --theme-* + 1 alias tailwind) |
| **nome sugerido** | `N/A — quebrar (ver campo quebra)` |
| **classe** | `N/A — depende do split` |
| **risco** | Rename puro por item, mesmo hex nos 2 temas — nenhum pixel muda só de renomear. Risco de processo: (2) e (3) hoje são o MESMO alias Tailwind (`primary-button`) aplicado a `outline-*` e a `border-*` em owners diferentes; separar é seguro (mesmo valor) mas exige 2 migrações sequenciais em famílias de  |

**Onde está aplicado.** 9 usos alimentando 4 variáveis --theme-* + o alias `teal`. (a) `--theme-button-primary` (exposta pelo alias top-level `primary-button`, tailwind.config.js:46) — CONSUMIDA em 2 papéis: como FUNDO de botão (frontend/src/components/SpeechToText/LemonadeOptions/index.jsx:40, `bg-primary-button`) e como OUTLINE/BORDA de campo em foco (`focus:outline-primary-button active:outline-primary-button` em LemonadeOptions/index.jsx:75,122 e TranscriptionSelection/GenericOpenAiOptions/index.jsx:14,32,51) e como BORDA do popup do combobox de busca (`border-2 border-primary-button` em WorkspaceLLMSelection/index.jsx:99 e os 8 sites irmãos do token grey-dark). (b) `--theme-home-button-primary` — CONSUMIDA em frontend/src/components/ui/Button/index.jsx:87 (`bg-theme-home-button-primary`, fundo default da variante `brandIcon`). (c) `--theme-checklist-item-hover` — ÓRFÃ (mesma família morta de pink-lighter). (d) `--theme-button-code-hover-text` — CONSUMIDA em frontend/src/pages/GeneralSettings/ChatEmbedWidgets/EmbedConfigs/EmbedRow/index.jsx:99, `<span className="group-hover:text-theme-button-code-hover-text">` dentro do botão 'Code'. (e) alias `teal` (tailwind.config.js:62) — CONSUMIDO em frontend/src/pages/OnboardingFlow/Steps/Survey/index.jsx:281, `hover:text-teal` no botão 'Skip survey'. NOTA: `chart-utils.js` também usa a palavra 'teal', mas lê `--color-chart-teal` (variável DIFERENTE, categórica de gráfico) — sem relação com este primitivo, apesar do nome do alias coincidir.

**Por quê.** Nome é pigmento. É o primitivo mais fragmentado do grupo: alimenta pelo menos 5 combinações owner.anatomia.propriedade incompatíveis (§5.1/§5.2) — fundo de botão primário, outline de campo em foco, borda de popup de select, cor de label em hover, cor de texto de botão em hover — cada uma um contrato diferente colidindo no mesmo hex por acidente.

**⚠ Precisa QUEBRAR** — serve owners incompatíveis (§5.1):

- `5: (1) button.container.background-color.primary (Button.jsx:87, LemonadeOptions:40)`
- `(2) field.container.outline-color.focus (LemonadeOptions:75,122`
- `GenericOpenAiOptions:14,32,51)`
- `(3) select.container.border-color (WorkspaceLLMSelection:99 e 8 irmãos — borda do popup aberto, não é foco de campo)`
- `(4) button.label.color.hover (EmbedRow/index.jsx:99, span dentro do botão)`
- `(5) button.container.color.hover (Survey/index.jsx:281, texto direto no botão, sem span).`

#### 27. `red-dark` — ⏸️ **PENDENTE**

| | |
|---|---|
| **valor** | light `#EF4444` · dark `#EF4444` |
| **usos** | 1 |
| **propriedades** | var(): 1 (alias solto em tailwind.config.js, sem consumo) |
| **risco** | N/A. Ação recomendada fora do escopo de naming: confirmar com o dono se o alias `danger` (tailwind.config.js:58) pode ser removido — não é candidato a rename, é candidato a remoção. |

**Onde está aplicado.** Único uso: `danger: "var(--color-red-dark)"` em frontend/tailwind.config.js:58, dentro do bloco de aliases legados (linhas 33-62). Busquei em TODO `src/**/*.jsx` e `src/**/*.js` por `bg-danger`, `text-danger`, `border-danger`, `outline-danger`, `ring-danger`, `fill-danger`, `stroke-danger` e pela palavra solta `danger` — zero resultado. Os ~70 hits reais para 'danger' no código (ex.: frontend/src/components/WorkspaceChat/index.jsx:101) são todos `content-danger`, token JÁ semântico e completamente diferente (não referencia --color-red-dark).

**Por quê.** §5.1 exige contexto renderizado; não existe nenhum. O alias `danger` nunca é consumido por nenhum componente — é código morto na configuração do Tailwind. Sem site renderizado, não há como determinar owner/anatomia/propriedade sem chutar (proibido por §5.5).

#### 28. `static-black` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#000000` · dark `#000000` |
| **usos** | 88 |
| **propriedades** | bg: 48, var(): 9, text: 23, border: 8 |
| **nome sugerido** | `N/A — quebrar (ver campo quebra)` |
| **classe** | `N/A — depende do split` |
| **risco** | Rename puro é pixel-idêntico para os 7 itens nomeáveis (mesmo hex #000000 nos 2 temas). Achado colateral fora do escopo de naming: existem 3 mecanismos duplicados para o MESMO papel de backdrop (Tailwind bg-static-black/N, CSS .backdrop/dialog::backdrop, e o .modal-scrim já canônico) — consolidar é  |

**Onde está aplicado.** 88 usos em 64 arquivos, papéis muito heterogêneos. Amostra lida e confirmada (index.css relido no estado ATUAL via grep, pois o arquivo tem diffs não commitados que deslocaram linhas ~38 em relação ao dossiê original): (A) BACKDROP de overlay/modal ad-hoc em opacidades diferentes: KeyboardShortcutsHelp/index.jsx:27 (/50, modal de atalhos), SetupProvider/index.jsx:44 (/50, DENTRO de um <ModalWrapper> que deveria trazer scrim próprio — backdrop duplicado), NewFolderModal/index.jsx:35 (/50), Directory/index.jsx:330 (/60), WorkspaceLLMSelection/index.jsx:94 e os 8 irmãos confirmados por leitura direta (AgentLLMSelection:135, EmbeddingPreference:328, VectorDatabase:261, WebSearchSelection:222) usam /70, ImageLightbox/index.jsx:59 usa /90. Em CSS puro o mesmo papel aparece via `.backdrop`/`dialog::backdrop` (index.css:588-595, `rgb(var(--color-static-black-rgb)/0.5)`), e existe AINDA um terceiro mecanismo canônico já documentado, `.modal-scrim` (index.css:1317-1324, comentário 'fonte única para os 47 importadores do ModalWrapper', usa var(--modal-scrim) — outro token) — os sites acima estão fora desse padrão já centralizado. (B) Texto do botão 'confirm' (arquétipo documentado em src/components/ui/Button/index.jsx:59-60): WorkspaceChat/index.jsx:114 (`bg-static-white text-static-black`). (C) Badge numérico de contagem de anexos: PromptInput/AttachItem/index.jsx:97 (`bg-static-white text-static-black light:invert`). (D) Ícone de fallback de citação: ChatHistory/Citation/index.jsx:93 (`<Icon className="text-static-black" />`, quando não há favicon/imagem customizada). (E) Tint de fundo de pill/tag no tema claro: Gitlab/index.jsx:174, Github/index.jsx:146, SlashCommands/index.jsx:155, SystemPrompts/index.jsx:149, AgentFlows/index.jsx:161 (`light:bg-static-black/10`). (F) Sombra ambiente do campo de prompt: index.css:1454-1474, `.prompt-box`/`:hover`/`:focus-within`, `color-mix(...static-black 3.5%/7.5%...)`, portado do composer do claude.ai. (G) Sombra ambiente de popover: index.css:1476-1482, `.popover-ring`, `color-mix(...static-black 10%...)`. (H) Contraste computado em tooltip de gráfico: Chartable/CustomTooltip.jsx:22-23, função `invertColor` escolhe preto ou branco contra cor de série ARBITRÁRIA. (I) Cromo de scrollbar: index.css:505-522 (`.show-scrollbar`), aplicado a múltiplos containers sem dono único. (J) Sombra bespoke da tela de login: index.css:638 (`.login-input-gradient`).

**Por quê.** Nome é pigmento. É o caso mais extremo do grupo: 88 sites cobrindo pelo menos 7 owners incompatíveis do vocabulário fechado (overlay, button, badge, citation, pill, prompt, popover) mais 3 usos sem dono único no vocabulário (contraste computado, cromo de scrollbar, sombra bespoke de página) — exatamente o padrão que o §2 do GRAMMAR.md descreve para `surface.deep` ('backdrop, tabela e botão' sem papel compartilhado).

**⚠ Precisa QUEBRAR** — serve owners incompatíveis (§5.1):

- `7 nomeáveis + 3 PENDENTES: (1) overlay.backdrop.background-color (KeyboardShortcutsHelp:27, SetupProvider:44, NewFolderModal:35, Directory:330, WorkspaceLLMSelection+8 irmãos, ImageLightbox:59, .backdrop/dialog::backdrop index.css:588)`
- `(2) button.container.color (WorkspaceChat/index.jsx:114)`
- `(3) badge.container.color (AttachItem/index.jsx:97)`
- `(4) citation.icon.color (Citation/index.jsx:93)`
- `(5) pill.container.background-color (Gitlab:174, Github:146, SlashCommands:155, SystemPrompts:149, AgentFlows:161)`
- `(6) prompt.container.box-shadow[.hover/.focus] (.prompt-box, index.css:1454-1474)`
- `(7) popover.container.box-shadow (.popover-ring, index.css:1476-1482). PENDENTE (não migrar sem decisão do dono): contraste computado de gráfico (CustomTooltip.jsx:22-23 — uso legítimo de primitivo, não é role de UI)`
- `cromo de scrollbar (index.css:505-522, sem owner único, o próprio arquivo já trata scrollbar como 'cromo, não conteúdo' no comentário da linha ~960)`
- `sombra bespoke da tela de login (index.css:638, sem owner genérico no vocabulário).`

#### 29. `static-white` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#FFFFFF` · dark `#FFFFFF` |
| **usos** | 176 |
| **propriedades** | text: 58, var(): 9, bg: 51, border: 53, stroke: 3, divide: 2 |
| **nome sugerido** | `N/A — quebrar (ver campo quebra)` |
| **classe** | `N/A — depende do split` |
| **risco** | Rename puro é pixel-idêntico para os 9 itens nomeáveis (mesmo hex #FFFFFF nos 2 temas). Mesmo achado colateral do static-black: (H) e (I) já têm o ramo `light:` correto e só o ramo escuro cru — o fix ideal de longo prazo seria substituir o primitivo pelo MESMO token semântico já usado no claro (cont |

**Onde está aplicado.** 176 usos em 91 arquivos, majoritariamente o par teórico de static-black. Amostra lida e confirmada: (A) Fundo de botão 'confirm' (par de B do static-black): WorkspaceChat/index.jsx:114 (`bg-static-white`); Sidebar/index.jsx:221, botão '+Novo workspace' (`bg-static-white rounded-lg text-sidebar`). (B) Fundo de badge de contagem de anexos (par de C do static-black): AttachItem/index.jsx:97 (`bg-static-white`). (C) Tint de fundo de pill/tag no tema ESCURO (par de E do static-black): SlashCommands/index.jsx:155, SystemPrompts/index.jsx:149, AgentFlows/index.jsx:161 (`bg-static-white/10`). (D) Avatar — fundo de fallback atrás da foto de perfil: UserMenu/AccountModal/index.jsx:115 (`bg-static-white` no `<img>` 48x48 rounded-full). (E) Avatar — borda: AccountModal/index.jsx:103 (`border-2 border-dashed border-static-white light:border-content-disabled`, dropzone de upload de logo) e UserIcon/index.jsx:18 (`border-static-white/40 light:border-theme-sidebar-border`, avatar padrão de workspace) — MESMA anatomia mas par de tema claro DIVERGENTE entre os 2 sites (content-disabled vs theme-sidebar-border), inconsistência a registrar ao dono. (F) Texto de dica de campo: TextToSpeech/PiperTTSOptions/index.jsx:118 (`text-static-white/40`, hint abaixo do select de vozes). (G) Texto de botão ghost em repouso: PiperTTSOptions/index.jsx:126 (`text-static-white/40 hover:text-content-primary`, botão 'flush cache'). (H) Placeholder do textarea principal do chat: PromptInput/index.jsx:365 (`placeholder:text-static-white/60 light:placeholder:text-content-tertiary` — ramo claro já correto, escuro ainda cru). (I) Cor base do texto do histórico de chat: ChatHistory/index.jsx:221 (`text-static-white/80 light:text-theme-text-primary`, container `id="chat-history"` classe `markdown`). (J) Contraste computado em tooltip de gráfico (mesmo caso do static-black): Chartable/CustomTooltip.jsx:22. (K) Cromo de scrollbar (mesmo caso do static-black): index.css:505-528 (`.show-scrollbar` thumb) e :968-979 (`.white-scrollbar`).

**Por quê.** Mesmo raciocínio do static-black (§5.1, §5.2, §2 do GRAMMAR): pelo menos 8 owners incompatíveis confirmados por leitura direta, mais 2 usos sem dono único no vocabulário fechado (contraste computado, cromo de scrollbar).

**⚠ Precisa QUEBRAR** — serve owners incompatíveis (§5.1):

- `8 nomeáveis + PENDENTES: (1) button.container.background-color (WorkspaceChat/index.jsx:114, Sidebar/index.jsx:221)`
- `(2) badge.container.background-color (AttachItem/index.jsx:97)`
- `(3) pill.container.background-color, tema escuro (SlashCommands:155, SystemPrompts:149, AgentFlows:161 — par do item 5 do static-black)`
- `(4) avatar.container.background-color (AccountModal/index.jsx:115)`
- `(5) avatar.container.border-color (AccountModal/index.jsx:103, UserIcon/index.jsx:18 — 2 sites com par de tema claro divergente entre si, registrar)`
- `(6) field.helper.color (PiperTTSOptions/index.jsx:118)`
- `(7) button.container.color.ghost (PiperTTSOptions/index.jsx:126)`
- `(8) prompt.placeholder.color (PromptInput/index.jsx:365)`
- `(9) markdown.container.color (ChatHistory/index.jsx:221). PENDENTE: contraste computado de gráfico (CustomTooltip.jsx:22, mesmo caso do static-black)`
- `cromo de scrollbar (index.css:505-528, 968-979).`

<details><summary>o que a refutação derrubou neste grupo</summary>

- **`ui-brand-pink-lighter`** — ondeEstaAplicado afirma que a tela renderiza 'fora do ThemeProvider' (usado como fato-base para a análise). É falso: src/main.jsx aninha a rota '/login' (que condicionalmente renderiza AzureLoginScreen via src/pages/Login/index.jsx:28) DENTRO do único array de children de <App/> — não existe rota irmã separada para auth. src/App.jsx:27-52 envolve TODO o <Outlet/> (logo toda rota, inclusive /login) em <ThemeProvider>. Adicionalmente, src/hooks/useTheme.js seta data-theme via document.documentElem
  - evidência: `frontend/src/App.jsx:27 (ThemeProvider envolve Outlet); frontend/src/main.jsx (rota /login aninhada nos children de App); frontend/src/pages/Login/index.jsx:28 (return <AzureLoginScreen/> dentro do fluxo Login); frontend/src/hooks/useTheme.`
  - correção: Remover a afirmação 'fora do ThemeProvider' do ondeEstaAplicado. A causa real de a cor parecer invariante é apenas que tokens/color.tokens.json define o MESMO hex para light e dark NESTE token específico (fato de autoria de valor — confirmado pelo próprio dossiê: valorLight===valorDark), não isolame
- **`ui-content-muted-static`** — Dois problemas: (a) mesma premissa falsa 'AuthScene renderiza fora do ThemeProvider', usada aqui como justificativa CENTRAL para criar o owner novo 'sso-button' (ver evidência do item ui-brand-pink-lighter); (b) citação de linha errada — o veredito cita 'SignInButton.jsx:8 (const SPINNER = ...)', mas a linha 8 ATUAL do arquivo é `const TEXT = "var(--color-ui-content-on-dark-static)";`. SPINNER está na linha 9. Diferente dos itens 4/8/9 do mesmo grupo, onde o revisor explicitamente re-verificou e
  - evidência: `frontend/src/pages/Login/Azure/SignInButton.jsx:7 (BG), :8 (TEXT), :9 (SPINNER) — confirmado via leitura direta do arquivo`
  - correção: Corrigir citação para linha 9. Refazer a justificativa do owner novo 'sso-button' sem apoiar-se em 'fora do ThemeProvider' (falso) — resta como razão válida apenas 'este botão não usa o componente Button do design system'. Adicionalmente aplicar §5.4 do GRAMMAR: o indicador (spinner SVG) só existe q
- **`ui-content-on-dark-static`** — Mesma premissa falsa 'fora do ThemeProvider' (ver acima) + citação de linha errada: o veredito cita 'SignInButton.jsx:7 (const TEXT = ...)', mas a linha 7 ATUAL do arquivo é `const BG = "var(--color-ui-surface-panel-static)";`. TEXT está na linha 8.
  - evidência: `frontend/src/pages/Login/Azure/SignInButton.jsx:7 (BG), :8 (TEXT), :9 (SPINNER)`
  - correção: Corrigir citação para linha 8. Mesma correção de premissa do item ui-content-muted-static — remover 'fora do ThemeProvider' da justificativa do owner novo 'sso-button' e sustentar a decisão apenas no argumento de colisão de componente (que continua válido).
- **`ui-link-on-tint`** — Atribui a descrição 'Texto de link sobre tint claro (era #026AA2 x14, invariante)' a tokens/EXCEPTIONS.json. Essa string não existe nesse arquivo — EXCEPTIONS.json só lista o nome bruto da CSS var nas linhas 225-226, sem nenhum campo de descrição. A descrição citada está, na verdade, em tokens/color.tokens.json:4413 e :5536.
  - evidência: `frontend/tokens/EXCEPTIONS.json:225-226 (só '--color-ui-link-on-tint' / '-rgb', sem $description); frontend/tokens/color.tokens.json:4413 e :5536 ($description real, texto idêntico ao citado)`
  - correção: Corrigir a citação do arquivo-fonte para tokens/color.tokens.json. Além disso, o risco declarado ('os outros ~13 usos históricos de #026AA2... precisam de nomeação própria em outro grupo do inventário') não tem consumidor vivo hoje: grep por '#026AA2' cru em src/**/*.{jsx,js,css} = 0 ocorrências; gr

</details>

> **Omitidos pelo agente (8):** `ui-scrollbar-thumb-alt`, `ui-scrollbar-track-deep`, `ui-skeleton-accent`, `ui-skeleton-base`, `ui-status-online-dot`, `ui-status-online-ring`, `ui-surface-deep-alt`, `ui-surface-panel-static`

### 3.3 grupo `02-ui`

> **Refutação:** `CORRIGIR` — 7 confirmados, 3 refutados, 0 omitidos.

#### 30. `ui-accent-lime` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#F4FFD0` · dark `#F4FFD0` |
| **usos** | 2 |
| **propriedades** | bg:1, text:1 |
| **nome sugerido** | `badge.container.background-color.info (bg) + badge.label.color.info (label)` |
| **classe** | `bg-badge-container-background-color-info + text-badge-label-color-info` |
| **risco** | Rename puro, mesmo valor #F4FFD0 nos 2 novos tokens. Não mexe no hack `light:bg-info` já existente no JSX — é debate arquitetural à parte (unificar tema dentro do próprio token), fora do escopo desta tarefa. |

**Onde está aplicado.** Pill 'Default' (skill habilitada por padrão) em src/pages/Admin/Agents/Badges/default.jsx:9 (fundo, rounded-full, 10% opacidade) e :10 (texto do rótulo). O próprio JSX troca para `light:bg-info/15`/`light:text-content-info` no tema claro — este token só pinta em DARK theme; em light a cor real vem de outro token (info).

**Por quê.** `badge` é owner do §4.1 (Dados) — o componente é literalmente `DefaultBadge` na pasta `Badges/`. Um token só, consumido em 2 anatomias do mesmo owner (container=bg, label=text), viola o princípio de 1 papel por token (§5.2 em espírito: propriedade incompatível dentro do mesmo owner precisa de 2 nomes, não 1).

**⚠ Precisa QUEBRAR** — serve owners incompatíveis (§5.1):

- `2 tokens: badge.container.background-color.info (bg-badge-container-background-color-info) e badge.label.color.info (text-badge-label-color-info).`

#### 31. `ui-brand-pink-lighter` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#F77E9D` · dark `#F77E9D` |
| **usos** | 1 |
| **propriedades** | var():1 |
| **nome sugerido** | `owner novo: alert — alert.label.color.destructive` |
| **classe** | `text-alert-label-color-destructive` |
| **risco** | Rename puro, mesmo valor. Owner novo 'alert' precisa aprovação explícita do dono (regra do vocabulário fechado, §4). |

**Onde está aplicado.** Texto do alerta de erro de login (`role="alert"`) na tela Azure SSO, src/pages/Login/Azure/index.jsx:39, cor inline do `<p>` que mostra mensagens como 'Sessão de login expirada'/'Conta suspensa'/'Conta externa não permitida'. Renderiza dentro de `<AuthScene>`, fora do ThemeProvider (mesma tela do SignInButton, itens 5/6/28).

**Por quê.** Nenhum owner do §4.1 cobre um texto `role="alert"` autônomo sem container: não é `banner` (implica barra/caixa com container), não é `toast` (implica notificação flutuante/dispensável). O elemento é só texto colorido. Variant `destructive` do §4.4 encaixa exatamente no papel (mensagem de erro de autenticação).

#### 32. `ui-brand-telegram` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#00ADEC` · dark `#00ADEC` |
| **usos** | 1 |
| **propriedades** | bg:1 |
| **nome sugerido** | `avatar.container.background-color` |
| **classe** | `bg-avatar-container-background-color` |
| **risco** | Rename puro. Alerta de colisão futura: se o app ganhar mais integrações (Slack/Discord) com cor de marca própria, `avatar.container.background-color` sozinho não as distingue — vocabulário fechado não tem variant para 'marca de terceiro X'. Hoje não colide porque só existe esta instância. |

**Onde está aplicado.** Círculo azul (w-9 h-9 rounded-full) atrás do ícone `<Send>` no card 'Connected Bot' da integração Telegram, src/pages/GeneralSettings/Connections/TelegramBot/ConnectedView/ConnectedBotCard/index.jsx:12. Confirmei que Telegram é a ÚNICA integração de bot no app hoje (grep em Connections/ só retorna TelegramBot).

**Por quê.** `avatar` (§4.1, Identidade e feedback) é owner já existente no vocabulário: o círculo representa a identidade do bot conectado, mesmo papel visual de um avatar. Cor de marca de terceiro (Telegram) é invariante nos dois temas; o vocabulário de variantes (§4.4) não tem 'brand', então fica sem variante.

#### 33. `ui-content-faint` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#767676` · dark `#BDBDBE` |
| **usos** | 1 |
| **propriedades** | var():1 |
| **nome sugerido** | `markdown.cell.color` |
| **classe** | `text-markdown-cell-color` |
| **risco** | Rename puro, mesmo valor nos dois temas. |

**Onde está aplicado.** `.markdown table { color: var(--color-ui-content-faint); }` em src/index.css:767 (linha atual — o dossiê tinha 725, arquivo cresceu). Cor base do texto dentro de tabelas renderizadas via markdown no chat; o wrapper `.markdown` é aplicado em src/components/WorkspaceChat/ChatContainer/ChatHistory/index.jsx:221 (histórico principal do chat) e src/components/ChatBubble/index.jsx:22 (widget de chat embedado).

**Por quê.** `markdown` é owner do §4.1 (Conteúdo). Propriedade é `color` sobre texto de tabela; `cell` é a anatomia mais próxima do vocabulário fechado (§4.2 lista header/row/cell para conteúdo tabular).

#### 34. `ui-content-muted-static` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#CBCBCB` · dark `#CBCBCB` |
| **usos** | 1 |
| **propriedades** | var():1 |
| **nome sugerido** | `owner novo: sso-button — sso-button.indicator.color.loading` |
| **classe** | `text-sso-button-indicator-color-loading` |
| **risco** | Rename puro. Owner novo 'sso-button' precisa aprovação; a alternativa (usar owner genérico 'button') criaria 2 contratos reais competindo pelo mesmo path com valores potencialmente diferentes — risco real, não cosmético. |

**Onde está aplicado.** Cor do spinner de loading dentro do botão 'Entrar com Azure', src/pages/Login/Azure/SignInButton.jsx:8 (`const SPINNER = ...`), aplicada via `style={{color: SPINNER}}` no SVG (linha 70) que só renderiza quando `isLoading===true`. Comentário do próprio arquivo (linhas 4-6) documenta que são cores INVARIANTES porque a AuthScene renderiza fora do ThemeProvider.

**Por quê.** Owner `button` colidiria de fato: o app tem/terá `button.*` tema-reativo para botões comuns, e este é INVARIANTE por decisão explícita de código (fora do ThemeProvider, comentário linhas 4-6). `indicator` + estado `loading` (§4.2/§4.5) descrevem exatamente o papel: o spinner só existe durante carregamento.

#### 35. `ui-content-on-dark-static` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#F7F7F7` · dark `#F7F7F7` |
| **usos** | 1 |
| **propriedades** | var():1 |
| **nome sugerido** | `owner novo: sso-button — sso-button.label.color` |
| **classe** | `text-sso-button-label-color` |
| **risco** | Rename puro. Ver risco de colisão de path descrito no item 5. |

**Onde está aplicado.** Cor do texto/label do botão 'Entrar com Azure', src/pages/Login/Azure/SignInButton.jsx:7 (`const TEXT = ...`), aplicada no `<button>` inline style linha 36 (`color: TEXT`). Mesmo componente do item 5.

**Por quê.** Mesma justificativa do item 5: botão invariante fora do ThemeProvider, distinto do Button tema-reativo do app; usar owner genérico colidiria.

#### 36. `ui-divider-faint` — ⏸️ **PENDENTE**

| | |
|---|---|
| **valor** | light `#DDDDDD` · dark `#302F30` |
| **usos** | 1 |
| **propriedades** | var():1 |
| **risco** | Nenhum — token morto, não pinta pixel nenhum hoje. Recomendação: confirmar com o dono se `.g327` e este token podem ser deletados; só nomear se alguém reativar o seletor com um elemento real. |

**Onde está aplicado.** `.g327 { border-color: var(--color-ui-divider-faint); }` em src/index.css:313 (linha atual). Busquei `g327` em todo `src/**/*.{jsx,js}` (`grep -rln`) — a classe NÃO aparece em nenhum componente. CSS morto, sem elemento consumidor.

**Por quê.** §5.1 exige owner do CONTEXTO RENDERIZADO; não há contexto renderizado (zero consumidor real confirmado por grep). O nome da classe (`.g327`) não carrega informação semântica alguma (parece gerado/hash). Marcar owner por palpite seria o H-020 (classificação fake) que o GRAMMAR proíbe explicitamente.

#### 37. `ui-divider-strong` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#DDDDDD` · dark `#393D43` |
| **usos** | 1 |
| **propriedades** | var():1 |
| **nome sugerido** | `chart.container.background-color` |
| **classe** | `bg-chart-container-background-color` |
| **risco** | Rename puro, mesmo valor por tema. |

**Onde está aplicado.** `backgroundColor` passado para `useGenerateImage` (lib `recharts-to-png`) em src/components/WorkspaceChat/ChatContainer/ChatHistory/Chartable/index.jsx:87 — é o fundo de PREENCHIMENTO do PNG/JPEG exportado quando o usuário clica em 'Download' num gráfico do chat (botão `DownloadGraph`, definido a partir da linha 654). NÃO é nenhum divisor visual na tela; é o backdrop da imagem gerada para download.

**Por quê.** Nome atual promete um divisor (linha/borda) e o uso real é fundo de exportação de imagem de gráfico — exatamente o anti-padrão do §2 do GRAMMAR (nome mente sobre o contexto renderizado). `chart` é owner do §4.1 (Dados); anatomia `container` porque não há parte distinguível para este papel de 'fundo do canvas exportado'.

#### 38. `ui-dnd-overlay` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#C2E7FE` · dark `#C2E7FE` |
| **usos** | 1 |
| **propriedades** | bg:1 |
| **nome sugerido** | `overlay.backdrop.background-color` |
| **classe** | `bg-overlay-backdrop-background-color` |
| **risco** | Rename puro no tema light. Nota à parte: hoje o dark usa um token DIFERENTE (`content-primary`) no mesmo elemento — inconsistência arquitetural pré-existente (2 tokens para 1 papel, dividido por tema via `light:`), fora do escopo desta tarefa de naming. |

**Onde está aplicado.** Overlay tela-cheia mostrado ao arrastar um arquivo sobre a janela de chat, src/components/WorkspaceChat/ChatContainer/DnDWrapper/index.jsx:442 (linha atual — dossiê tinha 392, arquivo cresceu) — `hidden={!dragging}`, classe `light:bg-ui-dnd-overlay/90` (o tema dark usa outro token, `bg-content-primary/90`, na mesma classe).

**Por quê.** Combinação EXATA do exemplo canônico do próprio GRAMMAR (§1): `overlay.backdrop.background-color`. `overlay` é owner de sobreposição (§4.1), `backdrop` é anatomia explícita (§4.2) para camada de fundo dim/overlay de drag-and-drop.

#### 39. `ui-icon-brand-fill` — ⏸️ **PENDENTE**

| | |
|---|---|
| **valor** | light `#008EFF` · dark `#008EFF` |
| **usos** | 1 |
| **propriedades** | var():1 |
| **risco** | Nenhum — token morto. Recomendação: confirmar remoção do seletor `.grid-loader` (provável resíduo de um spinner removido, ex. react-spinners GridLoader) e do token junto. |

**Onde está aplicado.** `.grid-loader > circle { fill: var(--color-ui-icon-brand-fill); }` em src/index.css:571 (linha atual). Busquei `grid-loader`, `GridLoader` e a dependência `react-spinners` em todo o repositório e no `package.json` — ZERO resultados em `.jsx`/`.js` e a dependência não existe. CSS morto.

**Por quê.** Mesma razão do item 7: sem consumidor real, §5.1 não tem contexto renderizado para determinar owner.

#### 40. `ui-legacy-accent` — ⏸️ **PENDENTE**

| | |
|---|---|
| **valor** | light `#DDDDDD` · dark `#363A47` |
| **usos** | 13 |
| **propriedades** | var():13 (todos em tailwind.config.js) |
| **risco** | Não é rename simples em nenhuma das 3 frentes: (1) e (3) podem exigir DELETAR código, não renomear; (2) exige decisão de vocabulário (adicionar propriedade de gradiente) antes de nomear. |

**Onde está aplicado.** Consumido só em tailwind.config.js: chave legada `accent:` (linha 40) e 10 utilitários `backgroundImage` em gradiente (linhas 174-191: preference-gradient, chat-msg-user-gradient, main-gradient, modal-gradient, sidebar-gradient, login-gradient, menu-item-gradient, menu-item-selected-gradient, workspace-item-gradient, workspace-item-selected-gradient, switch-selected). Investiguei CADA utilitário resultante no JSX real: (a) `hover:bg-accent` — 8 arquivos idênticos do fluxo CommunityHub/ImportItem sobre o componente compartilhado CTAButton (que já define `hover:bg-primary/90` como default em src/components/lib/CTAButton/index.jsx). Exemplo lido: src/pages/GeneralSettings/CommunityHub/ImportItem/Steps/Completed/index.jsx:40. Há 30 usos de `<CTAButton>` no repo; SÓ estes 8 (mesmo fluxo) sobrescrevem o hover — os outros 22 (ex. GeneralSettings/ApiKeys/index.jsx) usam o hover padrão. (b) `bg-preference-gradient` — único gradiente com consumidor real: src/components/LLMSelection/LLMProviderOption/index.jsx:20, `<label>` do card de seleção de provedor de LLM. (c) Os outros 9 gradientes (main/modal/sidebar/login/menu-item/menu-item-selected/workspace-item/workspace-item-selected/chat-msg-user) — busquei cada um via `grep -rln` em `.jsx` e NENHUM tem consumidor. CSS/config morto.

**Por quê.** Três bloqueios reais, cada um exige decisão do dono: (1) o hover do CTAButton no CommunityHub DIVERGE do hover padrão do MESMO componente usado em 22 outros lugares — não dá para saber, só pela leitura estática, se é override intencional (precisaria de variant fora das 7 do §4.4, nenhuma significa 'hover cinza neutro sobre botão primary') ou debt de migração a remover. Nomear como `primary.hover` colidiria com o valor real de `hover:bg-primary/90`, que já É o default do mesmo componente/owner/anatomia/propriedade. (2) `bg-preference-gradient` é um GRADIENTE (background-image); o vocabulário de propriedades do §4.3 só tem background-color/color/border-color/outline-color/box-shadow/fill/stroke — não existe categoria para stop de gradiente. (3) 9 dos 11 usos em tailwind.config.js são utilitários sem consumidor JSX (grep vazio).

**⚠ Precisa QUEBRAR** — serve owners incompatíveis (§5.1):

- `Pelo menos 2 contratos reais + 1 bloco morto: (1) button.container.background-color.?.hover no CTAButton do CommunityHub (variante incerta)`
- `(2) card.container.background-image em LLMProviderOption (propriedade fora do vocabulário fechado)`
- `(3) 9 utilitários de gradiente sem consumidor confirmado — candidatos a remoção.`

#### 41. `ui-legacy-darker` — ⏸️ **PENDENTE**

| | |
|---|---|
| **valor** | light `#2A2C32` · dark `#F1F1F1` |
| **usos** | 1 |
| **propriedades** | var():1 |
| **risco** | Nenhum — token morto. Candidato a remoção junto com a chave `darker` do tailwind.config.js. |

**Onde está aplicado.** Chave legada `darker:` em tailwind.config.js:61. Busquei `bg-darker`/`text-darker`/`border-darker` (word-boundary, para não confundir com a classe DIFERENTE `bg-grey-darker` de outra escala de cor, usada em src/pages/WorkspaceSettings/ChatSettings/ChatModeSelection/index.jsx) em todo `src/**/*.jsx` — ZERO ocorrências. CSS/config morto.

**Por quê.** Sem consumidor real (verificado com grep de word-boundary específico para não confundir com `grey-darker`, token diferente). §5.1 sem contexto renderizado.

#### 42. `ui-legacy-error` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#DC2626` · dark `#DC2626` |
| **usos** | 1 |
| **propriedades** | var():1 |
| **nome sugerido** | `button.container.background-color.destructive.hover + attachment.icon.background-color.destructive` |
| **classe** | `bg-button-container-background-color-destructive-hover + bg-attachment-icon-background-color-destructive` |
| **risco** | Rename puro nos dois, mesmo valor. Repetição em FileUploadProgress confirma que attachment.icon.background-color.destructive é padrão recorrente, não acidente isolado. |

**Onde está aplicado.** Chave legada `error:` em tailwind.config.js:59, consumida via `bg-error`/`hover:bg-error` em 2 owners reais dentro de src/components/WorkspaceChat/ChatContainer/PromptInput/Attachments/index.jsx: (a) botão circular 'remover anexo' — `hover:bg-error` nas linhas 93, 129, 164, 200 (ícone `<X>` que aparece no hover do card de anexo); (b) fundo do badge de ícone quando o anexo FALHOU ao processar — `bg-error` na linha 99, dentro do bloco `status==="failed"`, atrás do ícone `<AlertOctagon>`. Também usado no mesmo padrão em src/components/Modals/ManageWorkspace/Documents/UploadFile/FileUploadProgress/index.jsx:83,108.

**Por quê.** `error` (nome cru de paleta) tem VALOR corretamente destructive-semântico, mas serve 2 owners incompatíveis (botão interativo vs. badge de ícone estático) — mesmo padrão do H-021 do GRAMMAR. `button` e `attachment` são owners do §4.1; `destructive` é variant do §4.4 (encaixe direto para os dois: ação de remover e estado de falha).

**⚠ Precisa QUEBRAR** — serve owners incompatíveis (§5.1):

- `2 tokens: button.container.background-color.destructive.hover (botão X remover anexo) e attachment.icon.background-color.destructive (badge do ícone de anexo com falha).`

#### 43. `ui-legacy-highlight` — ⏸️ **PENDENTE**

| | |
|---|---|
| **valor** | light `#F1F1F1` · dark `#191C23` |
| **usos** | 1 |
| **propriedades** | var():1 |
| **risco** | Nenhum — token morto. Candidato a remoção. |

**Onde está aplicado.** Chave legada `"dark-highlight":` em tailwind.config.js:51. Busquei `dark-highlight` em `src/**/*.jsx` — ZERO ocorrências. CSS/config morto.

**Por quê.** Sem consumidor real. §5.1 sem contexto renderizado.

#### 44. `ui-legacy-purple` — ⏸️ **PENDENTE**

| | |
|---|---|
| **valor** | light `#8A38F5` · dark `#8A38F5` |
| **usos** | 1 |
| **propriedades** | var():1 |
| **risco** | Não é rename simples — decisão do dono necessária: (a) estender §4.4 com variantes de tipo-de-conteúdo, (b) aceitar o token como índice de paleta sem variante semântica (fora do vocabulário fechado atual), ou (c) tratar como paleta separada, fora do sistema DTCG de papéis. |

**Onde está aplicado.** Chave legada `purple:` em tailwind.config.js:56, consumida via `bg-purple` em src/components/WorkspaceChat/ChatContainer/PromptInput/Attachments/index.jsx:237, dentro de `displayFromFile()` (linhas 228-255): mapa de cor de ÍCONE por EXTENSÃO de arquivo anexado no chat — `.html` → roxo (`FileCode`). No mesmo switch: pdf→magenta, doc/docx→royalblue, csv/xlsx→success(verde), json/sql/js/jsx/cpp/c→warn (item 16), png/jpg/jpeg→royalblue, default→royalblue.

**Por quê.** Owner é claramente `attachment` (§4.1), anatomia `icon` (§4.2), propriedade `background-color` (§4.3) — isso não é ambíguo. O que é genuinamente ambíguo é a VARIANTE: isto é uma paleta CATEGÓRICA por tipo de arquivo (pdf/doc/html/code/imagem), e o vocabulário fechado de variantes (§4.4: primary/secondary/ghost/destructive/success/warning/info) não tem categoria para 'arquivo HTML'. Forçar em qualquer uma das 7 variantes mentiria sobre o significado.

#### 45. `ui-legacy-warn` — ⏸️ **PENDENTE**

| | |
|---|---|
| **valor** | light `#C18E13` · dark `#C18E13` |
| **usos** | 1 |
| **propriedades** | var():1 |
| **risco** | Mesma decisão pendente do item 15 — `purple` e `warn` fazem parte do MESMO mapa categórico e deveriam ser decididos juntos. |

**Onde está aplicado.** Chave legada `warn:` em tailwind.config.js:60, consumida via `bg-warn` em src/components/WorkspaceChat/ChatContainer/PromptInput/Attachments/index.jsx:247, mesma função `displayFromFile()` do item 15 — cobre extensões `.json/.sql/.js/.jsx/.cpp/.c` (arquivos de código/dados) com o ícone `FileCode`.

**Por quê.** Mesma razão do item 15: owner=attachment/icon/background-color é certo, mas a variante 'warning' do §4.4 SIGNIFICARIA severidade/aviso — e aqui não há aviso nenhum, é só a cor atribuída a arquivos de código na paleta categórica por extensão. Usar `warning` mentiria sobre o papel (mesmo anti-padrão que o GRAMMAR proíbe para surface/semantic).

#### 46. `ui-legacy-x-button` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#5C5C5C` · dark `#9EA4B7` |
| **usos** | 2 |
| **propriedades** | var():2 (dossiê) — downstream real: chave tailwind.config + 9 sites de hover + 1 site direto em SVG |
| **nome sugerido** | `search.suffix.color.hover (dominante, 9 sites) + logo.container.fill (gradiente onboarding, 1 site)` |
| **classe** | `text-search-suffix-color-hover + fill-logo-container-fill` |
| **risco** | Rename puro no caso (1) — 9 sites idênticos confirmam padrão real, não acidente. Caso (2) é nomeável mas fraco: o valor sozinho não expressa o gradiente completo (mesma lacuna do item 11). |

**Onde está aplicado.** Consumido em 2 frentes com owners incompatíveis: (a) chave legada `"x-button":` em tailwind.config.js:54 → utilitário `hover:text-x-button`, usado em 9 arquivos, todos no MESMO padrão: ícone `<X>` de 'limpar busca' dentro do campo de busca de listas de seleção (provedor de LLM, embedding, TTS/STT, vector DB, web search). Exemplo lido: src/pages/WorkspaceSettings/ChatSettings/WorkspaceLLMSelection/index.jsx:120 `<X size={20} className="cursor-pointer text-theme-text-primary hover:text-x-button" onClick={handleXButton}/>`, logo após `<input name="llm-search">` (linha 106). Outros 8 sites: AgentLLMSelection, EmbeddingPreference, LLMPreference, TranscriptionPreference, AudioPreference/tts, AudioPreference/stt, VectorDatabase, WebSearchSelection — mesmo trecho. (b) Uso DIRETO (sem passar pelo tailwind.config) em src/pages/OnboardingFlow/Steps/Home/components/OnboardingLogoSVG.jsx:74 — `<stop stopColor="var(--color-ui-legacy-x-button)">` no meio de um gradiente SVG de 3 paradas (as outras 2 são hex cru #3C5769/#40435E) que preenche a ilustração decorativa de fundo do onboarding. Nada a ver com botão de fechar/limpar.

**Por quê.** Clássico H-021: mesmo valor, 2 owners sem relação nenhuma (controle de busca vs. ilustração decorativa). `search` é owner do §4.1 (Controles); `suffix` é anatomia explícita do §4.2 para o ícone no fim do campo; estado `hover` com par default real (`text-theme-text-primary`, presente na mesma classe). Para a ilustração: `logo` já é owner do §4.1 (Casca e navegação) — não é owner novo — e `fill` é propriedade válida do §4.3; porém o token representa só 1 de 3 paradas de um gradiente, mesma lacuna de vocabulário de gradiente do item 11.

**⚠ Precisa QUEBRAR** — serve owners incompatíveis (§5.1):

- `2 tokens: search.suffix.color.hover (9 sites) e logo.container.fill (1 stop de gradiente).`

#### 47. `ui-link-on-tint` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#026AA2` · dark `#026AA2` |
| **usos** | 1 |
| **propriedades** | border:1 |
| **nome sugerido** | `list-row.divider.border-color` |
| **classe** | `border-list-row-divider-border-color` |
| **risco** | Rename puro NESTE site. Atenção: os outros ~13 usos históricos de #026AA2 (cor de link de fato) não estão neste dossiê — se compartilham a mesma var CSS hoje, criar este 2º nome apontando pro mesmo valor é seguro; mas eles precisam de nomeação própria (provavelmente `<owner>.label.color` para texto  |

**Onde está aplicado.** `light:border-ui-link-on-tint/10` em src/pages/GeneralSettings/CommunityHub/ImportItem/index.jsx:35 — borda inferior (divisor) entre os itens da lista de etapas do wizard de importação (`SideBarSelection`, linhas 8-69), aplicada só quando NÃO é o último item. O tokens/EXCEPTIONS.json descreve o valor como 'Texto de link sobre tint claro (era #026AA2 x14, invariante)' — ou seja, a maioria histórica dos usos (14 ocorrências de hex cru) era cor de TEXTO de link; este dossiê só dá visibilidade a esta ÚNICA ocorrência, que é uma BORDA.

**Por quê.** Exemplo direto da regra §5.2 (propriedade incompatível é owner errado), aqui invertido: um alias de LINK/TEXTO está pintando BORDA. `list-row` é owner do §4.1 (Dados), `divider` é anatomia explícita do §4.2 para esta borda separadora entre itens de lista.

#### 48. `ui-loader-accent` — ⏸️ **PENDENTE**

| | |
|---|---|
| **valor** | light `#2563EB` · dark `#5FA4FA` |
| **usos** | 1 |
| **propriedades** | var():1 |
| **risco** | Nenhum risco visual em remover — candidato a DELEÇÃO da linha `color: var(--color-ui-loader-accent);` em vez de rename. |

**Onde está aplicado.** `color: var(--color-ui-loader-accent);` em src/index.css:420, dentro da regra `.dot-falling` (indicador de 3 pontos 'IA está digitando', renderizado em src/components/WorkspaceChat/ChatContainer/ChatHistory/PromptReply/index.jsx:23 `<div className="mt-3 ml-1 dot-falling light:invert">`). Li a regra completa (linhas 413-497): `.dot-falling` não tem texto/conteúdo (div vazia), e nenhuma declaração na cadeia (`.dot-falling`, `::before`, `::after`, `@keyframes dot-falling*`) referencia `currentColor` — confirmei com `grep -n currentColor src/index.css` (só aparece na linha 1623, contexto não relacionado). A propriedade `color` desta regra não pinta pixel algum.

**Por quê.** Owner até seria óbvio pelo contexto (chat-message/indicador de digitação), mas §5.1 pede owner do CONTEXTO RENDERIZADO — e o efeito renderizado aqui é ZERO (propriedade morta/vestigial, sem currentColor em nenhum descendente ou pseudo-elemento). Nomear implicaria endossar uma declaração CSS sem efeito.

#### 49. `ui-loader-dot` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#5C5C5C` · dark `#EEEEEE` |
| **usos** | 9 |
| **propriedades** | var():9 |
| **nome sugerido** | `chat-message.indicator.background-color + chat-message.indicator.box-shadow` |
| **classe** | `bg-chat-message-indicator-background-color (box-shadow não tem utilitário Tailwind útil aqui — consumo real já é var() direto em CSS)` |
| **risco** | Rename puro nos 7 sites reais (mesmo valor). Para as 2 declarações mortas, a ação correta é DELETAR, não nomear. |

**Onde está aplicado.** Cor dos 3 pontos do indicador 'IA está digitando' (mesmo `.dot-falling` do item 19, src/components/WorkspaceChat/ChatContainer/ChatHistory/PromptReply/index.jsx:23). Dos 9 usos em src/index.css, 7 são REAIS (pintam pixel): background-color do ponto principal (linha 419) e dos pseudo-elementos ::before/::after (linhas 438, 448); box-shadow que desenha os 2 pontos 'eco' via truque de sombra deslocada, na regra base (linha 421) e nos 3 @keyframes (dot-falling linha 462, dot-falling-before linha 478, dot-falling-after linha 494). Os outros 2 usos (linhas 439 e 449, propriedade `color` nos pseudo-elementos) são VESTIGIAIS pela mesma razão do item 19 (sem conteúdo textual, sem currentColor na cadeia).

**Por quê.** `chat-message` é owner do §4.1 (Conteúdo) — o indicador vive na área de histórico do chat, representando a resposta do assistente em andamento. `indicator` é anatomia explícita do §4.2; `background-color` e `box-shadow` são propriedades distintas do §4.3, cada uma com 3-4 sites reais.

**⚠ Precisa QUEBRAR** — serve owners incompatíveis (§5.1):

- `2 tokens reais: chat-message.indicator.background-color (3 sites) e chat-message.indicator.box-shadow (4 sites)`
- `os 2 usos de `color` nos pseudo-elementos são mortos e não precisam de nome.`

#### 50. `ui-scrollbar-thumb-alt` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#AAAAAA` · dark `#CCCCCC` |
| **usos** | 1 |
| **propriedades** | var():1 |
| **nome sugerido** | `owner novo: scrollbar — scrollbar.thumb.background-color.hover` |
| **classe** | `bg-scrollbar-thumb-background-color-hover` |
| **risco** | Rename puro, mesmo valor. Owner novo 'scrollbar' precisa aprovação do dono. |

**Onde está aplicado.** `.white-scrollbar::-webkit-scrollbar-thumb:hover { background-color: ... }` em src/index.css:985 — cor do polegar da scrollbar customizada NO HOVER. `.white-scrollbar` é aplicada em pelo menos 10 componentes (confirmado via grep): dropdowns de seleção de LLM/embedding/TTS/STT/vector-db/web-search (ex.: src/pages/WorkspaceSettings/ChatSettings/WorkspaceLLMSelection/index.jsx:124) e no visualizador de código do card de tool-call (src/pages/GeneralSettings/ScheduledJobs/components/ToolCallCard.jsx:93,97,134,138, combinado com `.tool-call-scrollbar`, ver itens 23/24).

**Por quê.** Não existe owner no §4.1 para 'barra de rolagem' — é um elemento de chrome reutilizado por pelo menos 10 owners de conteúdo diferentes, não pertence a nenhum deles especificamente. `thumb` é anatomia explícita do §4.2 (parece pensada exatamente para isto). Par default existe (`.white-scrollbar::-webkit-scrollbar-thumb` usa `content-tertiary`, token diferente, mas satisfaz o espírito do §5.4).

#### 51. `ui-scrollbar-track-deep` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#F7F7F7` · dark `#18181B` |
| **usos** | 4 |
| **propriedades** | var():4 |
| **nome sugerido** | `scrollbar.track.background-color (3 sites) — o 4º site (borda do thumb) reaproveita o MESMO token por design` |
| **classe** | `bg-scrollbar-track-background-color` |
| **risco** | Rename puro nos 4 sites, mesmo valor. Se o dono preferir um nome PRÓPRIO para o 4º site (scrollbar.thumb.border-color), também é válido — decisão estética de granularidade. |

**Onde está aplicado.** Trilho da scrollbar customizada `.white-scrollbar` (mesmo contexto do item 21): `scrollbar-color` (Firefox, linha 963), `::-webkit-scrollbar` background (linha 970), `::-webkit-scrollbar-track` background (linha 974) — estes 3 são o TRILHO propriamente dito. O 4º uso (linha 981) é `border: 2px solid var(--color-ui-scrollbar-track-deep)` no `::-webkit-scrollbar-thumb` — a borda do polegar usa a cor do trilho deliberadamente, criando efeito de 'respiro'/padding em volta do polegar.

**Por quê.** Mesmo owner novo do item 21 ('scrollbar'), anatomia `track` (§4.2, explícita). O uso como borda do thumb (4º site) é reaproveitamento intencional de valor (efeito de padding), não propriedade incompatível — documentado aqui, não precisa de nome próprio.

#### 52. `ui-skeleton-accent` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#94A3B8` · dark `#94A3B8` |
| **usos** | 1 |
| **propriedades** | var():1 |
| **nome sugerido** | `code-block.thumb.background-color.hover` |
| **classe** | `bg-code-block-thumb-background-color-hover` |
| **risco** | Rename puro, mesmo valor nos 2 temas (invariante). |

**Onde está aplicado.** `[data-theme="light"] .tool-call-scrollbar::-webkit-scrollbar-thumb:hover { background-color: ... }` em src/index.css:1015. Comentário do próprio CSS (linhas 988-989): '.tool-call-scrollbar — Scoped to the scheduled jobs tool call card — the default white-scrollbar is tuned for dark surfaces and looks harsh over light backgrounds.' Consumida em src/pages/GeneralSettings/ScheduledJobs/components/ToolCallCard.jsx:93,97,134,138 — visualizador de payload JSON/log de execução de job agendado (`<pre>`/hljs), sem nenhuma relação com loading-skeleton (shimmer de carregamento).

**Por quê.** Nome atual ('skeleton') é H-021 clássico: promete um esqueleto de loading e na verdade é o polegar de scrollbar de um bloco de código/log. `code-block` já é owner do §4.1 (Conteúdo) — encaixe direto, sem colidir com o owner novo 'scrollbar' dos itens 21/22 porque este é um SKIN diferente, escopado só ao tema claro dentro de um `<pre>`.

#### 53. `ui-skeleton-base` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#CBD5E1` · dark `#CBD5E1` |
| **usos** | 2 |
| **propriedades** | var():2 |
| **nome sugerido** | `code-block.thumb.background-color` |
| **classe** | `bg-code-block-thumb-background-color` |
| **risco** | Rename puro, mesmo valor nos 2 temas. |

**Onde está aplicado.** Mesmo contexto do item 23 — `[data-theme="light"] .tool-call-scrollbar` — usada como `scrollbar-color` (Firefox, linha 995, define o polegar; o trilho junto é `transparent`) e `::-webkit-scrollbar-thumb` background-color (linha 1009), o estado DEFAULT (não-hover) do mesmo polegar do item 23.

**Por quê.** Mesma razão do item 23: par DEFAULT do hover já classificado. `code-block.thumb.background-color` sem sufixo de estado, conforme §4.5 ('estado omitido = default').

#### 54. `ui-status-online-dot` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#6CE9A6` · dark `#6CE9A6` |
| **usos** | 1 |
| **propriedades** | bg:1 |
| **nome sugerido** | `progress.indicator.background-color.checked` |
| **classe** | `bg-progress-indicator-background-color-checked` |
| **risco** | Rename puro, mesmo valor nos 2 temas (invariante). |

**Onde está aplicado.** Ponto interno do indicador de etapa CONCLUÍDA no wizard de importação do Community Hub, src/pages/GeneralSettings/CommunityHub/ImportItem/index.jsx:53 — `<div className="w-[5.6px] h-[5.6px] rounded-full bg-ui-status-online-dot">`, dentro do anel do item 26, só renderizado quando `isDone===true` (linha 51). Nada a ver com presença/status online de usuário — é indicador de progresso de etapa (`SideBarSelection`, linhas 8-69).

**Por quê.** Nome mente sobre o contexto (H-021: 'online' não existe aqui, é conclusão de etapa). `progress` é owner do §4.1 (Dados) — encaixe direto para stepper/wizard. Estado `checked` (§4.5) é preciso: o par default (etapa não concluída) existe no mesmo componente (linhas 56-60), usando outro token (`theme-text-primary`) — satisfaz o espírito do §5.4 mesmo não estando neste dossiê.

#### 55. `ui-status-online-ring` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#32D583` · dark `#32D583` |
| **usos** | 1 |
| **propriedades** | border:1 |
| **nome sugerido** | `progress.indicator.border-color.checked` |
| **classe** | `border-progress-indicator-border-color-checked` |
| **risco** | Rename puro, mesmo valor nos 2 temas. |

**Onde está aplicado.** Anel externo do MESMO indicador do item 25, src/pages/GeneralSettings/CommunityHub/ImportItem/index.jsx:52 — `<div className="w-[14px] h-[14px] rounded-full border border-ui-status-online-ring ...">`.

**Por quê.** Mesma razão do item 25 — par border-color/background-color do mesmo indicator, mesmo owner/estado.

#### 56. `ui-surface-deep-alt` — ⏸️ **PENDENTE**

| | |
|---|---|
| **valor** | light `#EEEEEE` · dark `#242424` |
| **usos** | 1 |
| **propriedades** | var():1 |
| **risco** | Nenhum risco visual hoje. Recomendação: confirmar com o dono se existe uma tela de loading que deveria consumir `--theme-loader` e não está consumindo (bug de integração), ou se é seguro remover a variável e este token. |

**Onde está aplicado.** `[data-theme="light"] { --theme-loader: var(--color-ui-surface-deep-alt); }` em src/index.css:138 (o dark theme define `--theme-loader: var(--color-static-white)` na linha 29). Busquei `theme-loader` em `src/**/*.{jsx,js,css}`, `tailwind.config.js` e `tokens/` — a variável `--theme-loader` NUNCA é lida (nem `var(--theme-loader)` em CSS, nem classe Tailwind em JSX). Está rastreada em `tokens/theme-baseline.json` e `tokens/theme-map.json` (token conhecido do inventário), mas sem consumidor de render.

**Por quê.** Owner até seria sugerido pelo nome da variável intermediária ('loader', provavelmente fundo de tela de carregamento), mas §5.1 exige contexto RENDERIZADO — `--theme-loader` é variável morta (definida, rastreada, mas zero leitura real). Nomear seria adivinhar o owner sem prova.

#### 57. `ui-surface-panel-static` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#21252B` · dark `#21252B` |
| **usos** | 1 |
| **propriedades** | var():1 |
| **nome sugerido** | `owner novo: sso-button — sso-button.container.background-color` |
| **classe** | `bg-sso-button-container-background-color` |
| **risco** | Rename puro. Ver risco de colisão descrito no item 5 se o owner genérico 'button' for usado em vez do owner novo. |

**Onde está aplicado.** Fundo do botão 'Entrar com Azure', src/pages/Login/Azure/SignInButton.jsx:6 (`const BG = ...`), aplicado no `<button>` inline style linha 34 (`backgroundColor: BG`). Mesmo componente/comentário INVARIANTE dos itens 5 e 6 (fora do ThemeProvider).

**Por quê.** Mesma justificativa dos itens 5/6 — trio completo do MESMO botão (container/label/indicator), owner novo 'sso-button' evita colisão com o Button tema-reativo do app.

<details><summary>o que a refutação derrubou neste grupo</summary>

- **`grey-dark`** — Citação de linha desatualizada em 1 dos 9 sites: LLMPreference/index.jsx foi citado como :636 (mesma linha errada que já vinha do dossiê original), mas no arquivo atual do working tree o className 'border-grey-dark' está na linha 643 (offset de 7 linhas). Os outros 8 sites (WorkspaceLLMSelection:101, AgentLLMSelection:144, EmbeddingPreference:336, TranscriptionPreference:164, stt.jsx:166, tts.jsx:158, VectorDatabase:268, WebSearchSelection:230) conferem exatamente.
  - evidência: `src/pages/GeneralSettings/LLMPreference/index.jsx:643 (não :636) — className idêntico aos outros 8: 'flex items-center sticky top-0 z-internal border-grey-dark mx-4 bg-theme-settings-input-bg'`
  - correção: Corrigir a citação para :643. O conteúdo é real e idêntico aos 8 irmãos — não muda o veredito INADEQUADO nem o nomeSugerido select.header.border-color, só a exatidão da evidência (§8 do CLAUDE.md exige a linha-fonte exata).
- **`static-black`** — 6 das citações path:linha do campo ondeEstaAplicado estão desatualizadas em relação ao HEAD atual (repo tem dezenas de .jsx modificados sem commit — confirmado via `git status`), embora o conteúdo citado exista de fato, só em linha diferente: Citation/index.jsx citado :93 → real :104 (offset 11); AttachItem/index.jsx citado :97 → real :109 (offset 12); Sidebar/index.jsx citado :221 → real :224 (offset 3); WorkspaceChat/index.jsx citado :114 → real :115 (offset 1); ImageLightbox/index.jsx citado 
  - evidência: `src/components/WorkspaceChat/ChatContainer/ChatHistory/Citation/index.jsx:104 (<Icon className="text-static-black" />, não :93); src/components/WorkspaceChat/ChatContainer/PromptInput/AttachItem/index.jsx:109 (badge bg-static-white text-sta`
  - correção: Re-grep cada path:linha citado contra o working tree atual (não contra o dossiê nem contra HEAD commitado) antes de fechar o achado. O conteúdo é real em todos os 6 casos — owner/anatomia/propriedade (citation.icon.color, badge.container.color, button.container.color, overlay.backdrop.background-col
- **`static-white`** — Mesma deriva do ImageLightbox reaparece nesta entrada (arquivo compartilhado com static-black): citado :65, :79, :90, :106 → real :69, :83, :94, :110 (offset consistente de +4 linhas no arquivo inteiro).
  - evidência: `src/components/ImageLightbox/index.jsx:69,83,94,110 — hover:text-static-white/70 + bg-static-white/10 (3 botões de navegação) e text-static-white/70 (legenda), não nas linhas 65/79/90/106 citadas`
  - correção: Corrigir as 4 citações para 69/83/94/110. Conteúdo confirmado real; button.container.color.ghost e demais splits não mudam de owner/propriedade, só a linha citada precisa de ajuste.

</details>

### 3.4 grupo `01-surface`

> **Refutação:** `CORRIGIR` — 15 confirmados, 4 refutados, 6 omitidos.

#### 58. `surface-canvas` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#F9F9F7` · dark `#17191C` |
| **usos** | 23 |
| **propriedades** | var(): 8 (pontes --theme-bg-primary/--theme-bg-chat em src/index.css:30,39 + aliases tailwind.config.js black-900/sidebar/dark-input:39,42,49); bg: 15 (classe Tailwind direta em JSX) |
| **nome sugerido** | `page.container.background-color` |
| **classe** | `bg-page-container-background-color` |
| **risco** | Rename é pixel-idêntico se cada site migrar para o token do seu próprio owner mantendo o hex atual. Risco real: os 3 aliases tailwind.config.js (black-900/sidebar/dark-input) e a pill de UsersSection ficam amarrados ao mesmo primitivo hoje — no dia que 'fundo de página' precisar de um tom diferente  |

**Onde está aplicado.** Owners incompatíveis confirmados lendo o código: (1) fundo da PÁGINA inteira — src/pages/DesignSystem/index.tsx:464 `<div className="min-h-screen bg-surface-canvas text-content-primary">`; (2) trilho de PROGRESS BAR — DesignSystem/index.tsx:266 `<div className="h-2 overflow-hidden rounded-full bg-surface-canvas">` com filho `bg-primary` como preenchimento (é literalmente o exemplo 'toggle/progress' citado no próprio GRAMMAR.md §2); (3) chip/pill de metadado — DesignSystem/index.tsx:129,132 `<span className="rounded-full bg-surface-canvas px-2 py-0.5 ...">{KIND_LABEL/classification}</span>`; (4) bloco de código — DesignSystem/index.tsx:62 `<code>` e :92 `<pre>`, e parts.tsx:255 `TokenChip` (`<span className="... border border-border-subtle bg-surface-canvas ...">`); (5) card de tool-call numa run trace — GeneralSettings/ScheduledJobs/components/ToolCallCard.jsx:51 `bg-surface-canvas/30` (container) e :97 `bg-surface-canvas/50` (bloco de texto/código do resultado); (6) pill de código pendente numa linha de usuários — GeneralSettings/Connections/TelegramBot/.../UsersSection/index.jsx:110 `<div className="bg-surface-canvas light:bg-surface-hover h-[26px] w-[60px] ...">{code}</div>`. Além disso tailwind.config.js:39,42,49 dá 3 nomes Tailwind DIFERENTES (`black-900`, `sidebar`, `dark-input`) para o mesmo valor.

**Por quê.** Viola o nome banido `surface` (§2). O próprio GRAMMAR.md cita textualmente ESTE token como exemplo do achado H-021 ('surface.canvas como trilho de progresso' / 'como toggle desligado'); confirmei em código real que ele pinta page, progress-track, pill/badge, code-block e card — 5 owners do vocabulário fechado, incompatíveis entre si por §5.1 (owner vem do contexto renderizado, não do valor).

**⚠ Precisa QUEBRAR** — serve owners incompatíveis (§5.1):

- `page.container.background-color (DesignSystem/index.tsx:464)`
- `progress.track.background-color (DesignSystem/index.tsx:266)`
- `pill.container.background-color (DesignSystem/index.tsx:129,132, parts.tsx:255)`
- `card.container.background-color (ToolCallCard.jsx:51)`
- `code-block.container.background-color (DesignSystem/index.tsx:62,92`
- `ToolCallCard.jsx:97)`

#### 59. `surface-deep` — ⏸️ **PENDENTE**

| | |
|---|---|
| **valor** | light `#F7F7F7` · dark `#0C0F14` |
| **usos** | 1 |
| **propriedades** | var(): 1 (mas o token real tem 2 pontos de consumo em index.css sob temas/estados distintos, contados como 1 'site' no dossiê) |
| **risco** | Sem risco de pixel imediato (nenhuma ação de rename recomendada até a decisão do dono); risco de deixar como está é acumular um 3º consumo futuro sem dono nenhum. |

**Onde está aplicado.** Dois consumidores em src/index.css, nenhum owner claro: (1) `.fade-up-border` (index.css:398-406, ramo `@media (prefers-color-scheme: dark)`) — gradiente decorativo de 'fade' aplicado como `background: linear-gradient(...)`. Confirmado por grep (`grep -rn fade-up`) que esta classe NUNCA é aplicada em nenhum JSX/TSX do repo — é CSS morto. (2) `.show-scrollbar` (index.css:510-513, só no tema `[data-theme="light"]`) — `scrollbar-color: ... rgb(var(--color-surface-deep-rgb) / 0.3)`, o 2º parâmetro (cor do TRACK do scrollbar nativo). `.show-scrollbar` é aplicado em ChatHistory/index.jsx:221 e DefaultChat/index.jsx:112 (áreas de scroll do chat).

**Por quê.** Ambíguo de verdade (§5.5), não chute: 1 dos 2 sites é código morto (sem contexto renderizado pra derivar owner nenhum) e o outro (scrollbar-color track) não tem owner no vocabulário fechado §4.1 (não existe `scrollbar`) nem propriedade correspondente em §4.3 (`scrollbar-color` não é `background-color`/`color`/`border-color`/etc). Batizar isso exigiria ou uma decisão de owner novo do dono, ou remover o `.fade-up-border` morto primeiro.

#### 60. `surface-destructive-tint` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#F6DFDF` · dark `#3A2226` |
| **usos** | 30 |
| **propriedades** | var(): 4 (pontes --theme-attachment-error-bg / --theme-button-delete-hover-bg, index.css:107,121,212,226); bg: 26 (quase sempre como `hover:bg-surface-destructive-tint`) |
| **nome sugerido** | `button.container.background-color.destructive.hover` |
| **classe** | `hover:bg-button-container-background-color-destructive-hover` |
| **risco** | Pixel-idêntico nos dois grupos — só nome muda. |

**Onde está aplicado.** Dominante: fundo de HOVER de botões de ação destrutiva/negativa — Button/index.jsx:73 (variante `destructiveSoft` do componente Button canônico), RunDetailPage.jsx:228 (botão 'parar job'), ChatRow/index.jsx:55 (botão deletar chat), RunRow.jsx:63 (deletar run), ApiKeyRow/index.jsx:64, DeviceRow/index.jsx:62,76 (revogar/negar dispositivo), UserRow/index.jsx (deletar usuário), ExperimentalFeatures/index.jsx:292, ThreadContainer/index.jsx:235 (`DeleteAllThreadButton`, um `<button>` de fato), ThreadItem/index.jsx:259 (deletar thread), EditPresetModal.jsx:135 (deletar preset), e no editor de fluxo (Admin/AgentBuilder): ApiCallNode/index.jsx:157,240, StartNode/index.jsx:87, BlockList/index.jsx:322 — todos `<button>` de deletar nó/edge. Exceção real: WorkspaceFileRow/index.jsx:188 `<div className="bg-theme-settings-input-active group-hover:bg-surface-destructive-tint rounded-3xl ...">` é um PILL/badge de 'Pinned/Unpin' (não um botão), confirmado lendo o componente (linhas 176-204: div clicável com `<p>Pinned/Unpin</p>` dentro, não um elemento `<button>`).

**Por quê.** Nome banido `surface`. 29 dos 30 sites são coerentemente `button` (hover destrutivo), mas WorkspaceFileRow é um `pill`/badge — owner incompatível por contexto renderizado (§5.1), então exige quebra, mesmo a repetição sendo forte evidência (§5.3) de que o grosso é `button`.

**⚠ Precisa QUEBRAR** — serve owners incompatíveis (§5.1):

- `button.container.background-color.destructive.hover (29 sites: Button.jsx, RunDetailPage, RunRow, ChatRow, ApiKeyRow, DeviceRow, UserRow, ExperimentalFeatures, ThreadContainer, ThreadItem, EditPresetModal, ApiCallNode, StartNode, BlockList)`
- `pill.container.background-color.destructive.hover (WorkspaceFileRow/index.jsx:188)`

#### 61. `surface-elevated` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#FCFCFB` · dark `#21252B` |
| **usos** | 55 |
| **propriedades** | var(): 4 (pontes --theme-home-bg-card / --theme-home-update-card-bg, index.css:76,85,182,191); bg: 51 |
| **nome sugerido** | `popover.container.background-color` |
| **classe** | `bg-popover-container-background-color` |
| **risco** | Pixel-idêntico por grupo (mesmo hex hoje); risco de manutenção alto — é o token com mais usos de todo o dossiê depois de surface-hover, e hoje 1 mudança de valor afeta popover, select, field, botão e modal ao mesmo tempo. |

**Onde está aplicado.** 5 owners incompatíveis confirmados lendo o código: (1) POPOVER/menu flutuante — UserMenu/UserButton/index.jsx:78 `<div ref={menuRef} className="popover-ring w-fit rounded-lg absolute top-12 right-0 bg-surface-elevated p-1 z-popover">` (o `z-popover` no próprio className confirma o owner), mesmo padrão em WorkspaceModelPicker/index.jsx:133, TextSizeMenu/index.jsx:67, ToolsMenu/index.jsx:143, SlashCommandRow/index.jsx:75; (2) SELECT nativo — LLMSelector/RouterPickerSelection/index.jsx:27,49 e ChatModelSelection/index.jsx:24,42, ambos literalmente `<select className="bg-surface-elevated ...">`; (3) FIELD (input/textarea) — ChatHistory/ClarifyingQuestion/ChoiceForm.jsx:87 e InputForm.jsx:2, `<input className="... bg-surface-elevated ...">`; (4) BUTTON (indicador interno) — PromptInput/StopGenerationButton/index.jsx:21 `<div className="w-3.5 h-3.5 rounded-checkbox bg-surface-elevated" />` dentro do `<button>` (o ponto/indicador de 'stop', não o botão em si); (5) MODAL — ChatHistory/Citation/index.jsx:191, MemoriesSidebar/MemoryModal/index.jsx:45, SourcesSidebar/MobileCitationModal/index.jsx:21.

**Por quê.** Nome banido `surface`. Owners confirmados por leitura direta: popover, select, field, button (indicator) e modal — 5 categorias do vocabulário fechado usando o MESMO hex por coincidência, exatamente o padrão que §5.1 proíbe de tratar como um contrato só.

**⚠ Precisa QUEBRAR** — serve owners incompatíveis (§5.1):

- `popover.container.background-color (UserButton, WorkspaceModelPicker, TextSizeMenu, ToolsMenu, SlashCommandRow)`
- `select.container.background-color (RouterPickerSelection, ChatModelSelection)`
- `field.container.background-color (ChoiceForm, InputForm)`
- `button.indicator.background-color (StopGenerationButton)`
- `modal.container.background-color (Citation, MemoryModal, MobileCitationModal)`

#### 62. `surface-emphasis` — ⏸️ **PENDENTE**

| | |
|---|---|
| **valor** | light `#E4E4E4` · dark `#27272A` |
| **usos** | 2 |
| **propriedades** | var(): 2 (1 inline style + 1 alias morto em tailwind.config.js:43) |
| **risco** | Nenhum rename recomendado agora; o alias morto (`historical-msg-system`) é candidato a remoção por si só, fora do escopo de naming. |

**Onde está aplicado.** Único uso vivo: HistoricalMessage/index.jsx:276, dentro de `TruncatableContent` (função definida na linha 245) — é a cor terminal de um gradiente `linear-gradient(180deg, ... 0%, ... 65%, var(--color-surface-emphasis) 100%)` aplicado como `style` inline num `<div className="absolute bottom-0 ...">`, só no ramo SEM `light:` (ou seja, tema escuro) de uma mensagem de chat truncada — o efeito visual de 'esmaecer o texto perto do fim, indicando que há mais conteúdo'. O ramo `light` equivalente (linha 283, `hidden light:block`) usa um token DIFERENTE (`--color-grey-lighter`), não este. Segundo consumidor: tailwind.config.js:43 `"historical-msg-system": "var(--color-surface-emphasis)"` — confirmado MORTO por grep (`historical-msg-system` não aparece em nenhum className de src/**/*.jsx).

**Por quê.** Ambíguo de verdade. O único uso real é uma cor terminal de gradiente decorativo (fade de truncamento) só no tema escuro — nenhuma anatomia do §4.2 nomeia isso com precisão ('backdrop' já tem sentido reservado pra camada por trás de overlay/modal; usá-la aqui seria emprestar errado). Além disso o mesmo efeito visual usa um token DIFERENTE no tema claro, quebrando a hipótese de 'mesmo papel nos dois temas'. Marcar um owner/anatomia aqui seria palpite, não classificação (§5.5).

#### 63. `surface-hover` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#EDECE8` · dark `#2E3238` |
| **usos** | 337 |
| **propriedades** | bg: 337 (sempre como `hover:bg-surface-hover`, nenhum var() direto) |
| **nome sugerido** | `button.container.background-color.hover` |
| **classe** | `hover:bg-button-container-background-color-hover` |
| **risco** | Pixel-idêntico por grupo hoje. Maior risco de escopo de todo o dossiê (337 sites/171 arquivos) — qualquer migração precisa ser sequencial por owner, nunca em lote (LEI ZERO §6 do projeto). |

**Onde está aplicado.** O token mais espalhado do grupo (171 arquivos). Owners incompatíveis confirmados por leitura direta: (1) BUTTON — pages/404.jsx:20 (`<NavLink>` 'voltar pra home'), components/SettingsButton/index.jsx:18,32 (botões de ícone no rodapé), components/Footer/index.jsx:58,71,84,113 (mesmo padrão de ícone), components/ImageLightbox/index.jsx:65,79,90 (botões de navegação do lightbox), components/ErrorBoundaryFallback/index.jsx:56,80,87; (2) THREAD-ITEM — Sidebar/ActiveWorkspaces/ThreadContainer/ThreadItem/index.jsx:251 (linha de thread na sidebar); (3) MENU (item de popover/slash-command) — PromptInput/ToolsMenu/.../SlashCommandRow/index.jsx:79,90, PromptInput/ToolsMenu/index.jsx:192; (4) LIST-ROW/busca — Sidebar/SearchBox/index.jsx:234,259 (resultado de busca). Owners adicionais listados no dossiê mas não abertos individualmente (LemonadeOptions, WorkspaceDirectory, ManageWorkspace, ScheduledJobs/JobRow, EmbedChats, MemoryModal etc.) seguem o mesmo padrão de hover genérico por owner.

**Por quê.** Nome banido `surface`, e é o caso mais extremo de owners incompatíveis do dossiê: confirmei em código real button, thread-item, menu e list-row usando o MESMO hex só porque hoje é conveniente ter 1 classe Tailwind de hover global. É exatamente o padrão que a lei condena em §5.1/§5.3 — repetição massiva é evidência de que vale auditar, não prova de papel único.

**⚠ Precisa QUEBRAR** — serve owners incompatíveis (§5.1):

- `button.container.background-color.hover (404.jsx, SettingsButton, Footer, ImageLightbox, ErrorBoundaryFallback — maioria dos 337 sites)`
- `thread-item.container.background-color.hover (ThreadItem/index.jsx:251)`
- `menu.container.background-color.hover (SlashCommandRow, ToolsMenu)`
- `list-row.container.background-color.hover (SearchBox)`
- `NOTA: quebra completa exige auditoria arquivo-a-arquivo dos 171 arquivos — recomendo a mesma metodologia já aplicada (e documentada) em tokens/inventory/decisions-surface-sunken.json para o token irmão surface-sunken.`

#### 64. `surface-info-tint` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#DEE8FC` · dark `#1F2A3D` |
| **usos** | 1 |
| **propriedades** | bg: 1 |
| **nome sugerido** | `progress.indicator.background-color.info` |
| **classe** | `bg-progress-indicator-background-color-info` |
| **risco** | Pixel-idêntico, rename puro — 1 único site. |

**Onde está aplicado.** Único site, confirmado por leitura direta: Modals/ManageWorkspace/Documents/WorkspaceDirectory/index.jsx:596 — `<div className="h-full bg-surface-info-tint rounded-full transition-all duration-surface" style={{ width: `${pct}%` }} />` dentro do trilho `<div className="w-20 h-[1.5px] bg-static-white/10 light:bg-info/10 rounded-full overflow-hidden">` (linha 594) — é o preenchimento (indicator) de uma barra de progresso de EMBEDDING de documento, cujo trilho irmão já usa `bg-info` (confirma variante info).

**Por quê.** Nome banido `surface`, mas owner único e sem ambiguidade: contexto renderizado é claramente `progress` (barra de progresso de embedding), anatomia `indicator` (o preenchimento, não o trilho), variante `info` (consistente com o trilho irmão `bg-info/10`).

#### 65. `surface-inset-inverse` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#F7F7F7` · dark `#FFFFFF` |
| **usos** | 4 |
| **propriedades** | bg: 4 |
| **nome sugerido** | `button.container.background-color.primary` |
| **classe** | `bg-button-container-background-color-primary` |
| **risco** | Pixel-idêntico. Risco de nomenclatura: 'primary' no vocabulário fechado colide semanticamente com o que o app já chama de variant="confirm" no componente Button — dono precisa decidir se aceita a perda de nuance ou justifica owner/variante nova. |

**Onde está aplicado.** 3 de 4 sites são BUTTON: PromptInput/index.jsx:506 (`SendPromptButton`, fundo do botão de enviar quando habilitado — `cursor-pointer bg-surface-inset-inverse hover:bg-surface-hover ...`), PromptInput/LLMSelector/index.jsx:191 (botão 'Salvar' do seletor de modelo), PromptInput/StopGenerationButton/index.jsx:18 (botão externo de 'parar geração', `w-8 h-8 bg-surface-inset-inverse hover:opacity-80`). O 4º site é diferente: ChatHistory/Citation/index.jsx:85 — `<div className="... bg-surface-inset-inverse rounded-full ...">` é o círculo de FALLBACK do favicon/ícone de uma citação (quando não há `customImage`), não um botão.

**Por quê.** Nome banido `surface`. 3 sites coerentemente `button` (ação afirmativa: enviar, salvar, parar) e 1 `citation` (ícone de fallback) — owners incompatíveis, exige quebra. Nota de vocabulário: o componente Button/index.jsx já documenta esse arquétipo como variant="confirm" (branco nos dois temas), mas `confirm` NÃO está no vocabulário fechado §4.4 (só primary/secondary/ghost/destructive/success/warning/info) — `primary` é o mapeamento mais próximo, com perda de nuance que o dono precisa validar.

**⚠ Precisa QUEBRAR** — serve owners incompatíveis (§5.1):

- `button.container.background-color.primary (PromptInput SendPromptButton:506, LLMSelector Save:191, StopGenerationButton:18)`
- `citation.icon.background-color (Citation/index.jsx:85, círculo de fallback do favicon)`

#### 66. `surface-panel` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#FCFCFB` · dark `#21252B` |
| **usos** | 57 |
| **propriedades** | var(): 13 (ponte --theme-bg-secondary, index.css:31,127 + aliases mortos/vivos em tailwind.config.js: sidebar-button, secondary, mobile-onboarding); bg: 44 |
| **nome sugerido** | `card.container.background-color` |
| **classe** | `bg-card-container-background-color` |
| **risco** | Pixel-idêntico por grupo. Ponto de atenção pro dono: o grupo 'button.container.background-color.primary' desta quebra e o `surface-inset-inverse` do token #8 (também mapeado como `button.container.background-color.primary`) têm valores DIFERENTES (#FCFCFB/#21252B vs #F7F7F7/#FFFFFF) — se os dois vão |

**Onde está aplicado.** 3 owners incompatíveis confirmados: (1) CARD/painel de documentação — DesignSystem/index.tsx:59 `<details className="group rounded-lg border border-border-subtle bg-surface-panel">` e :122 `<article ... bg-surface-panel">` (SpecCard); (2) CODE-BLOCK — CommunityHub/.../HubItem/SystemPrompt.jsx:77 `<p className="... font-mono bg-surface-panel light:bg-surface-hover px-2 py-1 rounded-md text-sm ...">{item.prompt}</p>` (mesmo padrão em SlashCommand.jsx e AgentSkill.jsx), e GeneralSettings/Chats/ChatRow/index.jsx (bloco de texto da resposta); (3) BUTTON, só no tema claro — OnboardingFlow/Steps/Home/index.jsx:49 `className="... bg-button-container-background-color hover:bg-surface-hover ... light:bg-surface-panel hover:light:bg-surface-hover ..."` (botão 'Get Started') e ScheduledJobs/JobFormModal/FormActions.jsx:18 `className="... bg-button-container-background-color light:bg-surface-panel hover:bg-surface-hover ..."` (botão de submit) — em AMBOS o token já migrado `bg-button-container-background-color` cobre o tema escuro e `surface-panel` cobre só o CLARO do MESMO botão.

**Por quê.** Nome banido `surface`. Contextos renderizados confirmados: card/painel genérico, bloco de código/prompt, e override de tema claro de um botão já parcialmente migrado — 3 owners incompatíveis por §5.1.

**⚠ Precisa QUEBRAR** — serve owners incompatíveis (§5.1):

- `card.container.background-color (DesignSystem/index.tsx:59,122)`
- `code-block.container.background-color (SystemPrompt.jsx:77, SlashCommand.jsx, AgentSkill.jsx, ChatRow)`
- `button.container.background-color.primary (valor CLARO de Home/index.jsx:49 e FormActions.jsx:18, RunDetailPage.jsx:241, ScheduledJobs/index.jsx:122,188, RunHistoryPage.jsx:100)`

#### 67. `surface-raised` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#FFFFFF` · dark `#282C32` |
| **usos** | 1 |
| **propriedades** | var(): 1 (consumido via prop JS `arrowColor`, não classe Tailwind) |
| **nome sugerido** | `tooltip.caret.background-color` |
| **classe** | `bg-tooltip-caret-background-color` |
| **risco** | Rename é pixel-idêntico. Nota separada (não é problema de naming): o valor da seta (#282C32 no escuro) NÃO bate com o valor do corpo do tooltip (`--color-popover-bg` = #21252B no escuro) — pequena inconsistência visual pré-existente que a troca de nome vai expor mas não resolve. |

**Onde está aplicado.** Único site: PromptInput/ReasoningEffort/index.jsx:219 — `arrowColor={theme === "light" ? "var(--color-popover-border)" : "var(--color-surface-raised)"}` passado pro componente `<Tooltip>` (react-tooltip) cujo corpo usa `bg-popover-bg!` (linha 221). É a cor da SETA/caret do tooltip, só no tema escuro.

**Por quê.** Nome banido `surface`, mas owner sem ambiguidade: `tooltip` é owner do vocabulário fechado (§4.1, categoria 'Sobreposição'), e `caret` é anatomia do vocabulário fechado (§4.2) — encaixe perfeito e único.

#### 68. `surface-selected` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#E5E4E0` · dark `#3A3E44` |
| **usos** | 14 |
| **propriedades** | bg: 8, border: 6 |
| **nome sugerido** | `button.container.background-color` |
| **classe** | `bg-button-container-background-color` |
| **risco** | Pixel-idêntico por grupo. O 3º grupo (hover disfarçado) é o de maior risco de confusão futura se não for corrigido junto com a quebra do token #6. |

**Onde está aplicado.** 3 owners/estados incompatíveis confirmados: (1) BUTTON, tema claro — Documents/Directory/index.jsx:289 (botão 'mover para workspace'), :298 (botão 'mover para pasta'), :314 (botão 'deletar'), mesmo padrão em WorkspaceDirectory/index.jsx:277,289 — barra de ações flutuante quando há itens marcados, fundo `light:bg-surface-selected` pareado com `bg-static-white` no escuro; (2) RADIO (cartão de opção marcada), como BORDA — OnboardingFlow/Steps/Survey/index.jsx:173 `border-surface-selected` num `<label>` que envolve um `<input type="radio" className="hidden">` (confirmado lendo linhas 170-189); mesmo padrão exato em NewEmbedModal/index.jsx:199 e Admin/Invitations/NewInviteModal/index.jsx:190 (`WorkspaceOption`, `<button>` envolvendo `<input type="radio">`); (3) USO INDEVIDO como hover puro — WorkspaceSettings/GeneralAppearance/SuggestedChatMessages/index.jsx:149 `hover:bg-surface-selected` num `<button>` de sugestão de mensagem — aqui não há estado de seleção nenhum, é feedback de `:hover` disfarçado de 'selected'.

**Por quê.** Nome banido `surface`. Além disso, o nome atual promete 'selected' mas 1 dos 3 usos reais é HOVER puro (SuggestedChatMessages) — viola §5.2 (o nome descreve um estado que o contexto renderizado não confirma) e §5.4 (não há par 'default' de seleção ali, é só hover). Os outros dois grupos (button toolbar / radio de escolha) são owners incompatíveis entre si.

**⚠ Precisa QUEBRAR** — serve owners incompatíveis (§5.1):

- `button.container.background-color (barra de ações Directory/WorkspaceDirectory, tema claro)`
- `radio.container.border-color.checked (Survey, NewEmbedModal, NewInviteModal)`
- `button.container.background-color.hover (SuggestedChatMessages:149 — recomendo migrar para o mesmo destino da quebra do token #6 surface-hover, já que semanticamente é o mesmo papel)`

#### 69. `surface-selected-foreground` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#F7F7F7` · dark `#21252B` |
| **usos** | 8 |
| **propriedades** | text: 8 |
| **nome sugerido** | `button.label.color` |
| **classe** | `text-button-label-color` |
| **risco** | Pixel-idêntico. Se o dono quiser rigor total de anatomia, split em `button.label.color` + `button.icon.color` (mesmo valor hoje, só reforça a distinção) — não bloqueante porque o owner é o mesmo. |

**Onde está aplicado.** Sempre pareado com o token #11 (`surface-selected`) na MESMA barra de ações flutuante: Documents/Directory/index.jsx:289 (texto do botão 'mover para workspace'), :298 (botão 'mover para pasta'), :300 `<MoveToFolderIcon className="text-dark-text text-surface-selected-foreground group-hover:text-content-primary" />` (cor do ÍCONE, não texto), :314 (botão deletar); mesmo padrão em WorkspaceDirectory/index.jsx:277,289. Confirmado lendo o componente: 5 dos 8 sites pintam texto de `<button>`, 3 pintam o SVG do ícone dentro do mesmo botão.

**Por quê.** Nome banido `surface`. Owner único e coerente (`button`, sempre a mesma barra de ações), mas a anatomia mistura `label` (texto) e `icon` (SVG) sob o MESMO nome — o vocabulário fechado (§4.2) distingue as duas.

#### 70. `surface-success-tint` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#DDEBE4` · dark `#1C2F26` |
| **usos** | 5 |
| **propriedades** | var(): 4 (2 pontes mortas: --theme-checklist-item-completed-bg e --theme-checklist-checkbox-text); bg: 1 (site vivo) |
| **nome sugerido** | `button.container.background-color.success.hover` |
| **classe** | `hover:bg-button-container-background-color-success-hover` |
| **risco** | Pixel-idêntico no site vivo. Recomendo remover as 2 --theme-* mortas (checklist-item-completed-bg, checklist-checkbox-text) na mesma leva — housekeeping fora do escopo estrito de naming. |

**Onde está aplicado.** Único site VIVO, confirmado por leitura: MobileConnections/DeviceRow/index.jsx:70 — `<button onClick={handleApprove} className="... hover:bg-surface-success-tint light:hover:text-content-primary hover:text-content-primary">{t('mobile.devices.approve')}</button>` (botão 'Aprovar dispositivo', par direto do botão 'Negar' que usa `surface-destructive-tint` na linha seguinte). Os outros 4 sites (index.css:92,95,198,201 — `--theme-checklist-item-completed-bg` e `--theme-checklist-checkbox-text`) são CSS custom properties confirmadas MORTAS por grep (`checklist-item-completed`/`checklist-checkbox-text` não aparecem em nenhum className/style de src/**/*.jsx).

**Por quê.** Nome banido `surface`. Owner único e sem ambiguidade no único site vivo: `button` (ação de aprovar, hover, variante success — coerente com o par 'negar'=destructive na mesma linha).

#### 71. `surface-sunken` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#F7F7F7` · dark `#2A2C32` |
| **usos** | 22 |
| **propriedades** | var(): 22 (100% pontes CSS em src/index.css — zero classe `bg-surface-sunken` direta em JSX hoje) |
| **nome sugerido** | `field.container.background-color` |
| **classe** | `bg-field-container-background-color` |
| **risco** | Pixel-idêntico por grupo se mantiver o hex atual. Risco real, já provado pela migração irmã: settings-input, file-row e attachment hoje têm o MESMO valor só por coincidência histórica. |

**Onde está aplicado.** Todos os 22 sites são a ponte legada `--theme-*: var(--color-surface-sunken)` em src/index.css, alimentando 9 nomes `--theme-*` distintos que representam owners diferentes: FIELD — `--theme-settings-input-bg` (index.css:64), `--theme-settings-input-active` (:66), `--theme-settings-input-text` (:67); LIST-ROW — `--theme-file-row-odd` (:82); BUTTON — `--theme-home-bg-button` (:90), `--theme-home-button-secondary` (:94), `--theme-sidebar-footer-icon` (:57); CARD/checklist — `--theme-checklist-item-bg` (:102); ATTACHMENT — `--theme-attachment-bg` (:119), `--theme-attachment-success-bg` (:121), `--theme-attachment-icon-spinner-bg` (:126) (blocos repetidos no tema `[data-theme=light]`, linhas 155-218). IMPORTANTE: o consumo DIRETO de `bg-surface-sunken` em componentes JÁ foi migrado — ver tokens/inventory/decisions-surface-sunken.json, que documenta ~30 sites reclassificados por owner real (card.surface, badge.container.background-color, etc.); o que sobra hoje é só essa ponte interna ainda presa ao primitivo condenado.

**Por quê.** Nome banido `surface`. 4 owners incompatíveis nas 9 pontes que restam (field, list-row, button, attachment). O próprio color.tokens.json (linha 5723) já documenta esse EXATO diagnóstico pra camada de componente irmã ('os 85 alias para semantic.*.surface.* foram desatados — o meio nomeava posição num eixo z, não papel, e amarrava owners sem relação') — esta ponte em index.css é o resto que não seguiu a mesma migração.

**⚠ Precisa QUEBRAR** — serve owners incompatíveis (§5.1):

- `field.container.background-color (settings-input-bg/active/text, index.css:64,66,67)`
- `list-row.container.background-color (file-row-odd, :82)`
- `button.container.background-color.secondary (home-bg-button/home-button-secondary/sidebar-footer-icon, :90,94,57)`
- `attachment.container.background-color (attachment-bg/success-bg/icon-spinner-bg, :119,121,126)`

#### 72. `surface-warning-tint` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#FEF0DA` · dark `#3A3226` |
| **usos** | 3 |
| **propriedades** | var(): 2 (ponte --theme-button-disable-hover-bg, index.css:119[bloco root],224[bloco light] — nota: linha 119 é compartilhada na leitura com attachment-bg do token #14 na numeração do arquivo, confirmar por grep local); bg: 1 |
| **nome sugerido** | `button.container.background-color.warning.hover` |
| **classe** | `hover:bg-button-container-background-color-warning-hover` |
| **risco** | Pixel-idêntico, rename puro. |

**Onde está aplicado.** Dois owners, ambos `button`: (1) Admin/Users/UserRow/index.jsx:84 — `<button onClick={handleSuspend} className="... hover:bg-surface-warning-tint">{suspended ? 'Unsuspend' : 'Suspend'}</button>` (botão suspender/reativar usuário, hover); (2) ChatEmbedWidgets/EmbedConfigs/EmbedRow/index.jsx:105 — `hover:bg-theme-button-disable-hover-bg`, cuja ponte em index.css resolve pra `var(--color-surface-warning-tint)` (botão 'desabilitar' embed, hover).

**Por quê.** Nome banido `surface`. Owner único e sem ambiguidade nos 2 sites: `button`, ação de tipo 'aviso/pausa' (suspender, desabilitar — não destrutivo, não afirmativo), hover.

<details><summary>o que a refutação derrubou neste grupo</summary>

- **`card-container-background-color (owner DBEngine, SQLConnectionModal.jsx:528-529)`** — Inconsistência metodológica: reclassifica DBEngine de owner 'card' para owner NOVO 'button' só porque é clicável e tem estado selecionado/ativo (bg-primary!). Mas o token #13/#14 (ChoiceForm OptionButton/OtherRow) é EXATAMENTE o mesmo padrão — `<button type="button" aria-pressed={selected}>` clicável com fundo trocando conforme estado — e ali o veredito manteve owner 'list-row' com variante de ESTADO `.selected`, sem trocar de owner. O §4.5 já lista 'active' e 'selected' como ESTADOS válidos par
  - evidência: `src/pages/Admin/Agents/SQLConnectorSelection/SQLConnectionModal.jsx:526-533 (função DBEngine, prop `active`) vs src/components/WorkspaceChat/ChatContainer/ChatHistory/ClarifyingQuestion/ChoiceForm.jsx:6-15 (OptionButton, `<button type="butt`
  - correção: Manter owner 'card' para os 14 usos (inclusive DBEngine) e tratar o estado ativo como `card.container.background-color.active` (variante de ESTADO, não owner novo) — paralelo exato ao que já foi feito em list-row.container.background-color.selected para o ChoiceForm. Se a intenção for mesmo introduz
- **`list-row-container-background-color-active (ToolsMenu popover: SlashCommandRow/SkillSection/SkillRow)`** — A escolha do owner 'menu' (em vez de 'popover') é apresentada como fato provado, mas a única evidência citada é o NOME de um token irmão pré-existente (`bg-menu-row-background-color-selected` em TabButton). Isso é usar convenção de nome já no código como prova — o próprio §5.1 exige que o owner venha do CONTEXTO RENDERIZADO, e o contexto renderizado do container (variável `popoverRef`, classe `popover-ring`, `z-popover`) aponta para owner 'popover', não 'menu'. O veredito não reconhece essa tens
  - evidência: `src/components/WorkspaceChat/ChatContainer/PromptInput/ToolsMenu/index.jsx:62 (`const popoverRef = useRef(null)`), :144 (`className="fixed inset-0 z-popover"`), :156 (`className="popover-ring absolute ... z-dropdown bg-surface-elevated ..."`
  - correção: Marcar PENDENTE entre `popover.row.background-color.active` e `menu.row.background-color.active` com o motivo explícito da tensão (nome do componente vs. nomenclatura interna renderizada), em vez de afirmar 'menu' como resolvido — ou, se optar por 'menu', declarar explicitamente que está herdando o 
- **`primary (cluster B — field.container.outline-color.primary.focus)`** — Propriedade errada. `focus:ring-primary` no Tailwind gera `box-shadow` (mecanismo `--tw-ring-color` + `box-shadow`), não a propriedade CSS `outline-color`. O próprio código distingue os dois mecanismos: `focus:outline-primary-button` (outline real) aparece em SQLConnectionModal.jsx:121, separado de `focus:ring-primary` (ring/box-shadow) em SingleUserAuth/MultiUserAuth. O vocabulário §4.3 já tem `box-shadow` como propriedade própria — usar 'outline-color' para uma classe `ring-*` é exatamente o t
  - evidência: `src/components/Modals/Password/SingleUserAuth.jsx:97 e MultiUserAuth.jsx:58,74,140,153,317,329 (`focus:ring-primary`, mecanismo box-shadow do Tailwind) vs src/pages/Admin/Agents/SQLConnectorSelection/SQLConnectionModal.jsx:121 (`focus:outli`
  - correção: `field.container.box-shadow.primary.focus` (classe `focus:ring-field-primary` ou equivalente), não `field.container.outline-color.primary.focus`.
- **`primary (cluster A — ParsedFilesMenu/index.jsx)`** — Citação de linha incorreta. O veredito cita `ParsedFilesMenu/index.jsx:145` para `hover:bg-primary`, mas a linha 145 real é `disabled={isEmbedding}` — não contém o token. O uso real está na linha 151. Esse é o mesmo número stale do dossiê bruto (que a própria peça corrigiu em outros 8+ sites deste mesmo token, como UserItems:30, HubItems:75, generic.jsx:16, PublishEntityModal:210/216/204 etc. — mostrando que a verificação linha-a-linha foi feita para a maioria dos sites, mas não para este).
  - evidência: `src/components/WorkspaceChat/ChatContainer/PromptInput/AttachItem/ParsedFilesMenu/index.jsx:145 (`disabled={isEmbedding}`) vs :151 (`className="...bg-primary-button hover:bg-primary text-content-inverse..."`) — classe real está 6 linhas aba`
  - correção: Corrigir citação para `ParsedFilesMenu/index.jsx:151`.

</details>

> **Omitidos pelo agente (6):** `primary-foreground`, `progress-indicator-background-color`, `progress-track-background-color`, `scrollbar-thumb`, `scrollbar-thumb-hover`, `scrollbar-track`

### 3.5 grupo `03-content-border`

> **Refutação:** `CORRIGIR` — 10 confirmados, 3 refutados, 2 omitidos.

#### 73. `border-default` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#BEBEBE` · dark `#606060` |
| **usos** | 66 |
| **propriedades** | var() 17, border 47, ring 1, divide 1 |
| **nome sugerido** | `sidebar.container.border-color (amostra — ver quebra para os demais)` |
| **classe** | `border-sidebar-container-border-color` |
| **risco** | Pixel-idêntico — todos os sites apontam para a mesma var() de tema hoje; a quebra só troca o identificador, não o valor. Risco real é de acoplamento futuro (mudar a borda só do modal hoje arrasta sidebar/field/checkbox). |

**Onde está aplicado.** Owner muito diverso: borda do painel lateral via --theme-sidebar-border (src/index.css:53,169); borda do input de chat via --theme-chat-input-border (index.css:61,175); borda do modal via --theme-modal-border (index.css:68,182); borda de inputs de perfil username/password/bio em src/components/UserMenu/AccountModal/index.jsx:151,174,193; DIVISOR vertical (border-r) do painel de seleção de LLM em src/components/WorkspaceChat/ChatContainer/PromptInput/LLMSelector/LLMSelector/index.jsx:13; borda do checkbox/botão da checklist via --theme-checklist-checkbox-border/--theme-checklist-button-border (index.css:110-111).

**Por quê.** 'border' não é owner nem anatomia do §4 — mesmo padrão de 'surface' banido no §2 (conceito de intensidade de borda, não quem renderiza). Réplica exata do exemplo do GRAMMAR (surface.deep em backdrop+tabela+botão): aqui aparece em sidebar (container), field (AccountModal/chat-input), modal (container), select (divisor do LLMSelector) e checkbox (checklist) — 5+ owners reais e incompatíveis do §4.1.

**⚠ Precisa QUEBRAR** — serve owners incompatíveis (§5.1):

- `sidebar.container.border-color (index.css:53) · field.container.border-color (AccountModal inputs + chat-input) · modal.container.border-color (index.css:68) · select.divider.border-color (LLMSelector/LLMSelector/index.jsx:13) · checkbox.container.border-color (checklist, index.css:110) · button.container.border-color (home-button-secondary, index.css:103-104)`

#### 74. `border-faint` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#E8E8E8` · dark `#4F555E` |
| **usos** | 2 |
| **propriedades** | var() 2 |
| **nome sugerido** | `chart.divider.stroke (grade) — anatomia é o melhor encaixe disponível, não perfeito` |
| **classe** | `consumido via var() inline em prop JS do Recharts, não via classe Tailwind` |
| **risco** | Pixel-idêntico agora (mesmo hex nos dois). Sem a quebra, mudar a cor da grade arrasta a cor do destaque de cursor e vice-versa. |

**Onde está aplicado.** Só 2 sites, ambos em gráficos Recharts do Chartable. src/components/WorkspaceChat/ChatContainer/ChatHistory/Chartable/index.jsx:51 define GRID_COLOR=var(--color-border-faint), consumido como prop stroke={GRID_COLOR} em <CartesianGrid>/<PolarGrid> (linhas 173,228,279,330,387,478) — malha de grade do gráfico. Chartable/CustomTooltip.jsx:46 usa o mesmo valor como cursor={{fill:'var(--color-border-faint)', opacity:'0.15'}} do RechartsTooltip — retângulo de destaque atrás do dado sob o mouse.

**Por quê.** Owner inequívoco (chart, existe no §4.1), mas 'border' não é a propriedade real em nenhum dos 2 sites: (a) é stroke da grade, (b) é fill do destaque de cursor — nenhum é border-color. É o §5.2 (propriedade incompatível) e o §5.1 (mesmo valor, dois contratos). Anatomia é aproximada porque §4.2 não tem termo exato para 'gridline'/'cursor highlight'.

**⚠ Precisa QUEBRAR** — serve owners incompatíveis (§5.1):

- `chart.divider.stroke (grid lines, Chartable/index.jsx:51,173..478) · chart.backdrop.fill.hover (destaque de cursor do tooltip, CustomTooltip.jsx:46)`

#### 75. `border-inverse` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#BEBEBE` · dark `#FFFFFF` |
| **usos** | 18 |
| **propriedades** | border 18 |
| **nome sugerido** | `page.divider.border-color (padrão dominante)` |
| **classe** | `border-page-divider-border-color` |
| **risco** | Pixel-idêntico. A migração centraliza o '/10' hoje repetido manualmente em 14 páginas num único token (DRY, §14.3 CLAUDE.md). |

**Onde está aplicado.** Padrão dominante (~15/18 sites): divisor sob cabeçalho/abas de páginas de Settings, sempre border-b-2 border-border-inverse/10 — ex. src/pages/GeneralSettings/Security/index.jsx:29,104,280; replicado em EmbeddingPreference/index.jsx:301, LLMPreference/index.jsx:603, stt.jsx:133, tts.jsx:131, Settings/Interface/index.jsx:19, Settings/Chat/index.jsx:22, Settings/Branding/index.jsx:22, CommunityHub/Authentication/index.jsx:132, ImportItem/index.jsx:83, Trending/index.jsx:17, e tab-row de WorkspaceSettings/index.jsx:88. Diferente: src/components/Modals/ManageWorkspace/Documents/UploadFile/index.jsx:152 usa border border-border-inverse (sem opacidade) no botão 'Fetch website' — contorno de botão, não divisor.

**Por quê.** 'border-inverse' não é owner; serve dois papéis reais — divisor de cabeçalho de página (repetido mas consistente) e contorno de botão (opacidade cheia) — dois owners e duas intensidades sob o mesmo nome, prova de que o nome descreve intensidade de cor, não quem a usa.

**⚠ Precisa QUEBRAR** — serve owners incompatíveis (§5.1):

- `page.divider.border-color (14 páginas de Settings, ex. Security/index.jsx:29,104,280) · button.container.border-color (UploadFile/index.jsx:152)`

#### 76. `border-strong` — ⏸️ **PENDENTE**

| | |
|---|---|
| **valor** | light `#D5D5D5` · dark `#48515E` |
| **usos** | 5 |
| **propriedades** | var() 5 |
| **risco** | Nenhum risco de pixel (nada renderiza). Recomendação fora do escopo de naming: confirmar com o dono se é candidato a remoção antes de nomear. |

**Onde está aplicado.** Só existe em frontend/tailwind.config.js:45 (outline: var(--color-border-strong)) e em 4 definições de backgroundImage (linhas 180-190: sidebar-gradient, menu-item-selected-gradient, workspace-item-selected-gradient, switch-selected). Grep confirmado em todo src/**/*.{jsx,tsx} por outline-outline, bg-sidebar-gradient, bg-switch-selected, bg-menu-item-selected-gradient, bg-workspace-item-selected-gradient: ZERO ocorrências. As únicas classes -gradient realmente consumidas (LLMProviderOption/index.jsx:20) usam --color-ui-legacy-accent, não border-strong.

**Por quê.** §5.1 exige owner do contexto renderizado — aqui não há renderização para observar (grep zero hits nas classes que consumiriam o token). Atribuir owner a algo que não é pintado em tela nenhuma seria palpite (§5.5).

#### 77. `border-subtle` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#DEDEDE` · dark `#424750` |
| **usos** | 44 |
| **propriedades** | border 34, ring 9, divide 1 |
| **nome sugerido** | `search.container.border-color` |
| **classe** | `border-search-container-border-color` |
| **risco** | Pixel-idêntico na maior parte. Separar o ring de foco do border estático destrava mudar a cor do anel de foco sem arrastar a borda do campo de busca. |

**Onde está aplicado.** Borda do campo de busca do seletor de LLM (src/components/WorkspaceChat/ChatContainer/PromptInput/LLMSelector/LLMSelector/index.jsx:24); divisor interno do painel de personalização de memória (MemoriesSidebar/PersonalizationToggle/index.jsx:55, border-t entre dois toggles); anel de foco de botões de ação (Modals/ManageWorkspace/Documents/WorkspaceDirectory/index.jsx:169,303 e GeneralSettings/AgentConfig/index.jsx:97,114, focus:ring-border-subtle); borda de card/chip na galeria interna /design-system (DesignSystem/index.tsx:59,74,94,96,216 e parts.tsx:181,197,213,272-273,357).

**Por quê.** Mistura owner=search (campo de busca), owner=card (divisor do painel de memória e cards da galeria) e propriedade errada — foco (ring/box-shadow) reusando o mesmo token de borda estática em botões de ação (§5.2).

**⚠ Precisa QUEBRAR** — serve owners incompatíveis (§5.1):

- `search.container.border-color (LLMSelector/LLMSelector/index.jsx:24) · card.divider.border-color (PersonalizationToggle/index.jsx:55) · button.container.box-shadow.focus (WorkspaceDirectory/index.jsx:169,303 e AgentConfig/index.jsx:97,114) · card.container.border-color (cards da galeria /design-system)`

#### 78. `content-danger` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#C22929` · dark `#F87171` |
| **usos** | 115 |
| **propriedades** | var() 2, text 97, border 16 |
| **nome sugerido** | `modal.label.color.destructive (amostra — WorkspaceChat/index.jsx:102)` |
| **classe** | `text-modal-label-color-destructive` |
| **risco** | Pixel-idêntico. Trocar 'danger'→'destructive' não muda hex, só alinha ao §4.4. |

**Onde está aplicado.** Ícone+título de erro num modal (src/components/WorkspaceChat/index.jsx:101-102, AlertCircle + h3 dentro do modal 'workspace not found'); borda esquerda de bloco de erro inline no chat (ChatHistory/HistoricalMessage/index.jsx:73, border-l-2 border-content-danger); texto 'rejeitado' num card de aprovação de ferramenta (ChatHistory/ToolApprovalRequest/index.jsx:215); badge de tipo de arquivo PDF (ChatHistory/FileDownloadCard/index.jsx:90); status 'failed' de execução agendada (GeneralSettings/ScheduledJobs/RunDetailPage.jsx:166).

**Por quê.** 'content' não é owner; e 'danger' nem é palavra do vocabulário fechado de variantes (§4.4 tem 'destructive', não 'danger') — erra owner e variante ao mesmo tempo. Propriedade mistura text(97) e border(16) sob o mesmo nome.

**⚠ Precisa QUEBRAR** — serve owners incompatíveis (§5.1):

- `modal.label.color.destructive + modal.icon.color.destructive (WorkspaceChat/index.jsx:101-102) · chat-message.container.border-color.destructive (HistoricalMessage/index.jsx:73) · badge.label.color.destructive (FileDownloadCard/index.jsx:90) · stat.label.color.destructive (RunDetailPage.jsx:166) — amostra representativa, não exaustiva (115 usos/61 arquivos)`

#### 79. `content-disabled` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#8A8A8A` · dark `#6B6B6B` |
| **usos** | 4 |
| **propriedades** | border 2, text 2 |
| **nome sugerido** | `button.label.color.disabled (EmbedChats, par válido)` |
| **classe** | `text-button-label-color-disabled` |
| **risco** | Pixel-idêntico. Risco de nome: manter 'disabled' na dropzone é mentira semântica que pode levar a aplicá-lo erroneamente num elemento realmente desabilitado. |

**Onde está aplicado.** src/components/UserMenu/AccountModal/index.jsx:103 e Modals/ManageWorkspace/Documents/UploadFile/index.jsx:89 usam light:border-content-disabled na borda tracejada de uma dropzone ATIVA/clicável (não desabilitada); no tema escuro a mesma borda usa border-static-white (cor fixa). GeneralSettings/ChatEmbedWidgets/EmbedChats/index.jsx:203,214 usa text-content-disabled no texto dos botões 'Previous/Next' quando genuinamente disabled (offset===0 / !canNext), com par default real (text-theme-text-primary quando habilitado).

**Por quê.** Quebra por owner e por semântica: em AccountModal/UploadFile 'disabled' é nome enganoso (nada está desabilitado ali); em EmbedChats o estado é real e tem par default (§5.4 satisfeito).

**⚠ Precisa QUEBRAR** — serve owners incompatíveis (§5.1):

- `button.label.color.disabled (EmbedChats/index.jsx:203,214) · attachment.container.border-color (AccountModal/index.jsx:103 e UploadFile/index.jsx:89 — renomear retirando 'disabled', que não descreve o que acontece ali)`

#### 80. `content-info` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#215DDC` · dark `#60A5FA` |
| **usos** | 128 |
| **propriedades** | text 105, border 19, ring 4 |
| **nome sugerido** | `citation.label.color.info (amostra — Citation/index.jsx:199)` |
| **classe** | `text-citation-label-color-info` |
| **risco** | Pixel-idêntico. Separar foco-de-campo de link-informativo permite mudar a cor do anel de foco sem mudar todo link 'saiba mais' do produto. |

**Onde está aplicado.** Link de ação em texto (PromptInput/LLMSelector/SetupProvider/index.jsx:102); nome da citação em hover (ChatHistory/Citation/index.jsx:199); anel/borda de foco em campos (GeneralSettings/ChatEmbedWidgets/EmbedConfigs/NewEmbedModal/index.jsx:158, GeneralSettings/Security/index.jsx:155,181); anel de linha 'em edição' (ModelRouters/RuleBuilder/RuleRow/index.jsx:43); borda de destaque de preview de workspace (Modals/ManageWorkspace/Documents/WorkspaceDirectory/index.jsx:191); aba ativa (pages/WorkspaceSettings/index.jsx:142).

**Por quê.** 'content' não é owner. A maioria dos usos não carrega significado de 'informação' — é o azul de destaque reaproveitado para foco de campo, linha em edição e aba ativa (§5.1: mesmo hex, 5+ contratos diferentes).

**⚠ Precisa QUEBRAR** — serve owners incompatíveis (§5.1):

- `citation.label.color.info + prompt.label.color.info (links, SetupProvider/index.jsx:102) · field.container.border-color.focus (NewEmbedModal:158, Security/index.jsx:155,181) · list-row.container.box-shadow.selected (RuleRow/index.jsx:43) · card.container.border-color.selected (WorkspaceDirectory/index.jsx:191) · nav-item.label.color.selected (WorkspaceSettings/index.jsx:142) — amostra (128 usos/50 arquivos)`

#### 81. `content-inverse` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#000000` · dark `#FFFFFF` |
| **usos** | 234 |
| **propriedades** | text 165, border 69 |
| **nome sugerido** | `chat-message.helper.color (amostra — legenda esmaecida)` |
| **classe** | `text-chat-message-helper-color` |
| **risco** | Pixel-idêntico hoje. Os overrides light: divergentes já provam que é dívida técnica ativa — travar tudo num token quebra a hierarquia assim que o valor base mudar sem revisar os 119 arquivos. |

**Onde está aplicado.** Texto esmaecido via opacidade, sempre PATCHED por tema claro com token DIFERENTE por site: UserMenu/AccountModal/index.jsx:160,180 usa text-content-inverse/60 puro; ChatHistory/ToolApprovalRequest/index.jsx:78 usa text-content-inverse/60 light:text-content-primary; ChatHistory/ClarifyingQuestion/SurveyBody.jsx:6 usa light:text-content-secondary; ChatContainer/SourcesSidebar/index.jsx:51 usa light:text-content-tertiary — mesma classe base, 3 destinos diferentes no claro. Borda de botão flutuante 'voltar ao fim' (ChatHistory/index.jsx:242, border-content-inverse/10). Cor da aba inativa (pages/WorkspaceSettings/index.jsx:143).

**Por quê.** Prova mais forte do dossiê: a mesma classe base precisa de override manual por site no tema claro para 3 tokens diferentes — não é papel semântico único, é valor bruto (branco/preto) reempacotado conforme a hierarquia que cada elemento precisa. Mistura text(165) e border(69).

**⚠ Precisa QUEBRAR** — serve owners incompatíveis (§5.1):

- `chat-message.helper.color (AccountModal:160,180, ClarifyingQuestion/SurveyBody.jsx:6) · button.container.border-color (scroll-to-bottom, ChatHistory/index.jsx:242) · nav-item.label.color (aba inativa, WorkspaceSettings/index.jsx:143) — amostra (234 usos/119 arquivos, decomposição completa exige inventário exaustivo)`

#### 82. `content-on-active` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#FFFFFF` · dark `#FFFFFF` |
| **usos** | 1 |
| **propriedades** | text 1 |
| **nome sugerido** | `button.label.color.selected` |
| **classe** | `text-button-label-color-selected` |
| **risco** | Pixel-idêntico — troca de nome simples, 1 site, sem quebra necessária. |

**Onde está aplicado.** Único site: pages/Admin/Agents/SQLConnectorSelection/SQLConnectionModal.jsx:529, componente DBEngine — um <button> (linha 525) com logo de engine de banco (postgresql/mysql/sql-server); quando active, fundo vira bg-primary! e recebe text-content-on-active (branco) para contraste.

**Por quê.** Owner claro e único (button, elemento real). 'on-active' não é forma válida — §4.5 já tem o estado 'selected'/'active', a palavra correta é o estado, não um sufixo 'on-X' inventado.

#### 83. `content-on-selected` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#56061A` · dark `#F77E9D` |
| **usos** | 2 |
| **propriedades** | var() 2 |
| **nome sugerido** | `owner novo: cta-link — cta-link.label.color` |
| **classe** | `text-cta-link-label-color` |
| **risco** | Pixel-idêntico — troca de nome; 100% var(), sempre cor de texto, sem quebra de propriedade. |

**Onde está aplicado.** Alimenta --theme-button-cta (src/index.css:66,172) → cor Tailwind 'cta-button' (tailwind.config.js:47). Consumo real sempre text-cta-button/hover:text-cta-button em links de ação: pages/Admin/Agents/index.jsx:671 ('Create Flow') e :679 ('Open Builder'); GeneralSettings/MobileConnections/ConnectionModal/index.jsx:71; DeviceRow/index.jsx:50; Admin/AgentBuilder/HeaderMenu/index.jsx:129; Admin/Agents/MCPServers/ServerPanel.jsx:262 e index.jsx:62,70,104,120; Imported/SkillList/index.jsx:18; AgentFlows/index.jsx:17 — mesmo papel em 7+ páginas.

**Por quê.** 'content' não é owner. Papel é consistente (link estilizado como CTA), mas §4.1 não cobre 'link de ação estilo CTA' — não é 'button' (DOM real é <Link>/<a>). Owner novo justificado: 7+ sites idênticos em páginas não relacionadas.

#### 84. `content-primary` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#000000` · dark `#F7F7F7` |
| **usos** | 1668 |
| **propriedades** | var() 17, text 1650, bg 1 |
| **nome sugerido** | `amostra: search.suffix.fill.hover (ícone, index.css:1119) + centenas de <owner>.label.color (texto) — decomposição completa exige inventário de 330 arquivos, fora do escopo deste dossiê` |
| **classe** | `text-search-suffix-fill-hover (ícone); demais casos preservam bg-/text- conforme owner real` |
| **risco** | Pixel-idêntico para o texto. Para o ícone de busca, a quebra impede que mudar 'cor de texto primária' arraste sem querer o glifo do botão de limpar busca. |

**Onde está aplicado.** Papel de texto padrão do produto (título de modal KeyboardShortcutsHelp/index.jsx:30; corpo de erro WorkspaceChat/index.jsx:108; labels de formulário AccountModal/index.jsx:167,187). Achado de propriedade incompatível: src/index.css:1106/1119 usa background-color:var(--color-content-tertiary) (padrão) e var(--color-content-primary) (:hover) para pintar via CSS mask o glifo 'x' do botão nativo de limpar busca (.search-input::-webkit-search-cancel-button) — propriedade real é fill de ícone.

**Por quê.** 'content' descreve O QUE é pintado, não QUEM consome — viola §1 porque o identificador realmente consumido em >1600 lugares é text-content-primary direto, sem camada de owner. Comentário do autor em index.css:1093-1097 confirma reuso deliberado do 'mesmo papel' entre texto e máscara de ícone.

**⚠ Precisa QUEBRAR** — serve owners incompatíveis (§5.1):

- `search.suffix.fill.hover (ícone de limpar busca, index.css:1119) — resto do volume segue o mesmo raciocínio, um owner por família de componente (sidebar.item, modal.label, card.label etc.)`

#### 85. `content-secondary` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#4A4A4A` · dark `#CBCBCB` |
| **usos** | 196 |
| **propriedades** | var() 20, text 173, border 3 |
| **nome sugerido** | `nav-item.label.color (amostra dominante — index.css:1561)` |
| **classe** | `text-nav-item-label-color` |
| **risco** | Pixel-idêntico. Isolar a borda do blockquote do texto secundário evita que um ajuste de contraste na sidebar mude a espessura visual do acento do blockquote. |

**Onde está aplicado.** Texto secundário dominante (src/index.css:1561, .nav-row{color:var(--color-content-secondary)} — item de sidebar inativo; :1650 ícone de controle). Achado de propriedade incompatível: pages/GeneralSettings/Chats/MarkdownRenderer.jsx:46 e o arquivo duplicado ChatEmbedWidgets/EmbedChats/MarkdownRenderer.jsx:46 usam border-l-2 border-content-secondary/30 (acento de blockquote); Admin/Agents/MCPServers/ServerPanel.jsx:239 usa border-content-secondary/50 opacity-60 num card de servidor indisponível.

**Por quê.** 'content' não é owner; propriedade mistura text(173) e border(3). Caso do MarkdownRenderer é limpo o bastante para nomear com precisão (mesmo componente, replicado em 2 rotas).

**⚠ Precisa QUEBRAR** — serve owners incompatíveis (§5.1):

- `nav-item.label.color (sidebar, index.css:1561,1650) · markdown.container.border-color (blockquote, MarkdownRenderer.jsx:46 nos 2 arquivos) · card.container.border-color.disabled (ServerPanel.jsx:239) — amostra (196 usos/72 arquivos)`

#### 86. `content-success` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#1C7444` · dark `#27C685` |
| **usos** | 51 |
| **propriedades** | var() 4, text 41, ring 3, border 3 |
| **nome sugerido** | `checkbox.icon.color.checked (amostra — checklist, index.css:107)` |
| **classe** | `text-checkbox-icon-color-checked (via var() no CSS neste site, não classe Tailwind direta)` |
| **risco** | Pixel-idêntico. Isolar o anel de foco do toggle do 'verde de sucesso' evita que revisão de acessibilidade do sucesso mude a cor de foco de todos os toggles. |

**Onde está aplicado.** Badge XLS/CSV (ChatHistory/FileDownloadCard/index.jsx:106,113); status 'completed' (GeneralSettings/ScheduledJobs/RunDetailPage.jsx:162); check de aprovação (ChatHistory/ToolApprovalRequest/index.jsx:223); ícone de item completo da checklist (--theme-checklist-checkbox-fill, index.css:107,221). Achado de contexto incompatível: components/lib/Toggle/index.jsx:140-141 usa peer-focus:light:ring-content-success — anel de FOCO de um toggle no tema claro, sem relação com 'sucesso'.

**Por quê.** 'content' não é owner. Caso do Toggle é o §5.1 mais nítido do lote: contexto renderizado é anel de foco (box-shadow), não estado de sucesso — só coincide o hex com o verde usado em badges/status.

**⚠ Precisa QUEBRAR** — serve owners incompatíveis (§5.1):

- `checkbox.icon.color.checked (checklist, index.css:107,221) · badge.label.color.success (FileDownloadCard/index.jsx:106,113) · stat.label.color.success (RunDetailPage.jsx:162) · toggle.track.box-shadow.focus (Toggle/index.jsx:140-141 — renomear retirando 'success')`

#### 87. `content-tertiary` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#5C5C5C` · dark `#949494` |
| **usos** | 210 |
| **propriedades** | var() 7, text 203 |
| **nome sugerido** | `field.placeholder.color (amostra dominante — index.css:43,65, encaixe perfeito com owner+anatomia já do vocabulário)` |
| **classe** | `text-field-placeholder-color` |
| **risco** | Pixel-idêntico hoje. Ganho mais concreto do lote: hoje mudar o 'cinza terciário de texto' arrasta a cor de TODAS as scrollbars do app. |

**Onde está aplicado.** Placeholder de input em todo o app (--theme-placeholder e --theme-settings-input-placeholder, index.css:43,65). Dois achados de propriedade incompatível com comentário do próprio autor: (a) index.css:962,979, .white-scrollbar{scrollbar-color:var(--color-content-tertiary)...} — thumb de scrollbar, comentário na linha 960 diz 'a barra é cromo, não conteúdo'; (b) index.css:1106, background-color:var(--color-content-tertiary) como fill (via mask) do glifo padrão do botão nativo de limpar busca, hover trocando para content-primary (linha 1119).

**Por quê.** 'content' não é owner; caso da scrollbar é o mais claro do dossiê porque o próprio autor documentou saber que não era 'conteúdo' e usou mesmo assim por conveniência de theme-awareness — exatamente o antipadrão que §2-3 do GRAMMAR eliminam.

**⚠ Precisa QUEBRAR** — serve owners incompatíveis (§5.1):

- `field.placeholder.color (index.css:43,65 e dezenas de placeholders) · search.suffix.fill (glifo padrão do botão de limpar busca, index.css:1106 — par com search.suffix.fill.hover do token 12) · owner novo: scrollbar — scrollbar.thumb.background-color (index.css:962,979`
- `justificativa: reaparece em ≥3 containers de scroll não relacionados — sidebar, chat, tool-call — chrome do navegador, não pertence a owner de domínio existente)`

#### 88. `content-warning` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#B05108` · dark `#FBBF24` |
| **usos** | 59 |
| **propriedades** | var() 2, text 45, border 12 |
| **nome sugerido** | `banner.label.color.warning (amostra — Introduction/index.jsx:38, único caso com par de propriedades consistente no mesmo owner)` |
| **classe** | `text-banner-label-color-warning` |
| **risco** | Pixel-idêntico. Banner é o único owner do dossiê onde border+text já vivem coerentes juntos — a quebra aqui é só de owner ('content'→'banner'), não de propriedade. |

**Onde está aplicado.** Badge de tipo de arquivo PPT (FileDownloadCard/index.jsx:83, GeneratedFileCard.jsx:13,19); aviso de limite de contexto excedido (PromptInput/AttachItem/ParsedFilesMenu/index.jsx:124,135); banner de aviso de importação privada (GeneralSettings/CommunityHub/ImportItem/Steps/Introduction/index.jsx:38 — mesmo elemento usa border-content-warning E text-content-warning, owner único e consistente); link/ícone de aviso em conectores externos (Gitlab/index.jsx:319, DrupalWiki/index.jsx:133, Confluence/index.jsx:194, Github/index.jsx:290); status 'timed_out'/'running' de job agendado (RunDetailPage.jsx:170,174).

**Por quê.** 'content' não é owner — mesmo padrão de danger/info/success ('warning' já é palavra correta em §4.4, mas tratada como owner). Múltiplos owners reais coexistem: badge, banner, prompt, stat.

**⚠ Precisa QUEBRAR** — serve owners incompatíveis (§5.1):

- `banner.label.color.warning + banner.container.border-color.warning (Introduction/index.jsx:38) · badge.label.color.warning (FileDownloadCard/index.jsx:83, GeneratedFileCard.jsx:13,19) · prompt.helper.color.warning (ParsedFilesMenu/index.jsx:124,135) · stat.label.color.warning (RunDetailPage.jsx:170,174) — amostra (59 usos/23 arquivos)`

<details><summary>o que a refutação derrubou neste grupo</summary>

- **`surface-elevated (token 4)`** — 2 das 5 citações do owner 'modal' apontam linha errada — não foram reconferidas contra o arquivo vivo (ao contrário das outras evidências do mesmo dossiê, que foram corrigidas).
  - evidência: `src/components/WorkspaceChat/ChatContainer/ChatHistory/Citation/index.jsx:191 hoje é `export function omitChunkHeader(text) {` — o `bg-surface-elevated` real está na linha 202. src/components/WorkspaceChat/ChatContainer/MemoriesSidebar/Memo`
  - correção: Trocar as âncoras para Citation/index.jsx:202 e MemoryModal/index.jsx:52. A classificação como owner 'modal' e o veredito INADEQUADO continuam corretos — só o ponteiro path:linha estava errado.
- **`surface-panel (token 9)`** — 3 citações da quebra 'button.container.background-color.primary' têm drift de +1 linha em relação ao arquivo vivo.
  - evidência: `src/pages/GeneralSettings/ScheduledJobs/index.jsx:122 (real: 123) e :188 (real: 189); src/pages/GeneralSettings/ScheduledJobs/RunHistoryPage.jsx:100 (real: 101) — todas ainda contêm `bg-button-container-background-color ... light:bg-surface`
  - correção: Ajustar as 3 âncoras para 123, 189 e 101. Conteúdo e classificação permanecem corretos.
- **`surface-selected-foreground (token 12)`** — Contagem do split label(texto)/icon invertida. O texto afirma '5 dos 8 sites pintam texto de <button>, 3 pintam o SVG do ícone', mas a leitura direta do código mostra o oposto: 3 ocorrências em botões com texto visível e 5 em botões só-ícone.
  - evidência: `Texto visível (3 sites): WorkspaceDirectory/index.jsx:277 ('select_all'/'deselect_all'), :289 ('remove_selected'); Directory/index.jsx:289 ('move-workspace'). Ícone (5 sites): Directory/index.jsx:298 (classe duplicada 2x no próprio <button>`
  - correção: Inverter a frase para '3 dos 8 sites pintam texto de <button> (WorkspaceDirectory:277,289; Directory:289), 5 pintam o ícone (Directory:298×2, 300, 314×2)'. A recomendação arquitetural de separar button.label.color de button.icon.color continua válida — só a contagem estava trocada.

</details>

> **Omitidos pelo agente (2):** `surface-sunken (numero 14) — entrada truncada no meio do JSON recebido para revisão: só tem "numero":14 e o início do campo "token":"su…", sem veredito, porQue, nomeSugerido, classeSugerida, quebra ou risco. O dossiê original (22 usos, 1 arquivo, todos var() em src/index.css: --theme-sidebar-footer-icon, --theme-settings-input-bg/-active/-text, --theme-file-row-odd, --theme-home-bg-button, --theme-home-button-secondary, --theme-checklist-item-bg, --theme-attachment-bg/-success-bg/-icon-spinner-bg, linhas 49-218 nos dois temas) nunca foi julgado.`, `surface-warning-tint (numero 15) — token inteiro ausente do documento recebido, apesar de estar no dossiê original (3 usos/2 arquivos: 2 pontes CSS mortas --theme-button-disable-hover-bg em src/index.css:119,224, e 1 site vivo hover:bg-surface-warning-tint em src/pages/Admin/Users/UserRow/index.jsx:84). Nenhum veredito foi emitido.`

### 3.6 grupo `06-owners-b`

> **Refutação:** `CORRIGIR` — 6 confirmados, 10 refutados, 0 omitidos.

#### 89. `app-bg` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#F9F9F7` · dark `#17191C` |
| **usos** | 50 |
| **propriedades** | var(): 3, bg: 47 — 100% background-color |
| **nome sugerido** | `page.container.background-color` |
| **classe** | `bg-page-container-background-color` |
| **risco** | Rename puro, pixel-idêntico — mesma custom property/valor em ambos os temas, só muda o texto do identificador. |

**Onde está aplicado.** Fundo do wrapper raiz de TODA página/rota de topo do app (47 sites diretos, 45 arquivos, zero exceção encontrada). Ex.: src/pages/Main/index.jsx:16 `<div className="w-screen h-screen overflow-hidden bg-app-bg flex">` (envolve Sidebar + conteúdo roteado); src/pages/WorkspaceChat/index.jsx:20 e src/pages/WorkspaceSettings/index.jsx:81 (mesmo padrão); src/components/Preloader.jsx:27 (splash de loading tela-cheia, `fixed ... bg-app-bg`); src/components/Modals/Password/index.jsx:15 (gate de senha tela-cheia); todo src/pages/GeneralSettings/*/index.jsx e src/pages/Admin/*/index.jsx (ex. GeneralSettings/ApiKeys/index.jsx:41, Admin/Users/index.jsx:22). Também src/index.css:294 aplica `background-color: var(--color-app-bg)` direto no `<html>` (comentário nas linhas 289-294: substituiu um `background-color: white` cravado + media query de dark mode do SO).

**Por quê.** O owner `page` (§4.1, Casca e navegação) descreve exatamente o contexto renderizado: em 100% dos 47 sites diretos o token pinta o container RAIZ de uma página/rota/overlay tela-cheia, nunca um elemento interno. Anatomia = container (owner sem parte distinguível). Mas o nome atual `app-bg` pula anatomia e propriedade por completo — não é `owner.anatomia.propriedade`, é abreviação legada (confirmado: aparece só no bucket de fechamento de PARIDADE do tokens/EXCEPTIONS.json, não no bucket de migração por owner Grupo 3b1/4a/4b/4c).

#### 90. `chatarea-bg` — ⏸️ **PENDENTE**

| | |
|---|---|
| **valor** | light `#F9F9F7` · dark `#17191C` |
| **usos** | 3 |
| **propriedades** | bg: 3 — background-color |
| **classe** | `bg-chatarea-bg` |
| **risco** | Nenhuma mudança de pixel em qualquer resolução cogitada — é só a fronteira de owner/anatomia que está indeterminada. Precisa decisão do dono: (a) owner novo justificado (ex. 'workspace' ou 'main-content' para o painel de conteúdo primário aninhado na página) ou (b) estender §4.2 com um termo de anat |

**Onde está aplicado.** Aplicado SOMENTE no `<main id="main-content" className="bg-chatarea-bg flex-1 ... md:rounded-overlay w-full h-full overflow-hidden">` — o painel arredondado que hospeda a conversa do chat — em 2 arquivos: src/components/WorkspaceChat/ChatContainer/index.jsx:467 (variante vazia, sem histórico) e ~:500 (variante com histórico); e src/pages/Main/Home/index.jsx:317 (mesmo `<main id="main-content">` na rota Home). Nos 3 sites este `<main>` é um PAINEL aninhado DENTRO de uma página cujo wrapper externo já carrega `bg-app-bg` (ex. pages/Main/index.jsx:16), fica ao lado de um `ChatSettingsMenu` irmão, e tem margens próprias (`md:mr-content md:my-content`) que deixam o app-bg da página aparecer ao redor dele.

**Por quê.** §5.1 diz que dois contratos com o mesmo hex continuam dois contratos — é exatamente o caso: `chatarea-bg` pinta um PAINEL aninhado dentro do shell que `page.container.background-color` (token 1) já é dono, não o shell em si. Só que o vocabulário fechado de owners (§4.1) não tem nenhuma entrada para 'painel de conteúdo principal aninhado dentro da página' — `page` já está tomado pelo shell externo, e nenhum de sidebar/nav-item/thread-item/workspace-item/toolbar/logo encaixa num `<main>` de chat arredondado. Forçar em `page` exigiria a MESMA identidade DTCG pintando duas camadas de DOM diferentes, e a anatomia fechada (§4.2) também não tem termo para 'conteúdo'/'canvas' que permitisse diferenciar.

#### 91. `nav-item-container-background-color` — ✅ **OK**

| | |
|---|---|
| **valor** | light `transparent` · dark `transparent` |
| **usos** | 2 |
| **propriedades** | bg: 2 — background-color |
| **risco** | N/A — nenhuma mudança recomendada. |

**Onde está aplicado.** Os dois botões-pílula do seletor de abas do drawer de Memórias ('Workspace' / 'Global') — src/components/WorkspaceChat/ChatContainer/MemoriesSidebar/MemoryTabs/index.jsx:30 e :46 — como fundo padrão (transparente) do botão `rounded-full` quando NÃO é a aba ativa, com `hover:bg-surface-hover` sobreposto para o mouse-hover.

**Por quê.** owner=nav-item não é palpite meu: é a MESMA decisão já registrada em tokens/EXCEPTIONS.json ('Tokens Grupo 3b1 ... MemoryTabs ganha uma familia DTCG com $root transparente e selected por tema'). Anatomia=container está correta (§4.2: 'owner sem partes distinguíveis usa container'). Propriedade=background-color confere. Estado default corretamente OMITIDO (sem sufixo `.default`, conforme §4.5). O nome literal atual `nav-item-container-background-color` JÁ É a emissão dash-joined exata de `nav-item.container.background-color` (conferido contra a regra `path.map(dash).join("-")` de build-tokens.mjs:229) — nada a mudar.

#### 92. `nav-item-container-background-color-selected` — ✅ **OK**

| | |
|---|---|
| **valor** | light `#EDECE8` · dark `#2A2C32` |
| **usos** | 2 |
| **propriedades** | bg: 2 — background-color |
| **risco** | N/A — nenhuma mudança recomendada. |

**Onde está aplicado.** Mesmo componente MemoryTabs, fundo da aba SELECIONADA — src/components/WorkspaceChat/ChatContainer/MemoriesSidebar/MemoryTabs/index.jsx:29 e :45 (`activeTab === "workspace"\|"global" ? "bg-nav-item-container-background-color-selected" : ...`).

**Por quê.** Mesma base do token 3. Estado=selected é válido (§4.5) e tem o par default presente (token 3, transparent) — satisfaz §5.4. Mesma decisão registrada em EXCEPTIONS.json Grupo 3b1.

#### 93. `sidebar-bg` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#F9F9F7` · dark `#17191C` |
| **usos** | 12 |
| **propriedades** | var(): 2, bg: 10 — background-color |
| **nome sugerido** | `sidebar.container.background-color` |
| **classe** | `bg-sidebar-container-background-color` |
| **risco** | Rename puro, pixel-idêntico. |

**Onde está aplicado.** Exclusivamente a superfície do painel da própria sidebar — src/components/Sidebar/index.jsx:83 (`<nav data-sidebar>`, painel desktop), :93 (faixa arredondada atrás do UserFooter, mesmo painel), :139 (barra de topo mobile), :174 e :204 (nav mobile deslizante + sua faixa de rodapé com blur); src/components/SettingsSidebar/index.jsx:52, :86, :128, :158, :186 — o painel equivalente da settings-sidebar, seu header mobile e faixa de rodapé. Todos os 12 sites pertencem à árvore de Sidebar ou SettingsSidebar, sem exceção.

**Por quê.** owner `sidebar` (§4.1) bate com 100% dos sites — é literalmente o fundo do próprio painel da sidebar. Mas o nome pula anatomia+propriedade ('sidebar-bg', não 'sidebar.container.background-color') — nome legado pré-migração (confirmado no bucket de fechamento de paridade do EXCEPTIONS.json, não no bucket da migração por owner).

#### 94. `sidebar-divider` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#EBEBEB` · dark `#3A3E44` |
| **usos** | 5 |
| **propriedades** | border: 3, bg: 2 |
| **nome sugerido** | `sidebar.divider.border-color` |
| **classe** | `border-sidebar-divider-border-color` |
| **risco** | Rename puro, pixel-idêntico nos 5 sites (os 2 sites de hairline continuam usando bg-sidebar-divider-border-color apontando para a mesma custom property). |

**Onde está aplicado.** src/components/Sidebar/index.jsx:40 `border-r border-sidebar-divider` (linha vertical entre o painel da sidebar e o conteúdo); src/components/SettingsSidebar/index.jsx:158 `border-r` idem (variante settings); src/components/SettingsSidebar/index.jsx:113 e :169 `bg-sidebar-divider` num `div` de `h-[1.5px]` (hairline horizontal separando a lista de navegação do bloco de suporte/versão, desenhado via background em vez de border para um traço nítido); src/components/Sidebar/UserFooter/index.jsx:82 `border-t border-sidebar-divider` (linha acima do bloco de avatar/sign-out dentro da sidebar principal).

**Por quê.** owner=sidebar + anatomia=divider (§4.2 lista 'divider' explicitamente) batem nos 5 sites — todos são a linha separadora da Sidebar ou SettingsSidebar. Falta a propriedade no nome. 3/5 usam border-color, 2/5 usam background-color para simular a mesma linha; por §5.2 (alias de propriedade diferente não vira token novo, reusa o token que o owner já tem), a propriedade canônica é border-color e os 2 sites de hairline devem continuar consumindo o MESMO token via classe bg-*.

#### 95. `sidebar-field-bg` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#FCFCFB` · dark `#21252B` |
| **usos** | 2 |
| **propriedades** | bg: 2 — background-color |
| **nome sugerido** | `search.container.background-color` |
| **classe** | `bg-search-container-background-color` |
| **risco** | Para o campo de busca: rename puro, pixel-idêntico. Para o botão: nenhuma variante EXISTENTE de button bate com este valor — conferido `button.container.background-color` (#2A2C32/#F7F7F7) e `-secondary` (#2A2C32/#FFFFFF), nenhum é #21252B/#FCFCFB. Forçar numa variante existente MUDA o valor; criar  |

**Onde está aplicado.** src/components/Sidebar/SearchBox/index.jsx:106 — o `<input type="search" placeholder={t("common.search")}>` da busca da sidebar; e :259 — `ShortWidthNewWorkspaceButton`, um `<button>` separado (ícone FolderPlus, abre o modal de nova workspace) renderizado ao lado do campo de busca, reusando deliberadamente o mesmo tratamento `.prompt-box` (comentário do próprio código, linhas 87-97: 'prompt-box = MESMO tratamento de contorno da caixa do prompt, reusado como esta') para formar uma barra de busca visualmente contínua.

**Por quê.** owner 'sidebar' está errado por §5.1 — o contexto renderizado do primeiro site é um `<input>` de busca (owner `search`, Controles §4.1). O segundo site é um `<button>` (owner `button`), não busca, ainda que compartilhe o visual de propósito.

**⚠ Precisa QUEBRAR** — serve owners incompatíveis (§5.1):

- `search.container.background-color (input de busca, linha 106)`
- `owner=button para o ShortWidthNewWorkspaceButton (linha 259) — variante indeterminada, ver risco.`

#### 96. `sidebar-item-active` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#E5E4E0` · dark `#3A3E44` |
| **usos** | 13 |
| **propriedades** | var(): 12, bg: 1 |
| **nome sugerido** | `nav-item.container.background-color.selected` |
| **classe** | `bg-nav-item-container-background-color-selected` |
| **risco** | Porção nav-item.selected = rename puro, pixel-idêntico. Porção menu: reapontar para o token canônico MUDA o valor renderizado (#3A3E44/#E5E4E0 → #2A2C32/#F7F7F7) — correção de bug deliberada e divulgada, não rename silencioso. Porção skeleton = rename puro, pixel-idêntico. |

**Onde está aplicado.** (a) DOMINANTE: src/index.css:1571-1578 `.nav-row[aria-current="page"], .nav-row[data-selected="true"], .nav-row.nav-row-selected { background-color: var(--color-sidebar-item-active); }` — fundo SELECIONADO de qualquer `.nav-row`: itens de workspace (Sidebar/ActiveWorkspaces/index.jsx:154-155), itens de thread (Sidebar/ActiveWorkspaces/ThreadContainer/ThreadItem/index.jsx:78), itens do menu de settings (SettingsSidebar/MenuOption/index.jsx:76). (b) src/components/WorkspaceChat/ChatContainer/PromptInput/ReasoningEffort/index.jsx:292 — reusado direto como `bg-sidebar-item-active` no item 'marcado' (checked) de um menu `role="menuitemradio"` (popover de nível de raciocínio sob o prompt do chat) — um MENU, não a sidebar. (c) src/components/Sidebar/ActiveWorkspaces/index.jsx:69 — reusado como `highlightColor="var(--color-sidebar-item-active)"`, a cor do brilho/shimmer de um placeholder `react-loading-skeleton` exibido enquanto as workspaces carregam — um SKELETON, nem fundo de item nenhum.

**Por quê.** 3 owners incompatíveis sob um nome só — o mesmo anti-padrão `surface.deep` do §2/§5.1. Achado extra, medido: a cor canônica de 'item de menu selecionado' usada em TODO o resto do app (ToolsMenu, LLMSelector, ChatSettingsMenu/TextSize, ChatSettingsMenu/Export) é `--color-menu-row-background-color-selected` = #2A2C32 escuro/#F7F7F7 claro — mas o item marcado do ReasoningEffortMenu renderiza #3A3E44/#E5E4E0 (este token): um tom DIFERENTE e não-intencional para o mesmo estado de UI.

**⚠ Precisa QUEBRAR** — serve owners incompatíveis (§5.1):

- `nav-item.container.background-color.selected (uso dominante via .nav-row)`
- `menu.row.background-color.selected — NÃO é token novo, o uso do ReasoningEffort deve ser REAPONTADO para este token JÁ EXISTENTE (corrige o bug de cor real citado em porQue)`
- `skeleton.indicator.background-color (shimmer do ActiveWorkspaces, espelhando o padrão já estabelecido progress.track/progress.indicator no mesmo repo).`

#### 97. `sidebar-item-active-hover` — ⏸️ **PENDENTE**

| | |
|---|---|
| **valor** | light `#DEDDD8` · dark `#44484F` |
| **usos** | 2 |
| **propriedades** | var(): 1, bg: 1 |
| **classe** | `bg-sidebar-item-active-hover` |
| **risco** | Nenhuma mudança de pixel proposta em qualquer leitura — é puramente lacuna de vocabulário/nome. |

**Onde está aplicado.** src/index.css:1580-1596 — documentado no próprio código como 'o terceiro tom': `.nav-row[aria-current="page"]:hover, .nav-row[data-selected="true"]:hover, .nav-row.nav-row-selected:hover { background-color: var(--color-sidebar-item-active-hover); }` — o estado composto de um nav-row que está SELECIONADO E sob o ponteiro ao mesmo tempo (distinto de hover puro e de selected puro; o comentário histórico explica um bug de especificidade onde o item selecionado não respondia visualmente ao hover). src/components/Sidebar/ActiveWorkspaces/ThreadContainer/index.jsx:196 — `NewThreadButton` ('+ Nova Thread'), usa este MESMO token como seu `:hover` simples (o estado padrão dele é `bg-sidebar-item-hover`, token 10) — aqui não há 'selected' nenhum, é só um par default→hover comum num botão de ação.

**Por quê.** Dois problemas reais e distintos: (1) o identificador só tem espaço para UM segmento de estado (`[.variante][.estado]`), mas o uso em index.css é um estado COMPOSTO documentado (selecionado E hovered ao mesmo tempo) que a lista fechada §4.5 não contempla — encaixar em `.selected` colide com o token 8, e em `.hover` colide com o token 10. (2) o uso no NewThreadButton é um contrato independente (hover simples de um botão de ação não-selecionado) que por acaso reusa o mesmo valor — outro caso de §5.1. Nenhum dos dois se resolve sem decisão do dono: estender §4.5 com um estado composto (ou reaproveitar o estado 'active', não usado hoje neste componente, como `nav-item.container.background-color.active` para o caso 1 — leitura plausível mas não confirmada) e decidir se o hover do NewThreadButton merece identificador próprio.

**⚠ Precisa QUEBRAR** — serve owners incompatíveis (§5.1):

- `candidato: nav-item.container.background-color.active (composto selected+hover, index.css:1592-1596) + um segundo token ainda sem nome para o hover do NewThreadButton (ThreadContainer/index.jsx:196).`

#### 98. `sidebar-item-hover` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#EDECE8` · dark `#2E3238` |
| **usos** | 23 |
| **propriedades** | var(): 22, bg: 1 |
| **nome sugerido** | `nav-item.container.background-color.hover` |
| **classe** | `bg-nav-item-container-background-color-hover` |
| **risco** | Porção nav-item.hover = rename puro, pixel-idêntico. Porção menu (TextSizeMenu): reapontar MUDA o valor (#2E3238/#EDECE8 → #2A2C32/#F7F7F7) — correção de bug divulgada. Porção button (EmbedRow): provável mudança de valor, salvo criação de variante nova. Porção list-row (ConnectorOption): sem mudança |

**Onde está aplicado.** (a) DOMINANTE: src/index.css:1566-1569 `.nav-row:hover { background-color: var(--color-sidebar-item-hover); }` — hover simples de qualquer `.nav-row` não-selecionado (itens de workspace, thread, settings-menu, e as linhas do menu de conta em src/components/UserMenu/UserButton/index.jsx:84/91/105). (b) src/components/WorkspaceChat/ChatContainer/PromptInput/TextSizeMenu/index.jsx:76/92/108 — reusado (via alias `--theme-action-menu-item-hover`) como fundo do item SELECIONADO/marcado do menu 'small/normal/large' — um MENU, e um TERCEIRO tom divergente (#2E3238/#EDECE8) do canônico `menu-row-background-color-selected` (#2A2C32/#F7F7F7) usado em todo o resto do app, ao lado do achado do token 8. (c) src/pages/GeneralSettings/ChatEmbedWidgets/EmbedConfigs/EmbedRow/index.jsx:97 — reusado (via `--theme-button-code-hover-bg`) como `:hover` de um `<button>` 'Code' numa linha de tabela de embeds — um BUTTON, não a sidebar. (d) src/components/Modals/ManageWorkspace/DataConnectors/ConnectorOption/index.jsx:13 — reusado (via `--theme-file-picker-hover`) como destaque PERSISTENTE do conector selecionado numa lista de seleção — um LIST-ROW, não hover de verdade (o mouse-hover real já é `hover:bg-surface-hover` no mesmo elemento). (e) src/components/Sidebar/ActiveWorkspaces/ThreadContainer/index.jsx:196 — Tailwind direto `bg-sidebar-item-hover` como fundo PADRÃO (não-hover) do NewThreadButton.

**Por quê.** Ao menos 4 owners incompatíveis sob um nome só (nav-item, menu, button, list-row), mais um consumidor da família nav-item usando-o incorretamente como DEFAULT em vez de hover. Mesma classe de problema do token 8, em escala maior (23 usos).

**⚠ Precisa QUEBRAR** — serve owners incompatíveis (§5.1):

- `nav-item.container.background-color.hover (uso dominante .nav-row:hover + linhas do dropdown UserButton)`
- `menu.row.background-color.selected — reapontar o uso do TextSizeMenu para este token JÁ EXISTENTE, mesma família de bug do token 8 (aqui um TERCEIRO valor divergente)`
- `um token de owner button para o hover do botão 'Code' do EmbedRow (nenhuma variante de button existente bate com este valor)`
- `list-row.container.background-color.selected para o destaque persistente do ConnectorOption (já existe um token `--color-list-row-hover` com o MESMO valor, hoje não consumido em JSX, que poderia ser reaproveitado em vez de um hex novo)`
- `e o uso de default do NewThreadButton, que precisa de decisão do dono (identificador próprio de 'default enfatizado' ou correção para o transparente padrão dos demais nav-rows).`

#### 99. `toolbar-container-background-color` — ✅ **OK**

| | |
|---|---|
| **valor** | light `#F7F7F7` · dark `#2A2C32` |
| **usos** | 1 |
| **propriedades** | bg: 1 — background-color |
| **risco** | N/A. |

**Onde está aplicado.** src/components/Modals/ManageWorkspace/index.jsx:121 — a barra em formato de pílula do `ModalTabSwitcher` (`<div className="... bg-toolbar-container-background-color p-1 rounded-xl w-fit">`) que hospeda os botões de aba 'Documents'/'Data Connectors' dentro do modal ManageWorkspace.

**Por quê.** owner=toolbar (§4.1) bate exatamente com o contexto renderizado — uma barra horizontal que agrupa controles relacionados (2 botões de aba). Confere com a decisão já registrada em tokens/EXCEPTIONS.json ('Tokens Grupo 3b1 ... ModalTabSwitcher ganha o owner toolbar'). Anatomia=container, propriedade=background-color, sem variante/estado necessários. O nome literal já é a emissão correta de `toolbar.container.background-color`.

#### 100. `toolbar-container-background-color-secondary` — ✅ **OK**

| | |
|---|---|
| **valor** | light `#EDECE8` · dark `#2A2C32` |
| **usos** | 1 |
| **propriedades** | bg: 1 — background-color |
| **risco** | N/A. |

**Onde está aplicado.** src/components/WorkspaceChat/ChatContainer/ChatHistory/HistoricalMessage/Actions/EditMessage/index.jsx:138 — `EditActionBar`, a barra de ações 'Cancel'/'Save' exibida abaixo do textarea de edição de uma mensagem (`<div className="... bg-toolbar-container-background-color-secondary rounded-lg p-2">`).

**Por quê.** Mesmo owner=toolbar, anatomia=container, propriedade=background-color, variante=secondary (§4.4 lista 'secondary'). Confere com a decisão registrada em EXCEPTIONS.json Grupo 4c ('toolbar secondary preservam os pares tematicos anteriores'). Nome já correto.

<details><summary>o que a refutação derrubou neste grupo</summary>

- **`border-default (#1)`** — Campo 'quebra' cita src/index.css:103-104 para button.container.border-color (home-button-secondary), mas essas linhas não contêm esse token no arquivo atual — número copiado do dossiê desatualizado sem reverificação.
  - evidência: `grep -n mostra --theme-home-button-secondary-border/-border-hover em src/index.css:116-117 (tema light) e :230 (dark); as linhas 103-104 atuais contêm --theme-checklist-item-bg-hover e --theme-checklist-item-text (tokens de checklist, não d`
  - correção: Corrigir a citação para src/index.css:116-117.
- **`border-faint (#2)`** — nomeSugerido 'chart.backdrop.fill.hover' aplica sufixo de estado .hover sem existir o par default 'chart.backdrop.fill' — viola §5.4 do próprio GRAMMAR ('estado só existe se houver o par default'), o mesmo defeito de delta-zero que o documento usa como exemplo canônico.
  - evidência: `CustomTooltip.jsx:46 define cursor={{fill:'var(--color-border-faint)', opacity:'0.15'}} como valor único e constante — não existe um 'chart.backdrop.fill' base diferente que este .hover estenda; a exibição é condicionada pelo React/Recharts`
  - correção: Remover o sufixo de estado (estado omitido = default): nomear apenas 'chart.backdrop.fill'.
- **`border-inverse (#3)`** — Citação 'tts.jsx:131' está errada; e a fração '~15/18 sites' subestima o padrão dominante.
  - evidência: `grep confirma border-border-inverse em src/pages/GeneralSettings/AudioPreference/tts.jsx:128, não :131. Dos 18 usos, 17 (não ~15) compartilham o padrão idêntico border-b-2 border-border-inverse/10 (confirmado também em EmbeddingTextSplitter`
  - correção: Corrigir a linha para tts.jsx:128 e a fração para 17/18.
- **`border-subtle (#5)`** — Citação 'GeneralSettings/AgentConfig/index.jsx:97,114' referencia um caminho que não existe; e as linhas citadas em DesignSystem/index.tsx (94,96,216) e parts.tsx (181,197,213,272-273) não correspondem a border-subtle no arquivo atual — dossiê ficou desatualizado após edições no arquivo e o revisor não reverificou.
  - evidência: `O componente real é src/pages/WorkspaceSettings/AgentConfig/index.jsx (focus:ring-border-subtle confirmado nas linhas 97 e 114 desse caminho); 'src/pages/GeneralSettings/AgentConfig' não existe (find sem resultado). Em DesignSystem/index.ts`
  - correção: Corrigir o path para src/pages/WorkspaceSettings/AgentConfig/index.jsx:97,114 e atualizar as linhas dos dois arquivos DesignSystem para os números confirmados acima.
- **`content-disabled (#7)`** — Owner 'attachment' é forçado para AccountModal/index.jsx:103, mas esse elemento é um upload de FOTO DE PERFIL (label+input type=file para pfp) — o owner correto já existente no vocabulário §4.1 é 'avatar' (Identidade e feedback), não 'attachment' (Conteúdo, associado a anexos de chat).
  - evidência: `src/components/UserMenu/AccountModal/index.jsx:99-113 — <label className='...cursor-pointer'><input id='logo-upload' type='file' accept='image/*' onChange={handleFileUpload}/>{pfp ? <img .../> : ...}</label>, dentro do form de edição de per`
  - correção: Separar: avatar.container.border-color (AccountModal, upload de foto de perfil) vs owner distinto para UploadFile/index.jsx (dropzone react-dropzone de documentos do workspace) — não fundir os dois sob 'attachment' sem justificar por que 'avatar' não se aplica ao primeiro.
- **`content-info (#8)`** — Citação 'Citation/index.jsx:199' está desatualizada.
  - evidência: `grep confirma hover:text-content-info em src/components/WorkspaceChat/ChatContainer/ChatHistory/Citation/index.jsx:210, não :199.`
  - correção: Corrigir para Citation/index.jsx:210.
- **`content-inverse (#9)`** — O nome único 'chat-message.helper.color' é sustentado citando AccountModal/index.jsx:160,180 como evidência, mas esse site NÃO é contexto de chat-message — é legenda de campo (helper text) sob os inputs de username/senha do formulário de perfil (AccountModal). Viola a própria §5.1 que o dossiê aplica em outros itens deste mesmo trabalho ('owner vem do contexto renderizado; mesmo valor, contratos diferentes').
  - evidência: `src/components/UserMenu/AccountModal/index.jsx:151-161 — <input placeholder=.../><p className='mt-2 text-xs text-content-inverse/60'>{t('common.username_requirements')}</p>, dentro de <form onSubmit={handleUpdate}> do AccountModal; não pert`
  - correção: Separar: field.helper.color (AccountModal:160,180) vs chat-message.helper.color (ClarifyingQuestion/SurveyBody.jsx:6,21).
- **`content-primary (#12)`** — classeSugerida 'text-search-suffix-fill-hover' usa o prefixo Tailwind 'text-' (propriedade color) para um token cuja própria propriedade declarada no identificador é 'fill' — inconsistência interna; a propriedade CSS real no site sequer é fill de SVG, é background-color via mask.
  - evidência: `src/index.css:1106,1119 — background-color: var(--color-content-tertiary) / var(--color-content-primary), dentro de .search-input::-webkit-search-cancel-button (linha 1100) e :hover (linha 1118).`
  - correção: Se mantiver a propriedade 'fill' no id, o prefixo correto é 'fill-search-suffix-fill-hover'; se adotar a propriedade real (background-color, como o próprio CSS faz), o id deveria ser 'search.suffix.background-color.hover' → classe 'bg-search-suffix-background-color-hover'.
- **`content-secondary (#13)`** — ServerPanel.jsx:239 é descrito como 'card de servidor indisponível', mas o elemento real é um <button> (componente ServerTool) cuja borda reflete se uma FERRAMENTA individual está habilitada/desabilitada via toggle — não disponibilidade do servidor. O owner sugerido 'card' contradiz o DOM real.
  - evidência: `src/pages/Admin/Agents/MCPServers/ServerPanel.jsx:228-240 — function ServerTool({...}) { return (<button type='button' onClick={() => setOpen(!open)} className={... enabled ? 'border-theme-text-secondary' : 'border-content-secondary/50 opac`
  - correção: Trocar owner para button (ex.: button.container.border-color.disabled), consistente com o DOM real (<button>, não card/div).
- **`content-warning (#16)`** — Afirma 'mesmo elemento usa border-content-warning E text-content-warning' em Introduction/index.jsx:38, mas text-content-warning está num <a> ANINHADO dentro do <Trans> (linha 45) — elemento DOM diferente do <p> container que carrega border-content-warning (linha 38).
  - evidência: `src/pages/GeneralSettings/CommunityHub/ImportItem/Steps/Introduction/index.jsx:38 <p className='...border-content-warning text-content-primary'> vs linha 45 <a href={...} className='underline text-content-warning light:text-content-warning `
  - correção: Corrigir a descrição para 'mesmo componente/banner, dois elementos distintos (container p + link a aninhado)', não 'mesmo elemento'; isso não muda o veredito INADEQUADO nem a quebra proposta, só a precisão da evidência.

</details>

### 3.7 grupo `07-owners-c`

> **Refutação:** `CORRIGIR` — 4 confirmados, 4 refutados, 0 omitidos.

#### 101. `menu-container` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#FCFCFB` · dark `#21252B` |
| **usos** | 1 |
| **propriedades** | bg (background-color): 1/1 uso — 100% |
| **nome sugerido** | `popover.container.background-color` |
| **classe** | `bg-popover-container-background-color` |
| **risco** | Pixel-idêntico — troca de nome/var, mesmo hex nos dois temas (FCFCFB/21252B). |

**Onde está aplicado.** Único consumidor real: src/components/Sidebar/SearchBox/index.jsx:145 — a função `SearchResultWrapper`, um <div> `absolute` posicionado logo abaixo do campo de busca da sidebar (classe `popover-ring absolute inset-x-px top-[6.2%] ... bg-menu-container ...`), que envolve a lista de resultados (`SearchResults`/`SearchResultCategory`/`SearchResultItem`, linhas 151-234): categorias 'Workspaces'/'Threads' com `<Link>` de navegação, aparece só quando o termo de busca tem ≥3 caracteres. Não é lista de AÇÕES (sem `role="menu"`, sem botões de comando) — é o painel de resultados do próprio widget de busca da sidebar.

**Por quê.** Owner atual ('menu') vem do NOME antigo, não do contexto renderizado (§5.1). Duas alternativas óbvias estão BLOQUEADAS por colisão de valor com identificadores já existentes na fonte DTCG: (a) 'menu.container.background-color' já existe com F7F7F7/2A2C32 (tokens #2/#3/#4, família ChatSettingsMenu/CardMenu — menu de AÇÕES, arquétipo diferente); (b) 'search.container.background-color' já existe com F7F7F7/2A2C32 (component.light.search, usado no campo de filtro do AgentSkills, ToolsMenu/Tabs/AgentSkills/index.jsx:288) — também não bate o valor. Por eliminação, o único slot do vocabulário fechado que já carrega FCFCFB/21252B é 'popover' (`component.light.popover.bg`, descrição da própria fonte: "Fundo de menu/popover"), a mesma família genérica de painel-flutuante-elevado usada por ActionMenu/ModelTable/ReasoningEffort (ver token #5). Owner=popover, anatomia=container (sem partes distinguíveis neste token), propriedade=background-color.

#### 102. `menu-container-background-color` — ✅ **OK**

| | |
|---|---|
| **valor** | light `#F7F7F7` · dark `#2A2C32` |
| **usos** | 4 |
| **propriedades** | bg (background-color): 4/4 usos — 100% |
| **risco** | Nenhum — já está correto. |

**Onde está aplicado.** 4 flyouts de AÇÕES, todos dropdown/menu: (1) ChatSettingsMenu/index.jsx:53 — popover do ícone de engrenagem no header do chat (contém TextSizeRow/MemoriesRow/ExportRow/CopyLinkToChatRow); (2) MemoriesSidebar/MemoryCard/CardMenu/index.jsx:38 — menu kebab (Editar/Mover/Excluir) de um card de memória, renderizado via portal; (3) ChatSettingsMenu/Export/index.jsx:74 — submenu de formatos de exportação (PDF/Markdown/...); (4) ChatSettingsMenu/TextSize/index.jsx:60 — submenu de tamanho de texto (Small/Normal/Large).

**Por quê.** Owner=menu correto: os 4 sites são literalmente menus/submenus de ação (lista de comandos abertos por um botão de gatilho), o arquétipo 'Sobreposição: menu' do §4.1. Anatomia=container (painel inteiro, sem sub-partes distintas neste leaf — os estados de linha vivem nos tokens #3/#4). Propriedade=background-color. O path já bate 1:1 com a fonte DTCG (`component.light.menu.container.background-color`) e com a regra de achatamento de `build-tokens.mjs:229` (`menu-container-background-color`). Nada a corrigir na forma.

#### 103. `menu-row-background-color-active` — ✅ **OK**

| | |
|---|---|
| **valor** | light `#F7F7F7` · dark `#2A2C32` |
| **usos** | 2 |
| **propriedades** | bg (background-color): 2/2 usos — 100% |
| **risco** | Nenhum — já está correto. |

**Onde está aplicado.** 2 linhas-gatilho de submenu dentro do ChatSettingsMenu (mesma família do token #2), destacadas ENQUANTO seu próprio submenu está aberto por hover: Export/index.jsx:55 (linha 'Export' quando `showSubmenu` é true) e TextSize/index.jsx:35 (linha 'Tamanho do texto' quando seu submenu está aberto).

**Por quê.** Owner=menu (mesma família do #2), anatomia=row (linha da lista, não o painel inteiro), propriedade=background-color, estado=active — todos do vocabulário fechado §4.2/§4.5. Bate com `component.light.menu.row.background-color.active` ('Fundo da linha que mantem um submenu aberto por hover'). Nota: a própria fonte documenta que este grupo não tem `$root`/default explícito ('criar um alteraria a API pública') — decisão já tomada e registrada, não é defeito de nomeação deste token; o estado de repouso da linha é 'sem fundo' (transparente), tratado por `hover:bg-surface-hover` fora deste contrato.

#### 104. `menu-row-background-color-selected` — ✅ **OK**

| | |
|---|---|
| **valor** | light `#F7F7F7` · dark `#2A2C32` |
| **usos** | 4 |
| **propriedades** | bg (background-color): 4/4 usos — 100% |
| **risco** | Nenhum — já está correto. |

**Onde está aplicado.** 4 itens 'atualmente escolhido' dentro de listas dropdown: TextSizeMenu/index.jsx:79 (opção de tamanho selecionada), PromptInput/ToolsMenu/index.jsx:194 (aba ativa do menu de ferramentas do prompt), PromptInput/LLMSelector/LLMSelector/index.jsx:35 (provider de LLM selecionado no painel lateral), ChatSettingsMenu/TextSize/index.jsx:67 (opção de tamanho selecionada dentro do submenu do gear-icon).

**Por quê.** Owner=menu, anatomia=row, propriedade=background-color, estado=selected — bate com `component.light.menu.row.background-color.selected`. Os 4 consumidores são estruturalmente equivalentes (linha escolhida dentro de uma lista tipo dropdown), mesmo que os PAINÉIS-PAI de 2 deles (TextSizeMenu, ToolsMenu) ainda usem `bg-surface-elevated` cru em vez de um token de container próprio — isso é lacuna de OUTRO token (fora do escopo dos 8 aqui), não deste.

#### 105. `popover-bg` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#FCFCFB` · dark `#21252B` |
| **usos** | 5 |
| **propriedades** | var(): 4/5 usos (bridges legadas em index.css) — 80%; bg: 1/5 uso (Tailwind direto) — 20% |
| **nome sugerido** | `popover.container.background-color` |
| **classe** | `bg-popover-container-background-color` |
| **risco** | Pixel-idêntico para o rename direto (ReasoningEffort, mesmo hex). Não altera os 9+ consumidores do bridge `--theme-action-menu-bg` (variável diferente, fora deste token). |

**Onde está aplicado.** Consumo DIRETO real: PromptInput/ChatContainer/PromptInput/ReasoningEffort/index.jsx:221 — `className="...bg-popover-bg!...popover-ring"` no `<Tooltip>` (react-tooltip) que envolve `ReasoningEffortMenu`, um `<div role="menu">` (linha 270) com opções `role="menuitemradio"` (linha 282) para o nível de esforço de raciocínio do modelo; o próprio código comenta 'SUPERFÍCIE DO MENU' (linhas 190-207) sobre este exato bg. Os outros 4 sites (index.css:50,62,148,176) são atribuições de variáveis-PONTE legadas: `--theme-popup-menu-bg` (0 consumidores reais, morta) e `--theme-action-menu-bg` (9+ consumidores reais: ActionMenu de mensagem, ModelTable kebab menu, AgentBuilder AddBlockMenu/BlockList, MCPServers ServerPanel, AgentFlows FlowPanel, ImportedSkillConfig, ChatPromptHistory — um drawer fixo — e o botão de toggle do SettingsSidebar).

**Por quê.** Forma atual ('popover.bg', 2 segmentos) não tem anatomia e usa propriedade abreviada 'bg', fora do vocabulário fechado §4.3 (precisa ser 'background-color'). Owner=popover está correto por eliminação (ver token #1): a própria fonte já descreve este valor como "Fundo de menu/popover" e ele é hoje o fundo genérico de painel-flutuante-elevado reaproveitado em toda a base. IMPORTANTE (achado correlato, fora do escopo deste token): o bridge `--theme-action-menu-bg` que herda este valor alimenta 9+ componentes reais que cruzam owners incompatíveis entre si (button no SettingsSidebar, drawer no ChatPromptHistory, e vários menus de ação distintos) — isso é um problema do token `--theme-action-menu-bg` em si (fora dos 8 numerados aqui), não corrigível só renomeando `popover-bg`; sinalizo para o dono tratar numa rodada futura.

#### 106. `popover-border` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#E8E8E8` · dark `#4F555E` |
| **usos** | 2 |
| **propriedades** | var(): 2/2 usos — 100% |
| **nome sugerido** | `popover.container.border-color` |
| **classe** | `bg-popover-container-border-color (var --color-popover-container-border-color, consumida via var() dentro de .popover-ring, igual hoje)` |
| **risco** | Pixel-idêntico se os 3 tokens da quebra mantiverem o mesmo valor inicial E8E8E8/4F555E. Risco real é de ENGENHARIA, não de pixel: hoje `.popover-ring` é 1 classe CSS só; separar por owner exige duplicá-la em variantes (`.menu-ring`/`.popover-ring`) ou aceitar 1 classe consumindo N vars — decisão de  |

**Onde está aplicado.** index.css:1476-1479 — regra compartilhada `.popover-ring` (box-shadow hairline 0,5px + sombra), aplicada como CLASSE (não Tailwind bg-/border-) em pelo menos 2 famílias de owner já classificadas de forma diferente neste dossiê: owner=menu (ChatSettingsMenu/index.jsx:53, CardMenu/index.jsx:38) E owner=popover (SearchBox/index.jsx:145, ModelTable/index.jsx:281, ReasoningEffort's Tooltip className linha 221). Consumo adicional isolado: ReasoningEffort/index.jsx:218 — `arrowColor` da seta do tooltip, só no tema light (dark usa `--color-surface-raised`, outro token) — anatomia diferente (caret, não container).

**Por quê.** Mesmo defeito do H-021 citado no §2 do GRAMMAR: 1 valor servindo owners incompatíveis (menu E popover) através de 1 classe CSS compartilhada (`.popover-ring`, ~23 consumidores per comentário do próprio SearchBox/index.jsx:75). Precisa QUEBRAR — ver campo `quebra`. Nenhum dos 2 owners (menu, popover) tem hoje um `border-color` já definido na fonte DTCG (confirmado: `component.light.menu` só tem `container.background-color` e `row.background-color.{active,selected}` — sem border), então a quebra NÃO colide com valor nenhum já comprometido; é puramente uma decisão de arquitetura (1 classe por owner vs. 1 classe genérica com var compartilhada).

**⚠ Precisa QUEBRAR** — serve owners incompatíveis (§5.1):

- `menu.container.border-color, popover.container.border-color, popover.caret.border-color`

#### 107. `prompt-bg` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#FCFCFB` · dark `#21252B` |
| **usos** | 3 |
| **propriedades** | var(): 2/3 usos (bridge --theme-bg-chat-input em index.css) — 67%; bg: 1/3 uso (Tailwind direto) — 33% |
| **nome sugerido** | `prompt.container.background-color` |
| **classe** | `bg-prompt-container-background-color` |
| **risco** | Pixel-idêntico — troca de nome/var, mesmo hex nos dois temas. |

**Onde está aplicado.** Consumo DIRETO real: PromptInput/index.jsx:345 — `<div className="bg-prompt-bg prompt-box rounded-bubble ...">`, a caixa de composição do chat (textarea + toolbar) na tela de conversa — é literalmente 'a caixa do prompt', conforme a própria descrição DTCG ('a UNICA superficie que se eleva acima da pagina'). Os outros 2 sites (index.css:32/135, `--theme-bg-chat-input`) alimentam um bridge legado consumido por owners TOTALMENTE diferentes fora deste token (UserIcon — borda do avatar; QuickActions — pílula de ação rápida; MarkdownRenderer x2 — blockquote) — reuso coincidente de valor via OUTRA variável, não uma quebra deste token.

**Por quê.** Owner=prompt já correto (Conteúdo, §4.1) e único consumidor Tailwind direto é de fato a caixa do prompt. Defeito é só de FORMA: 'prompt.bg' tem 2 segmentos (falta anatomia 'container') e propriedade abreviada 'bg' (precisa ser 'background-color', §4.3).

#### 108. `prompt-ring` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#BEBEBE` · dark `#606060` |
| **usos** | 3 |
| **propriedades** | var(): 3/3 usos (dentro de color-mix() em box-shadow) — 100% |
| **nome sugerido** | `prompt.container.box-shadow` |
| **classe** | `prompt-container-box-shadow (consumida via var(--color-prompt-container-box-shadow) dentro de color-mix(), igual hoje — não é utilitário bg-/border- Tailwind)` |
| **risco** | Pixel-idêntico se os 3 tokens da quebra mantiverem o valor inicial BEBEBE/606060. Engenharia real: `.prompt-box` hoje é 1 classe CSS só com 3 estados; separar por owner exige 3 classes (ou 3 vars sob 1 classe) — mesma decisão de arquitetura do token #6. |

**Onde está aplicado.** Consumido só via a classe CSS compartilhada `.prompt-box`/`:hover`/`:focus-within` (index.css:1441,1462,1469, alphas 45%/70%/70%), aplicada em 3 owners REALMENTE distintos: (1) PromptInput/index.jsx:345 — a caixa de composição do chat (owner=prompt); (2) SearchBox/index.jsx:106 — `<input type="search">`, o campo de busca da sidebar (owner=search); (3) SearchBox/index.jsx:259 — botão redondo 'New workspace' com ícone FolderPlus (owner=button). O próprio código admite o reuso ('prompt-box = MESMO tratamento de contorno da caixa do prompt, reusado como esta... 23 consumidores de .popover-ring + .prompt-box').

**Por quê.** 1 valor servindo 3 owners incompatíveis por vocabulário (prompt é Conteúdo; search e button são Controles — categorias distintas no §4.1), exatamente o padrão que o §2 do GRAMMAR proíbe. A descrição DTCG de `component.light.prompt.ring` ('Cor do anel hairline da caixa do prompt') já subdocumenta o uso real: menciona só 1 dos 3 owners. Precisa QUEBRAR — ver campo `quebra`.

**⚠ Precisa QUEBRAR** — serve owners incompatíveis (§5.1):

- `prompt.container.box-shadow, search.container.box-shadow, button.container.box-shadow`

<details><summary>o que a refutação derrubou neste grupo</summary>

- **`menu-container (#1) / popover-bg (#5)`** — Owner 'popover' foi escolhido por ELIMINAÇÃO DE VALOR ('qual identificador de vocabulário já carrega o hex FCFCFB/21252B'), não estritamente pelo CONTEXTO RENDERIZADO como §5.1 exige ('o owner vem do contexto renderizado, não do valor'). Para o caso do ReasoningEffort (token #5), a alternativa de vocabulário fechado 'tooltip' (§4.1, categoria Sobreposição) nunca foi sequer avaliada nem descartada com justificativa, apesar de evidência estrutural direta a favor dela.
  - evidência: `src/components/WorkspaceChat/ChatContainer/PromptInput/ReasoningEffort/index.jsx:208-221 — o elemento que recebe `bg-popover-bg!` é literalmente um componente `<Tooltip>` do react-tooltip (não uma div genérica), com prop `arrowColor` (linha`
  - correção: Antes de resolver por eliminação de valor, avaliar explicitamente 'tooltip' como owner candidato para o container do ReasoningEffort (mecanismo real = componente <Tooltip> + arrowColor), e declarar `decisao: PENDENTE` (§5.5) com o motivo se a escolha entre popover/tooltip/menu depender de critério d
- **`popover-border (#6)`** — Propriedade sugerida 'border-color' para AMBOS os splits do `quebra` (`popover.container.border-color` e `popover.caret.border-color`) não bate com o mecanismo CSS real medido. Nenhum dos 2 consumos reais de `--color-popover-border` usa `border-color`.
  - evidência: `src/index.css:1476,1479 — `var(--color-popover-border)` é consumido DENTRO de `box-shadow` (color-mix), no seletor `.popover-ring`, exatamente a MESMA técnica de hairline-ring que o próprio dossiê classifica como propriedade 'box-shadow' no`
  - correção: Renomear para `popover.container.box-shadow` (consistente com o mecanismo real e com o critério já aplicado ao token #8 no mesmo dossiê) e `popover.caret.background-color` (ou `fill`, §4.3, se o dono preferir tratar como preenchimento de forma) para o consumo via arrowColor — nunca `border-color`, q
- **`popover-border (#6)`** — `classeSugerida` ('bg-popover-container-border-color (var --color-popover-container-border-color, consumida via var() dentro de .popover-ring, igual hoje)') está errada em dois níveis: (a) nenhum dos 2 consumos reais usa uma classe Tailwind `bg-`/`border-`/`text-` — ambos consomem via `var()` cru (CSS puro e string JS em `arrowColor`); (b) mesmo se fosse consumido como utilitário Tailwind, o prefixo correto para uma propriedade border-color seria `border-`, não `bg-`. O próprio dossiê aplica o t
  - evidência: ``grep -rn "border-popover\|bg-popover-border\|text-popover-border" src/` = 0 ocorrências em toda a árvore. Os únicos 2 consumos reais de `--color-popover-border` são index.css:1479 (dentro de box-shadow) e ReasoningEffort/index.jsx:218 (str`
  - correção: Seguir o mesmo padrão do token #8: declarar a forma bruta da custom property (`popover-container-box-shadow` / `popover-caret-background-color`, consumida via `var()`), com a mesma nota explícita 'não é utilitário bg-/border- Tailwind' usada no token #8, em vez de inventar uma classe `bg-` que não e
- **`prompt-bg (#7)`** — Citação 'index.css:32/135' para o bridge `--theme-bg-chat-input: var(--color-prompt-bg)` não bate com o conteúdo real dessas linhas (falha o teste 'ondeEstaAplicado é real?').
  - evidência: ``sed -n '28,45p;130,155p' src/index.css` mostra que as linhas 32 e 135 contêm, na verdade, o comentário sobre `--theme-bg-container: var(--color-app-bg)` ('era surface-sunken... o shell de 32 arquivos, entao a correcao e nesta variavel'). O`
  - correção: Corrigir a citação para index.css:40 e :151. Não muda o veredito de nome/propriedade (owner=prompt, forma curta→longa continuam corretos), mas a evidência como citada hoje não é auditável no path:linha informado.

</details>

### 3.8 grupo `08-owners-d`

> **Refutação:** `CORRIGIR` — 7 confirmados, 5 refutados, 0 omitidos.

#### 109. `avatar-container-background-color` — ✅ **OK**

| | |
|---|---|
| **valor** | light `#EDECE8` · dark `#2A2C32` |
| **usos** | 1 |
| **propriedades** | bg: 1 |
| **risco** | Nenhum — nome já correto, zero mudança de classe ou valor. |

**Onde está aplicado.** Círculo de avatar-fallback (mostra a inicial do usuário) na lista de usuários aprovados/pendentes do bot do Telegram — src/pages/GeneralSettings/Connections/TelegramBot/ConnectedView/UsersSection/index.jsx:99, `<div className="bg-avatar-container-background-color size-8 rounded-full flex items-center justify-center shrink-0">{initial}</div>`. Único owner (UsersSection).

**Por quê.** Owner 'avatar' está no vocabulário fechado (Identidade e feedback, §4.1). Anatomia 'container' correta — o círculo não tem partes distinguíveis além do próprio fundo. Propriedade 'background-color' compatível com o único uso real (bg do círculo).

#### 110. `badge-container-background-color` — ✅ **OK**

| | |
|---|---|
| **valor** | light `#F7F7F7` · dark `#2A2C32` |
| **usos** | 3 |
| **propriedades** | bg: 3 |
| **risco** | Nenhum. |

**Onde está aplicado.** 3 sites: (a) selo 'MCP' ao lado do nome de uma seção de skills no menu de ferramentas do prompt — src/components/WorkspaceChat/ChatContainer/PromptInput/ToolsMenu/Tabs/AgentSkills/SkillSection/index.jsx:46 (`bg-badge-container-background-color/50` num `<span>` texto-micro); (b) quadrado com a extensão do arquivo (ex. 'TXT') no card de download de arquivo do chat — src/components/WorkspaceChat/ChatContainer/ChatHistory/FileDownloadCard/index.jsx:119 (caso default de getFileDisplayInfo, campo badgeBg); (c) mesmo quadrado de extensão no card de arquivo gerado por job agendado — src/pages/GeneralSettings/ScheduledJobs/components/GeneratedFileCard.jsx:61 (FILE_DISPLAY_MAP.default.bg).

**Por quê.** Owner 'badge' está no vocabulário (Dados, §4.1). As 3 aplicações são selos/etiquetas pequenas — mesmo CONCEITO badge em 3 componentes diferentes, não é surface/semantic disfarçado. Anatomia 'container', propriedade 'background-color' compatíveis nos 3.

#### 111. `badge-container-background-color-secondary` — ✅ **OK**

| | |
|---|---|
| **valor** | light `#EDECE8` · dark `#2A2C32` |
| **usos** | 2 |
| **propriedades** | bg: 2 |
| **risco** | Nenhum. |

**Onde está aplicado.** Selo 'CPU' (tipo de dispositivo) na tabela de modelos de IA locais — src/components/lib/ModelTable/index.jsx:123 e :147 (`DeviceTypeTagWrapper` com `bgClass="bg-badge-container-background-color-secondary"`), contrastando com os selos GPU (`bg-success`) e NPU (`bg-info`). Aparece em GeneralSettings > páginas de preferência de LLM/embedding locais.

**Por quê.** Mesmo owner 'badge' do token #2; variante 'secondary' (§4.4) usada corretamente para diferenciar o selo neutro 'CPU' dos selos semânticos coloridos (success/info) dos outros tipos de dispositivo — mesma anatomia (container) e propriedade do owner badge.

#### 112. `banner-container-background-color` — ✅ **OK**

| | |
|---|---|
| **valor** | light `#F7F7F7` · dark `#2A2C32` |
| **usos** | 1 |
| **propriedades** | bg: 1 |
| **risco** | Nenhum na renomeação. Fora do escopo de naming: os tokens #4 e #5 parecem ser DUAS METADES do MESMO contrato (banner de perigo do SQLConnectionModal), split apenas por causa de uma troca de classe condicional por tema (`light:`) em vez de um único token com dois valores — vale revisão de arquitetura |

**Onde está aplicado.** Fundo do banner de aviso (ícone AlertOctagon + texto de warning i18n 'agent.sql_connection.warning') ao trocar o engine de conexão SQL — src/pages/Admin/Agents/SQLConnectorSelection/SQLConnectionModal.jsx:308, `border border-content-danger bg-banner-container-background-color light:bg-banner-container-background-color-destructive/15 p-4 rounded-lg ...`. Único consumidor: modal Admin > Agents > SQL Connector.

**Por quê.** Owner 'banner' está no vocabulário (Identidade e feedback), anatomia 'container', propriedade 'background-color' corretas. NOTA que não muda o veredito de nome: este valor só é usado no tema ESCURO deste banner — no tema claro o componente troca via `light:` para a classe -destructive/15. Ou seja, hoje esta é a 'metade escura' de um único contrato de banner de perigo (o único owner sempre renderiza aviso/perigo), não uma variante neutra reaproveitada em outro lugar. É observação de arquitetura (possível consolidação com o token #5 num só `banner.container.background-color.destructive` com valor por tema), não uma violação de gramática de nome.

#### 113. `banner-container-background-color-destructive` — ✅ **OK**

| | |
|---|---|
| **valor** | light `#C62A2A` · dark `#2A2C32` |
| **usos** | 1 |
| **propriedades** | bg: 1 |
| **risco** | Nenhum. Ver nota cruzada no token #4 sobre possível consolidação (não obrigatória para o nome estar correto). |

**Onde está aplicado.** Mesmo banner de aviso do token #4 — src/pages/Admin/Agents/SQLConnectorSelection/SQLConnectionModal.jsx:308, aplicado só no tema LIGHT via `light:bg-banner-container-background-color-destructive/15` (vermelho a 15% de opacidade).

**Por quê.** Owner 'banner', anatomia 'container', propriedade 'background-color', variante 'destructive' (§4.4) — nome correto e o único consumidor é de fato um aviso destrutivo/de perigo (troca de engine de banco de dados apaga configuração).

#### 114. `card-container-background-color` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#F7F7F7` · dark `#2A2C32` |
| **usos** | 14 |
| **propriedades** | bg: 14 |
| **nome sugerido** | `card.container.background-color (para os 13 owners de conteúdo passivo); button.container.background-color (para DBEngine, estado default/não-selecionado, pareado com button.container.background-color.primary.selected apontado no token #18)` |
| **classe** | `bg-card-container-background-color (mantém para os 13); bg-button-container-background-color (novo, para DBEngine)` |
| **risco** | Para os 13 owners: nenhum (só confirma o nome atual). Para o DBEngine: é RENOMEAR, não mudar valor — hex #F7F7F7/#2A2C32 idêntico, só migra de owner 'card' para 'button'. |

**Onde está aplicado.** 13 dos 14 owners são blocos de conteúdo passivos, arredondados, com padding — 'card' de fato: bolha de aprovação de ferramenta (ToolApprovalRequest/index.jsx:69), bolha de pensamento do agente (ThoughtContainer/index.jsx:154), bolha de status/thinking (StatusResponse/index.jsx:29), card de job agendado criado (ScheduledJobCreatedCard/index.jsx:29), card de download de arquivo (FileDownloadCard/index.jsx:34), card de arquivo gerado (GeneratedFileCard.jsx:100), painel do construtor de cron (JobFormModal/CronBuilder.jsx:46), 5 cards do Community Hub Trending (generic.jsx:10, agentSkill.jsx:12, systemPrompt.jsx:12, slashCommand.jsx:12, agentFlow.jsx:11), painel do QR code de setup do bot Telegram (CreateBotSection/index.jsx:33). O 14º owner é diferente: DBEngine em SQLConnectionModal.jsx:528 é um `<button type="button">` CLICÁVEL, seletor de engine de banco (postgres/mysql/sql-server) com estado selecionado que troca para `bg-primary!` (ver token #18, cluster A) — `className={... ${active ? "bg-primary! text-content-on-active" : ""}}` sobre base `bg-card-container-background-color`.

**Por quê.** 13 owners batem: conteúdo passivo em painel arredondado = owner 'card' (Dados, §4.1), anatomia 'container', propriedade 'background-color' — ficam OK. O 14º (DBEngine) viola §5.1 (owner vem do contexto renderizado, não do valor/aparência): é um BOTÃO seletor com estado ligado/desligado, não um card estático — empresta o cinza neutro do card só porque parece visualmente parecido. Um botão com estado de seleção pertence ao owner 'button' (Controles, §4.1), não a 'card'.

**⚠ Precisa QUEBRAR** — serve owners incompatíveis (§5.1):

- `card.container.background-color — 13 owners (ToolApprovalRequest, ScheduledJobCreatedCard, FileDownloadCard, ThoughtContainer, StatusResponse, CronBuilder, GeneratedFileCard, generic/agentSkill/systemPrompt/slashCommand/agentFlow do HubItemCard, CreateBotSection)`
- `button.container.background-color — DBEngine (SQLConnectionModal.jsx:528), estado default do botão seletor de engine SQL`

#### 115. `chat-message-container-background-color` — ✅ **OK**

| | |
|---|---|
| **valor** | light `#F7F7F7` · dark `#2A2C32` |
| **usos** | 1 |
| **propriedades** | bg: 1 |
| **risco** | Nenhum. |

**Onde está aplicado.** Fundo da bolha de mensagem histórica do usuário no chat — src/components/WorkspaceChat/ChatContainer/ChatHistory/HistoricalMessage/index.jsx:105, `bg-chat-message-container-background-color rounded-bubble rounded-br-none px-4 py-3.5 max-w-[600px]`. Único owner.

**Por quê.** Owner 'chat-message' está no vocabulário (Conteúdo, §4.1), anatomia 'container' (a bolha não tem sub-partes coloridas aqui), propriedade 'background-color' — o nome já expressa exatamente o contrato: fundo da bolha da mensagem.

#### 116. `code-block-container-background-color` — ✅ **OK**

| | |
|---|---|
| **valor** | light `#F7F7F7` · dark `#2A2C32` |
| **usos** | 1 |
| **propriedades** | bg: 1 |
| **risco** | Nenhum. |

**Onde está aplicado.** Painel que mostra o payload JSON de uma chamada de ferramenta pendente de aprovação, dentro do card de aprovação de ferramenta do chat — src/components/WorkspaceChat/ChatContainer/ChatHistory/ToolApprovalRequest/index.jsx:156, `<div className="p-3 bg-code-block-container-background-color rounded-lg overflow-x-auto"><pre>...`.

**Por quê.** Owner 'code-block' no vocabulário (Conteúdo, §4.1), anatomia 'container', propriedade 'background-color' — é literalmente o fundo de um bloco/painel de código (JSON formatado).

#### 117. `code-block-container-background-color-secondary` — ✅ **OK**

| | |
|---|---|
| **valor** | light `#EDECE8` · dark `#2A2C32` |
| **usos** | 2 |
| **propriedades** | bg: 2 |
| **risco** | Nenhum. Ressalva: se o dono quiser distinguir explicitamente 'código inline' de 'bloco de código' no vocabulário no futuro, isso é decisão de EXPANDIR o vocabulário fechado — não uma correção de nome disponível hoje. |

**Onde está aplicado.** Fundo de trechos de código inline (`<code>`) no texto de instruções de configuração do bot do Telegram — src/pages/GeneralSettings/Connections/TelegramBot/SetupView/CreateBotSection/index.jsx:25 e :68, ex.: `<code className="bg-code-block-container-background-color-secondary px-1 py-0.5 rounded-sm text-content-primary" />` dentro de um `<Trans>`.

**Por quê.** Owner 'code-block' é o único disponível no vocabulário fechado para conteúdo de código — não existe owner 'inline-code'. O uso aqui é um `<code>` inline (não um painel), mas ainda é conteúdo de código; a variante 'secondary' (§4.4) distingue este chip inline do painel JSON do token #8, seguindo o mesmo padrão já usado em badge-container-background-color-secondary (token #3).

#### 118. `code-block-header-background-color` — ✅ **OK**

| | |
|---|---|
| **valor** | light `#F7F7F7` · dark `#2A2C32` |
| **usos** | 2 |
| **propriedades** | bg: 2 |
| **risco** | Nenhum. |

**Onde está aplicado.** Barra superior (com botão 'Copy block') dos blocos de código com syntax-highlight nas respostas do chat, renderizadas via markdown-it + highlight.js — src/utils/chat/markdown.js:28 e :46, `<div class="w-full flex items-center sticky top-0 ... bg-code-block-header-background-color px-4 py-2 ...">`.

**Por quê.** Owner 'code-block' (mesmo dos tokens #8/#9), anatomia 'header' (§4.2) — é exatamente a barra de cabeçalho do bloco de código, distinta do corpo/painel. Nome já expressa o contrato certo.

#### 119. `list-row-container-background-color` — ✅ **OK**

| | |
|---|---|
| **valor** | light `#F7F7F7` · dark `#2A2C32` |
| **usos** | 3 |
| **propriedades** | bg: 3 |
| **risco** | Nenhum. |

**Onde está aplicado.** 3 linhas de lista simples, nenhuma dentro de popover/menu: (a) linha de atalho de teclado — src/components/KeyboardShortcutsHelp/index.jsx:46; (b) linha de progresso de upload de arquivo — src/components/Modals/ManageWorkspace/Documents/UploadFile/FileUploadProgress/index.jsx:127 (`h-14 px-2 py-2 ... bg-list-row-container-background-color ...`); (c) linha de regra no construtor de roteamento de modelos — src/pages/GeneralSettings/ModelRouters/RuleBuilder/RuleRow/index.jsx:42.

**Por quê.** Owner 'list-row' no vocabulário (Dados, §4.1), anatomia 'container' (linha sem sub-partes coloridas aqui), estado default. Os 3 são linhas de lista de página comum (não estão dentro de popover/menu) — owner coerente nos 3.

#### 120. `list-row-container-background-color-active` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#F7F7F7` · dark `#2A2C32` |
| **usos** | 8 |
| **propriedades** | bg: 8 |
| **nome sugerido** | `menu.row.background-color.active (SlashCommandRow, SkillSection, SkillRow); PENDENTE para ModelTable — ver quebra` |
| **classe** | `bg-menu-row-background-color-active` |
| **risco** | Renomeia apenas — os 3 sites do Grupo 1 e o site do Grupo 2 mantêm os mesmos hex (#F7F7F7/#2A2C32), só migram de nome/owner. |

**Onde está aplicado.** 8 sites em 4 arquivos, dois grupos de contexto bem diferentes. Grupo 1 — DENTRO do popover flutuante `ToolsMenu` (src/components/WorkspaceChat/ChatContainer/PromptInput/ToolsMenu/index.jsx, `popover-ring absolute ... z-dropdown bg-surface-elevated ...`, linha 156): item de comando destacado por navegação de teclado (setas) — SlashCommandRow/index.jsx:41 (`highlighted ? "bg-list-row-container-background-color-active/50 light:bg-list-row-container-background-color-active" : ...`); cabeçalho de seção de skills destacado — SkillSection/index.jsx:24; linha de skill destacada — SkillRow/index.jsx:20. Grupo 2 — FORA de qualquer popover, na página de configuração de modelos: flash temporário (via classList.add/remove com setTimeout 800ms) na linha do modelo que acabou de ser tornado ativo — src/components/lib/ModelTable/index.jsx:220-227 (grid `grid-cols-[1fr_auto_1fr]` listando modelos).

**Por quê.** O próprio ToolsMenu já tem um token IRMÃO para o mesmo popover, com o owner correto: `bg-menu-row-background-color-selected` em TabButton (ToolsMenu/index.jsx:194) — prova, por precedente já existente no MESMO componente, que linhas dentro deste popover devem usar owner 'menu' + anatomia 'row' (§4.2), não 'list-row'. SlashCommandRow/SkillSection/SkillRow vivem dentro desse popover e usam o token errado. Já o uso em ModelTable é fora de qualquer popover — mas ambíguo se o owner correto ali é 'list-row' (lista simples) ou 'data-table' (o grid tem colunas nome/status/ações, mais parecido com dado tabular) — não há um data-table.row já emitido em nenhum outro lugar do repo que sirva de precedente comparável.

**⚠ Precisa QUEBRAR** — serve owners incompatíveis (§5.1):

- `menu.row.background-color.active — SlashCommandRow/index.jsx:41, SkillSection/index.jsx:24, SkillRow/index.jsx:20 (3 owners, todos dentro do popover ToolsMenu, evidenciado pelo token irmão bg-menu-row-background-color-selected já existente no mesmo arquivo ToolsMenu/index.jsx:194)`
- `[PENDENTE] list-row.container.background-color.active OU data-table.row.background-color.active — ModelTable/index.jsx:220 (flash de 'modelo ativo'`
- `ambíguo entre lista simples e tabela de dados, marcado PENDENTE em vez de chute, conforme §5.5)`

#### 121. `list-row-container-background-color-selected` — ✅ **OK**

| | |
|---|---|
| **valor** | light `#F7F7F7` · dark `#2A2C32` |
| **usos** | 2 |
| **propriedades** | bg: 2 |
| **risco** | Nenhum. |

**Onde está aplicado.** Fundo do botão de opção numerada quando escolhida numa pergunta de esclarecimento do agente (card de chat, NÃO um popover) — src/components/WorkspaceChat/ChatContainer/ChatHistory/ClarifyingQuestion/ChoiceForm.jsx:12 (OptionButton, `selected ? "bg-list-row-container-background-color-selected light:bg-surface-hover" : "bg-transparent hover:bg-surface-hover"`) e :41 (OtherRow, mesmo padrão para a opção 'Outro').

**Por quê.** Owner 'list-row' (Dados, §4.1) — lista de opções de resposta dentro de um card de chat, sem relação com popover/menu (diferente do token #12). Anatomia 'container', propriedade 'background-color', estado 'selected' com par default explícito no próprio código (`bg-transparent`) — respeita §5.4 (estado só existe se houver o par).

#### 122. `list-row-icon-background-color` — ✅ **OK**

| | |
|---|---|
| **valor** | light `#F7F7F7` · dark `#2A2C32` |
| **usos** | 2 |
| **propriedades** | bg: 2 |
| **risco** | Nenhum. |

**Onde está aplicado.** Badge circular com o número da opção (ou ícone Edit2 para 'Outro') dentro de cada linha de opção do mesmo ChoiceForm do token #13 — src/components/WorkspaceChat/ChatContainer/ChatHistory/ClarifyingQuestion/ChoiceForm.jsx:16 (`<span className="... w-7 h-7 rounded-lg bg-list-row-icon-background-color text-content-primary ...">{index + 1}</span>`) e :45 (ícone Edit2 na opção 'Outro').

**Por quê.** Mesmo owner 'list-row' do token #13, anatomia 'icon' (§4.2) — o pequeno slot numerado/ícone dentro da linha é uma parte distinguível do container da linha, propriedade 'background-color' compatível.

#### 123. `meter-fill` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#000000` · dark `#F7F7F7` |
| **usos** | 1 |
| **propriedades** | bg: 1 |
| **nome sugerido** | `meter.indicator.background-color` |
| **classe** | `bg-meter-indicator-background-color` |
| **risco** | Renomeia apenas — valor #000000/#F7F7F7 idêntico, só troca de owner (novo 'meter') e anatomia (fill→indicator). |

**Onde está aplicado.** Barrinha 'acesa' (preenchida) do medidor de 6 barras de intensidade de 'esforço de raciocínio', ao lado de cada nível no menu do botão de reasoning effort do campo de prompt — src/components/WorkspaceChat/ChatContainer/PromptInput/ReasoningEffort/index.jsx:256, função MedidorDeEsforco: `${aceso ? "bg-meter-fill" : "bg-meter-track"} h-[10px]`. Elemento `aria-hidden="true"` (decorativo, não interativo).

**Por quê.** 'meter' NÃO está no vocabulário fechado de owners (§4.1). Não é 'progress' — progress já tem contrato próprio nos tokens #20/#21 (barra contínua de contagem regressiva). Não é 'slider' — slider é elemento interativo/arrastável, e este medidor é `aria-hidden`, puramente decorativo, sem manipulação. É um indicador DISCRETO de nível (0 a 6 barras), papel distinto dos dois. Owner novo: 'meter' — justificativa: elemento visual dedicado a comunicar intensidade/nível ao lado de um rótulo de menu, sem equivalente interativo, medido em 1 único arquivo/owner (ReasoningEffort). Dentro da anatomia já existente (§4.2), a barra 'acesa' corresponde ao papel de 'indicator' (mesmo papel já usado em progress.indicator) — não existe anatomia 'fill' no vocabulário.

#### 124. `meter-track` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#7F7F7F` · dark `#7B8187` |
| **usos** | 2 |
| **propriedades** | bg: 2 |
| **nome sugerido** | `meter.track.background-color` |
| **classe** | `bg-meter-track-background-color` |
| **risco** | Renomeia apenas — valor #7F7F7F/#7B8187 idêntico, só troca de owner (novo 'meter', unificado com o token #15). |

**Onde está aplicado.** Barrinhas 'apagadas' do mesmo medidor de esforço de raciocínio — src/components/WorkspaceChat/ChatContainer/PromptInput/ReasoningEffort/index.jsx:256 (cor das barras preenchidas quando `!aceso`, nível não-ativo do menu) e :257 (barras não preenchidas, `h-[6px]`).

**Por quê.** Mesmo motivo do token #15 — owner 'meter' não existe no vocabulário fechado, precisa ser criado (owner novo, mesma justificativa). A anatomia 'track' já está no vocabulário (§4.2) e é a correta aqui (parte não-preenchida do medidor, mesmo papel de progress.track).

#### 125. `pill-container-background-color` — ✅ **OK**

| | |
|---|---|
| **valor** | light `#EDECE8` · dark `#2A2C32` |
| **usos** | 1 |
| **propriedades** | bg: 1 |
| **risco** | Nenhum. |

**Onde está aplicado.** Pílula (chip removível, com botão 'x') de cada ferramenta selecionada no formulário de criação/edição de job agendado — src/pages/GeneralSettings/ScheduledJobs/JobFormModal/ToolsSelector.jsx:314, `bg-pill-container-background-color flex gap-1.5 h-[26px] items-center justify-center px-3.5 py-0.5 rounded-full ...`.

**Por quê.** Owner 'pill' no vocabulário (Dados, §4.1), anatomia 'container', propriedade 'background-color' — nome já correto, é literalmente uma pílula/chip de seleção múltipla.

#### 126. `primary` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#E60F46` · dark `#E60F46` |
| **usos** | 36 |
| **propriedades** | border: 2, bg: 15, ring: 7, text: 12 |
| **nome sugerido** | `button.container.background-color.primary (cluster A, principal)` |
| **classe** | `bg-button-container-background-color-primary` |
| **risco** | Renomeia apenas — o hex de marca #E60F46 não muda em nenhum cluster, só passa a ser referenciado por 6 nomes owner-scoped em vez de 1 nome de papel compartilhado cru. |

**Onde está aplicado.** Token de MARCA (rosa/vermelho #E60F46, idêntico nos 3 blocos de tema em src/styles/generated/color-tokens.css:171,532,893 — não varia por tema) consumido diretamente como classes cruas (`bg-primary`, `text-primary`, `border-primary`, `ring-primary`, `hover:bg-primary`) por 18 owners heterogêneos. Clusters concretos: (A) BOTÃO com fundo de marca — variante 'brand' do componente Button, o próprio comentário do arquivo confirma: src/components/ui/Button/index.jsx:65-66 ('arquetipo de 2 sites: mesma função do confirm, na cor da marca' → `bg-primary text-primary-foreground ...`); botão de envio de attachment — ParsedFilesMenu/index.jsx:145 (`hover:bg-primary`); botões de submit de login — SingleUserAuth.jsx:113 e MultiUserAuth.jsx:89,164,345 (`bg-primary hover:bg-primary/90`); CTAButton/index.jsx:11; botão seletor de engine SQL ativo — SQLConnectionModal.jsx:529 (`active ? "bg-primary! text-content-on-active" : ""`, par do token #6). (B) ANEL DE FOCO de campo — `focus:ring-primary` em inputs de senha/PIN, 7 sites exatos: SingleUserAuth.jsx:97, MultiUserAuth.jsx:58,74,140,153,317,329. (C) TEXTO/LINK de ação dentro de card do Community Hub Trending — `hover:text-primary/80` no link 'Import →': UserItems/index.jsx:30, HubItems/index.jsx:75, generic.jsx:16, agentSkill.jsx:41, systemPrompt.jsx:34, slashCommand.jsx:41, agentFlow.jsx:35. (D) RÓTULO de radio marcado — `peer-checked/public:text-primary` e `peer-checked/private:text-primary` no seletor de visibilidade público/privado ao publicar um item no Hub: CommunityHub/PublishEntityModal/SlashCommands/index.jsx:210,216 e SystemPrompts/index.jsx:204,210 (labels de `<input type="radio">`). (E) ÍCONE de navegação — seta 'avançar' do wizard de onboarding: OnboardingFlow/Steps/index.jsx:82 (`group-hover:text-primary`). (F) BORDA de spinner — Preloader.jsx:18,29 (`border-primary border-t-transparent`, anel giratório de loading).

**Por quê.** 'primary' não é um identificador owner.anatomia.propriedade — é o token de PAPEL/marca de nível 2 (tier 'role', equivalente ao --primary do shadcn), consumido diretamente por 18 owners incompatíveis em 4 propriedades diferentes (bg/text/border/ring), sem nunca passar por um wrapper `owner.anatomia.propriedade.primary` como o próprio §6 do GRAMMAR.md prescreve (`button.container.background-color.primary.hover`). Cada cluster (A-F) é um owner/anatomia/propriedade diferente e precisa de nome próprio; usar 'primary' cru é exatamente o anti-padrão que a lei condena (equivalente a 'surface'/'semantic': carrega a cor certa mas não diz de quem ela é).

**⚠ Precisa QUEBRAR** — serve owners incompatíveis (§5.1):

- `button.container.background-color.primary[.hover|.selected] — cluster A (Button 'brand', ParsedFilesMenu, SingleUserAuth/MultiUserAuth submit, CTAButton, SQLConnectionModal DBEngine)`
- `field.container.outline-color.primary.focus — cluster B, 7 sites (SingleUserAuth/MultiUserAuth `focus:ring-primary`)`
- `button.label.color.primary.hover — cluster C (link 'Import →' nos HubItemCards)`
- `radio.label.color.primary.checked — cluster D (toggle público/privado no PublishEntityModal)`
- `button.icon.color.primary.hover — cluster E (seta do wizard de onboarding)`
- `[PENDENTE — owner novo 'spinner' ou reaproveitar 'progress'?] cluster F (Preloader.jsx, anel de loading — não há owner de spinner/loader no vocabulário fechado, e 'progress' tem anatomias track/indicator que não descrevem um anel giratório`
- `marco PENDENTE em vez de chutar, conforme §5.5)`

#### 127. `primary-foreground` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#FFFFFF` · dark `#FFFFFF` |
| **usos** | 7 |
| **propriedades** | text: 7 |
| **nome sugerido** | `button.container.color.primary` |
| **classe** | `text-button-container-color-primary` |
| **risco** | Renomeia apenas — branco #FFFFFF idêntico nos 3 temas, sem mudança de pixel. |

**Onde está aplicado.** Cor do texto/label de botões cujo fundo é o token #18 (bg-primary) — pareamento 1:1 em todos os 5 owners: botões de submit de SingleUserAuth.jsx:113 e MultiUserAuth.jsx:89,164,345; CTAButton/index.jsx:11; variante 'brand' do componente Button — src/components/ui/Button/index.jsx:66 (`bg-primary text-primary-foreground border-none ...`); botão de demonstração na página interna DesignSystem — src/pages/DesignSystem/index.tsx:254.

**Por quê.** Mesmo defeito estrutural do token #18 (nome de papel cru, não owner-scoped), mas aqui os 7 usos são TODOS o mesmo contrato: texto de botão pareado com fundo de marca — CONFIRMADO pelo próprio código-fonte do componente Button (comentário 'arquetipo de 2 sites: mesma função do confirm, na cor da marca', Button/index.jsx:64-66). Diferente do #18, aqui não há owners incompatíveis — é 1 cluster único, então não precisa de quebra, só de renomear para o owner-scope correto que os 5 sites já compartilham.

#### 128. `progress-indicator-background-color` — ✅ **OK**

| | |
|---|---|
| **valor** | light `#2563EB` · dark `#2563EB` |
| **usos** | 2 |
| **propriedades** | bg: 2 |
| **risco** | Nenhum. |

**Onde está aplicado.** Barra de progresso PREENCHIDA (azul) da contagem regressiva de timeout, em 2 cards de chat com prazo de resposta: aprovação de ferramenta — src/components/WorkspaceChat/ChatContainer/ChatHistory/ToolApprovalRequest/index.jsx:97 (`h-full bg-progress-indicator-background-color transition-none`); pergunta de esclarecimento do agente — src/components/WorkspaceChat/ChatContainer/ChatHistory/ClarifyingQuestion/index.jsx:14 (mesmo componente TimeoutProgressBar, reaproveitado).

**Por quê.** Owner 'progress' no vocabulário (Dados, §4.1), anatomia 'indicator' (parte preenchida, §4.2), propriedade 'background-color' — nome já correto; os 2 owners são exatamente o mesmo contrato conceitual (barra de timeout) reaproveitado em 2 cards.

#### 129. `progress-track-background-color` — ✅ **OK**

| | |
|---|---|
| **valor** | light `#F7F7F7` · dark `#2A2C32` |
| **usos** | 2 |
| **propriedades** | bg: 2 |
| **risco** | Nenhum. |

**Onde está aplicado.** Trilho de fundo da mesma barra de timeout do token #20 — ToolApprovalRequest/index.jsx:95 (`absolute bottom-0 left-0 right-0 h-1 bg-progress-track-background-color`) e ClarifyingQuestion/index.jsx:12.

**Por quê.** Owner 'progress' (mesmo do #20), anatomia 'track' (§4.2), propriedade 'background-color' — par perfeito com o token #20 (indicator+track sempre juntos nos 2 owners), respeita §5.4.

#### 130. `scrollbar-thumb` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#C1C7CD` · dark `#202026` |
| **usos** | 2 |
| **propriedades** | var(): 2 |
| **nome sugerido** | `scrollbar.thumb.background-color` |
| **classe** | `--mh-scrollbar-thumb-background-color (consumido hoje só via CSS puro/var(), não como classe Tailwind bg-*)` |
| **risco** | Renomeia apenas — hex #C1C7CD/#202026 idêntico, só migra de var(--color-scrollbar-thumb) para var(--mh-scrollbar-thumb-background-color) sob owner novo. |

**Onde está aplicado.** Cor do 'polegar' (thumb) da barra de rolagem customizada, aplicada globalmente via classe utilitária `.scrollbar-subtle` — src/index.css:1404 (`scrollbar-color: var(--color-scrollbar-thumb) var(--color-scrollbar-track)`) e :1414 (`background: var(--color-scrollbar-thumb)` no pseudo-elemento `::-webkit-scrollbar-thumb`). Consumido por qualquer contêiner com overflow que use essa classe (não amarrado a um componente único).

**Por quê.** 'scrollbar' não está no vocabulário fechado de owners (§4.1). É elemento de chrome do navegador (pseudo-elemento nativo via `::-webkit-scrollbar-thumb`), consumido de forma transversal (utilitário `.scrollbar-subtle` em qualquer contêiner com overflow, não um componente de produto único). As anatomias 'thumb' e 'track' JÁ estão no vocabulário fechado (§4.2), o que sugere que foram reservadas para exatamente este caso (ou slider). Owner novo: 'scrollbar' — justificativa: semântica própria (thumb/track de rolagem), uso transversal, sem overlap com nenhum owner existente.

#### 131. `scrollbar-thumb-hover` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#8E9297` · dark `#3A3F4B` |
| **usos** | 1 |
| **propriedades** | var(): 1 |
| **nome sugerido** | `scrollbar.thumb.background-color.hover` |
| **classe** | `--mh-scrollbar-thumb-background-color-hover` |
| **risco** | Renomeia apenas — hex #8E9297/#3A3F4B idêntico. |

**Onde está aplicado.** Cor do thumb da mesma scrollbar customizada do token #22, no hover — src/index.css:1418-1419, `.scrollbar-subtle::-webkit-scrollbar-thumb:hover { background: var(--color-scrollbar-thumb-hover); }`. NOTA: o dossiê marcou VALOR como '?'; resolvido diretamente em src/styles/generated/color-tokens.css:80,441,802.

**Por quê.** Mesmo motivo do token #22 — owner 'scrollbar' precisa ser criado (mesma justificativa). Aqui o estado 'hover' (§4.5) já tem par default correto (o próprio token #22), respeitando §5.4.

#### 132. `scrollbar-track` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `transparent` · dark `transparent` |
| **usos** | 2 |
| **propriedades** | var(): 2 |
| **nome sugerido** | `scrollbar.track.background-color` |
| **classe** | `--mh-scrollbar-track-background-color` |
| **risco** | Renomeia apenas. IMPORTANTE: o dossiê registrou VALOR como light=#000000/dark=#000000 nos dois temas, mas o valor REAL medido em src/styles/generated/color-tokens.css:81,442,803 é `transparent` nos 3 blocos de tema — o dossiê parece ter capturado um fallback do script de mineração, não o valor real. |

**Onde está aplicado.** Trilho da mesma scrollbar customizada dos tokens #22/#23 — src/index.css:1404 e :1410-1411, `.scrollbar-subtle::-webkit-scrollbar-track { background: var(--color-scrollbar-track); }`.

**Por quê.** Mesmo motivo dos tokens #22/#23 — owner 'scrollbar' precisa ser criado (mesma justificativa). Anatomia 'track' (§4.2) já correta.

<details><summary>o que a refutação derrubou neste grupo</summary>

- **`chatarea-bg (numero 2)`** — Citação de linha aproximada '~:500' para a segunda ocorrência de bg-chatarea-bg em ChatContainer/index.jsx não bate com o arquivo atual — a linha real é 527 (desvio de 27 linhas, não arredondamento trivial). O revisor corrigiu corretamente a primeira ocorrência (440→467, confere com o arquivo real) e Main/Home/index.jsx (314→317, confere), mas não reverificou esta segunda citação, mantendo essencialmente o valor obsoleto do dossiê original (que dizia :500).
  - evidência: `grep real em src/components/WorkspaceChat/ChatContainer/index.jsx mostra a segunda ocorrência de bg-chatarea-bg (variante 'com histórico') na linha 527: `className="bg-chatarea-bg flex-1 min-w-0 relative md:rounded-overlay text-content-prim`
  - correção: Citar src/components/WorkspaceChat/ChatContainer/index.jsx:527 (variante com histórico) em vez de '~:500'. Não invalida o veredito PENDENTE nem a lógica de §5.1/§4.2 (owner ainda ambíguo), apenas a precisão da evidência.
- **`sidebar-divider (numero 6)`** — Citação 'src/components/SettingsSidebar/index.jsx:169' para o segundo hairline (bg-sidebar-divider) está errada; a linha real é 171. Diferente do token 2, aqui não há hedge ('~'), a linha é apresentada como precisa — mas todas as OUTRAS 4 citações do mesmo token (Sidebar/index.jsx:40, SettingsSidebar:113, SettingsSidebar:158, UserFooter/index.jsx:82) foram corretamente reverificadas contra o arquivo atual e batem exatamente, confirmando que só esta ficou com o valor obsoleto do dossiê original.
  - evidência: `sed -n '105,175p' src/components/SettingsSidebar/index.jsx mostra `<div className="h-[1.5px] bg-sidebar-divider mx-3 mt-s12" />` na linha 171 (contagem exata via cat -n), não 169.`
  - correção: Citar src/components/SettingsSidebar/index.jsx:171. Não muda o veredito INADEQUADO nem a contagem de 5 usos (3 border + 2 bg), que está correta.
- **`sidebar-field-bg (numero 7)`** — Hex citados para a variante '-secondary' de button.container.background-color estão incorretos. O texto do 'risco' afirma '-secondary (#2A2C32/#FFFFFF)'; o CSS gerado real mostra --color-button-container-background-color-secondary = #FFFFFF no tema escuro e #F7F7F7 no tema claro — #2A2C32 nunca é o valor da variante secondary em nenhum tema (é o valor da variante BASE no escuro, não da secondary). Parece confusão entre a linha da base e a linha da secondary ao ler o bloco JSON/CSS.
  - evidência: `src/styles/generated/color-tokens.css:309 `--color-button-container-background-color-secondary: #FFFFFF;` (bloco escuro) e :670 `--color-button-container-background-color-secondary: #F7F7F7;` (bloco claro). Comparar com :303 `--color-button`
  - correção: Corrigir o par citado para escuro=#FFFFFF / claro=#F7F7F7. A conclusão do achado (nenhuma variante de button bate com #FCFCFB/#21252B de sidebar-field-bg) permanece verdadeira mesmo com a correção — não muda o veredito INADEQUADO nem o risco de criar variante nova para o botão.
- **`sidebar-item-active (numero 8)`** — A citação 'ChatSettingsMenu/Export' como consumidor de menu.row.background-color.selected está imprecisa — o arquivo real usa a classe bg-menu-row-background-color-ACTIVE (token irmão, mesmo valor #2A2C32/#F7F7F7, nome diferente), não '-selected'.
  - evidência: `src/components/WorkspaceChat/ChatContainer/ChatSettingsMenu/Export/index.jsx:55 `? "bg-menu-row-background-color-active"`. Confirmado também que --color-menu-row-background-color-active tem os mesmos valores (#2A2C32/#F7F7F7) que -selected `
  - correção: Remover 'ChatSettingsMenu/Export' da lista de consumidores de '-selected', ou trocar para '-active'. Não afeta a comparação central do achado (o tom canônico #2A2C32/#F7F7F7 vs o tom divergente #3A3E44/#E5E4E0 do ReasoningEffortMenu continua correta e comprovada por ToolsMenu + LLMSelector, que de f
- **`sidebar-item-hover (numero 10) — achado mais grave do lote`** — A 'correcao' proposta lista apenas 4 destinos (nav-item.hover dominante, menu.row.selected para TextSizeMenu, um owner button para EmbedRow, list-row.selected para ConnectorOption) mais uma decisão pendente para o NewThreadButton — mas OMITE pelo menos 2 arquivos reais / 4 sites que também consomem o mesmo valor via o alias --theme-sidebar-item-hover, já contados dentro do próprio 'var(): 22' do token mas nunca nomeados na análise: (a) o baseColor do MESMO componente Skeleton do ActiveWorkspaces
  - evidência: `src/components/Sidebar/ActiveWorkspaces/index.jsx:68 (`baseColor="var(--color-sidebar-item-hover)"`, irmã de :69 já documentada no token 8); src/components/CommunityHub/PublishEntityModal/SlashCommands/index.jsx:210 e :216 (`peer-checked/pu`
  - correção: Adicionar dois destinos à correção: um contrato skeleton.track.background-color (espelhando o skeleton.indicator.background-color já proposto no token 8) para ActiveWorkspaces/index.jsx:68; e um contrato toggle.container.background-color.selected (owner toggle, §4.1) para as 4 ocorrências do Communi

</details>

### 3.9 grupo `09-resto`

> **Refutação:** `CORRIGIR` — 1 confirmados, 7 refutados, 0 omitidos.

#### 133. `cockpit-calls-primary` — ⏸️ **PENDENTE**

| | |
|---|---|
| **valor** | light `#1E3A8A` · dark `#1E3A8A` |
| **usos** | 1 |
| **propriedades** | var(): 1 (definição em tailwind.config.js:55). Consumo REAL só existe via o alias Tailwind `royalblue` que aponta pra essa var: bg: 3 (Attachments/index.jsx:235, 251, 253). |
| **risco** | Pixel-idêntico SE o novo nome apontar pra uma var dedicada carregando o MESMO #1E3A8A (troca de identificador, não de valor). Risco de virar mudança visual: se alguém 'simplificar' reaproveitando a variante `info` já existente (bg-info = #2563EB, resolvido em tokens/color.tokens.json:4280-4281 via p |

**Onde está aplicado.** tailwind.config.js:55 define `royalblue: "var(--color-cockpit-calls-primary)"`. Essa var vem de `semantic.light/dark.cockpit.calls.primary` em tokens/color.tokens.json:4171-4183 — uma escala inteira de 6 métricas (attempts/calls/scheduledMeetings/completedMeetings/calendarPill/paceBar) para um dashboard 'cockpit' que NÃO existe em lugar nenhum do frontend (`grep -rln "cockpit" --include=*.jsx --include=*.tsx --include=*.js --include=*.ts .` fora de tailwind.config/tokens.js/color-tokens.css não retorna nada). O único consumo real é indireto: `bg-royalblue` é aplicado em `src/components/WorkspaceChat/ChatContainer/PromptInput/Attachments/index.jsx` dentro de `displayFromFile()` — a cor de fundo do quadrado 32×32 (`iconBgColor`) atrás do ícone de tipo de arquivo no chip de anexo da caixa de prompt do chat, para doc/docx (linha 235), png/jpg/jpeg (linha 251) e fallback genérico (linha 253). O mesmo `iconBgColor` também usa `bg-success` (linha 232, csv/xlsx) e `bg-magenta`/`bg-purple`/`bg-warn` para outras extensões — ou seja, é uma paleta categórica por tipo de arquivo dentro do MESMO owner/anatomia (attachment.icon.background-color), da qual este token é só a fatia 'azul/default'.

**Por quê.** O owner real (contexto renderizado, §5.1) é `attachment` — não `cockpit`, que nem está no vocabulário §4.1 e não tem nenhum render próprio no repo. Owner/anatomia/propriedade dão pra fechar (`attachment.icon.background-color`), mas a VARIANTE não fecha: o vocabulário fechado §4.4 (primary/secondary/ghost/destructive/success/warning/info) não tem nenhum slot para paleta categórica de tipo-de-arquivo (azul/magenta/roxo sem noção de severidade). Chamar de `.default` (sem variante) resolveria ESTE token isolado, mas colidiria de fábrica com os 4 tokens irmãos (magenta/purple/warn, fora deste grupo 09-resto) que precisam do MESMO owner+anatomia+propriedade com outro qualificador — nomear um sem decidir os 5 juntos é o palpite que o §5.5 proíbe.

**⚠ Precisa QUEBRAR** — serve owners incompatíveis (§5.1):

- `Não é caso de quebra por owner incompatível (só existe 1 owner real hoje: attachment). É decisão de vocabulário: precisa que o dono resolva junto os 5 qualificadores da paleta de tipo-de-arquivo do Attachments (bg-royalblue/bg-magenta/bg-purple/bg-warn + bg-success já coberto por variant=success) antes de cravar o nome de qualquer um isoladamente.`

#### 134. `destructive` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#C62A2A` · dark `#C62A2A` |
| **usos** | 29 |
| **propriedades** | bg: 27, border: 2 (ambos os 2 usos de border em light:border-destructive, mesmo owner do bg vizinho). |
| **nome sugerido** | `button.container.background-color.destructive` |
| **classe** | `bg-button-container-background-color-destructive` |
| **risco** | Pixel-idêntico em todos os 6 splits — mesmo hex #C62A2A herdado, só troca de identificador/classe. Nenhum dos splits exige mudar valor. |

**Onde está aplicado.** Owners incompatíveis medidos: (1) BUTTON — `src/components/ui/Button/index.jsx:71,73` (variantes `destructive`/`destructiveSoft`, botão de ação destrutiva), `DeleteWorkspace/index.jsx:47` e `ResetDatabase/index.jsx:33` (botão 'excluir/resetar', default 25%/hover/disabled sólido), `Chats/index.jsx:152` (hover no botão 'Clear all chats'), `RunDetailPage.jsx:228` (botão 'Stop job'), `RunRow.jsx:74` (botão kill de execução). (2) BADGE — `FileDownloadCard/index.jsx:89` e `GeneratedFileCard.jsx:25` (chip PDF na paleta de tipo-de-arquivo), `LogRow/index.jsx:98` (pill de evento failed/deleted). (3) CHAT-MESSAGE — `HistoricalMessage/index.jsx:68,73` e `PromptReply/index.jsx:33` (bolha de erro na conversa). (4) LIST-ROW — `FileUploadProgress/index.jsx:76,101` (bg E border da MESMA linha que, no caminho feliz, já usa `bg-list-row-container-background-color` na linha 127 do mesmo arquivo). (5) BANNER — `DesignSystem/index.tsx:477,513` (caixas de alerta da própria página de dívida/catálogo), `RunDetailPage.jsx:269` (ErrorSection), `DisconnectedView/index.jsx:45` (ícone dentro de alerta, anatomia diferente: icon, não container). (6) PROMPT/estado — `VariableInput/index.jsx:27` (`VARIABLE_INVALID_CLASS`, destaque de `${variavel}` NÃO reconhecida dentro do editor de prompt — aqui a cor marca um ESTADO `invalid`, não uma variante de marca).

**Por quê.** `destructive` sozinho não é `owner.anatomia.propriedade` — é só a variante, sem owner nem anatomia (viola o formato mínimo do §1). E medindo o render real, serve pelo menos 6 papéis incompatíveis (button, badge, chat-message, list-row, banner, e um caso de ESTADO disfarçado de variante no VariableInput) — exatamente o padrão que §5.2/§5.3 mandam quebrar, não sinonimizar.

**⚠ Precisa QUEBRAR** — serve owners incompatíveis (§5.1):

- `1) button.container.background-color.destructive (+ .hover/.disabled — Button, DeleteWorkspace, ResetDatabase, Chats, RunDetailPage, RunRow)`
- `2) badge.container.background-color.destructive (FileDownloadCard, GeneratedFileCard, LogRow)`
- `3) chat-message.container.background-color.destructive (HistoricalMessage, PromptReply)`
- `4) list-row.container.background-color.destructive + list-row.container.border-color.destructive (FileUploadProgress)`
- `5) banner.container.background-color.destructive (DesignSystem, RunDetailPage ErrorSection) + banner.icon.background-color.destructive (DisconnectedView)`
- `6) prompt.container.background-color.invalid — ESTADO, não variante (VariableInput.jsx:27).`

#### 135. `destructive-foreground` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#FFFFFF` · dark `#FFFFFF` |
| **usos** | 4 |
| **propriedades** | text: 4 (todos em prefixo hover:/disabled:, nenhum uso 'base' sem prefixo). |
| **nome sugerido** | `button.container.color.destructive` |
| **classe** | `hover:text-button-container-color-destructive / disabled:text-button-container-color-destructive` |
| **risco** | Pixel-idêntico — branco continua branco, só troca de identificador. As duas ocorrências (DeleteWorkspace/ResetDatabase) migram juntas por serem o mesmo owner. |

**Onde está aplicado.** Único owner real: BUTTON, e só em 2 componentes gêmeos (mesmo JSX, verbatim): `DeleteWorkspace/index.jsx:47` (`hover:text-destructive-foreground`, `disabled:text-destructive-foreground`) e `ResetDatabase/index.jsx:33` (idem). É a cor do TEXTO do botão de excluir/resetar quando em hover (fundo vai a sólido) ou disabled — par de `bg-destructive` no mesmo elemento.

**Por quê.** Mesmo defeito de formato do token 2 (variante pura, sem owner/anatomia). Owner é só `button` aqui (nenhuma incompatibilidade — não precisa quebra). Achado extra por §5.4: NÃO existe um par 'default' desta MESMA classe nestes 2 sites — o texto default nessa posição é `text-content-primary` (outro token/família), só hover/disabled usam `destructive-foreground`. Não é o defeito clássico de 'hover sem base' (o default está coberto por outro token, não ausente), mas é uma pista de que o par default→hover não está modelado com o MESMO token na origem — vale o dono decidir se unifica.

#### 136. `info` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#2563EB` · dark `#2563EB` |
| **usos** | 37 |
| **propriedades** | bg: 36, border: 1. |
| **nome sugerido** | `badge.container.background-color.info` |
| **classe** | `bg-badge-container-background-color-info` |
| **risco** | Pixel-idêntico nos 6 splits reais (mesmo #2563EB). A regra morta do radio não tem risco de pixel porque não renderiza em lugar nenhum hoje — remover ou renomear não muda nada visível. |

**Onde está aplicado.** Owners incompatíveis medidos: (1) BANNER (o maior cluster) — caixas de aviso/dica full-width: `NativeTranscriptionOptions/index.jsx:54,74`, `LMStudioOptions/index.jsx:44`, `AwsBedrockLLMOptions/index.jsx:16`, `LocalAiOptions/index.jsx:30`, `Gitlab/index.jsx:285`, `Github/index.jsx:255`, `PaperlessNgx/index.jsx:104`, `Obsidian/index.jsx:96`, `AgentLLMSelection/index.jsx:116`. (2) BADGE — chips/tags: `FileDownloadCard/index.jsx:97` e `GeneratedFileCard.jsx:31,37` (badge DOC na paleta de tipo-arquivo), `RuleRow/index.jsx:72` ('Calculated' vs. a badge premium 'LLM' na linha 68), `Gitlab/index.jsx:174`, `Github/index.jsx:146` e `NewEmbedModal/index.jsx:314` (tag dentro de TagsInput), `AgentClarifyingQuestions.jsx:52` (badge 'BETA'), `ModelTable/index.jsx:139` (tag NPU — irmã de `bg-badge-container-background-color-secondary` já migrado pra CPU na linha 123 do MESMO arquivo/componente `DeviceTypeTagWrapper`), `LogRow/index.jsx:88` e `VariableRow/index.jsx:51,61` (pill de tipo/evento). (3) BUTTON — `OutlookSkillPanel/index.jsx:496` (botão sólido 'Authenticate with Microsoft', com hover/disabled) e `ImportedSkillConfig/index.jsx:191` (botão 'Save'). (4) PROGRESS — `WorkspaceDirectory/index.jsx:594` (`light:bg-info/10`, TRACK da barra fina de progresso de embedding; o fill usa `bg-surface-info-tint`, token diferente). (5) CARD (anatomia icon) — `ScheduledJobCreatedCard/index.jsx:32` (quadrado 48×48 do ícone dentro do card que já usa `bg-card-container-background-color` no wrapper). (6) PROMPT — `VariableInput/index.jsx:20` (`VARIABLE_HIGHLIGHT_CLASS`, destaque do `${variavel}` RECONHECIDA no editor de prompt — contraparte 'válida' do estado `.invalid` do token `destructive`, item 6 do token 2).

**Por quê.** Mesmo defeito de formato (variante pura). Medido em pelo menos 6 owners incompatíveis (banner, badge, button, progress, card, prompt) — quebra obrigatória por §5.2/§5.3. NOTA À PARTE: `src/index.css:688-690` (`.radio-container:has(input:checked) { border-info bg-info/10 text-content-info }`) é a origem do único uso de `border` — mas `grep -rn "radio-container" src --include=*.jsx --include=*.tsx` não retorna NENHUM elemento com essa className; os radios reais do app (ex. `OnboardingFlow/Steps/Survey/index.jsx:177-186`) usam `<input type="radio" className="hidden">` + uma `<div>` custom controlada por estado React, não `:has()`. Essa regra CSS é morta (0 consumidores reais) — não é owner `radio`, é candidata a remoção, não a naming.

**⚠ Precisa QUEBRAR** — serve owners incompatíveis (§5.1):

- `1) badge.container.background-color.info (dominante — FileDownloadCard, GeneratedFileCard, RuleRow, Gitlab/Github/NewEmbedModal tag, AgentClarifyingQuestions, ModelTable, LogRow, VariableRow)`
- `2) banner.container.background-color.info (NativeTranscriptionOptions, LMStudioOptions, AwsBedrockLLMOptions, LocalAiOptions, Gitlab, Github, PaperlessNgx, Obsidian, AgentLLMSelection)`
- `3) button.container.background-color.info (+ .hover/.disabled — OutlookSkillPanel, ImportedSkillConfig)`
- `4) progress.track.background-color.info (WorkspaceDirectory)`
- `5) card.icon.background-color.info (ScheduledJobCreatedCard)`
- `6) prompt.container.background-color.info (VariableInput, destaque de variável reconhecida — par 'default' do estado .invalid do token destructive). Fora da quebra: index.css:688 é CSS morto, não vira token novo sem antes confirmar com o dono se apaga.`

#### 137. `premium` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#6B21A8` · dark `#6B21A8` |
| **usos** | 3 |
| **propriedades** | bg: 3. |
| **risco** | Pixel-idêntico independente da decisão de vocabulário — o hex #6B21A8 não muda, só o nome/CSS var. |

**Onde está aplicado.** (1) BADGE — `RuleRow/index.jsx:68` (`bg-premium/20`, chip 'LLM' num roteador de regras, irmã direta da chip 'Calculated' que usa `bg-info/20` na linha 72 do MESMO componente). (2) PROMPT/busca — `ChatPromptSettings/index.jsx:210` e `Admin/DefaultSystemPrompt/index.jsx:247` (`highlightClassName="bg-premium/20 ..."` passado pro componente `<Highlighter>` de react-highlight-words, que grifa o trecho do prompt que bate com o termo buscado no textarea).

**Por quê.** Mesmo defeito de formato (variante pura, sem owner/anatomia). Owner/anatomia fecham nos 2 clusters (badge; e um owner de destaque-de-busca dentro do editor de prompt). O bloqueio real é de VOCABULÁRIO: `premium` não está na lista fechada do §4.4 (primary/secondary/ghost/destructive/success/warning/info) — mas é estruturalmente um 5º PAR colorido igual aos outros (`tokens/color.tokens.json` tem `pair.premium` com a MESMA forma dos demais: container + `-foreground` branco invariante), e o próprio CLAUDE.md do projeto já cita 'pares primary/destructive/success/info/premium' como o conjunto vigente. Variante nova: `premium` — justificativa: já implementada com a mesma anatomia dos outros 4 pares (container + foreground branco invariante ≥4,5:1), usada para marcar conteúdo 'premium/destacado' (regra roteada por LLM, trecho buscado no prompt), sem overlap semântico com nenhuma das 7 variantes já fechadas.

**⚠ Precisa QUEBRAR** — serve owners incompatíveis (§5.1):

- `badge.container.background-color.<premium, pendente de aprovação do dono> (RuleRow) + prompt.container.background-color.<premium, pendente> (ChatPromptSettings, DefaultSystemPrompt) — os 2 owners já se resolvem`
- `falta só o dono aprovar 'premium' como 8ª entrada do vocabulário §4.4 (ou indicar outro rótulo do vocabulário fechado, mas nenhum dos 7 existentes aproxima o papel sem mudar o sentido).`

#### 138. `success` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#1E7C4A` · dark `#1E7C4A` |
| **usos** | 12 |
| **propriedades** | bg: 12. |
| **nome sugerido** | `badge.container.background-color.success` |
| **classe** | `bg-badge-container-background-color-success` |
| **risco** | Pixel-idêntico nos 4 splits — mesmo #1E7C4A, só muda identificador/classe. |

**Onde está aplicado.** (1) BADGE (maior cluster) — `FileDownloadCard/index.jsx:99,106` e `GeneratedFileCard.jsx:43,49,55` (badges XLS/CSV na paleta de tipo-arquivo), `LogRow/index.jsx:103` (pill 'login_event'), `VariableRow/index.jsx:56` (pill tipo 'user'), `ModelTable/index.jsx:131` (tag GPU, irmã da tag CPU já migrada pra `bg-badge-container-background-color-secondary` no MESMO componente `DeviceTypeTagWrapper`). (2) ATTACHMENT (anatomia icon) — `Attachments/index.jsx:232` (`iconBgColor: "bg-success"` pra csv/xlsx, MESMA função `displayFromFile` do token 1/cockpit-calls-primary). (3) LIST-ROW (anatomia icon) — `FileUploadProgress/index.jsx:135` (`bg-success` no preenchimento do ícone CheckCircle da linha de upload concluído, distinto do fundo da própria linha que usa `bg-list-row-container-background-color`). (4) BANNER — `OutlookSkillPanel/index.jsx:508-510` (caixa de sucesso 'autenticado').

**Por quê.** Mesmo defeito de formato do grupo (variante pura). 4 owners incompatíveis medidos (badge, attachment, list-row, banner) — quebra obrigatória.

**⚠ Precisa QUEBRAR** — serve owners incompatíveis (§5.1):

- `1) badge.container.background-color.success (dominante — FileDownloadCard, GeneratedFileCard, LogRow, VariableRow, ModelTable)`
- `2) attachment.icon.background-color.success (Attachments, csv/xlsx)`
- `3) list-row.icon.background-color.success (FileUploadProgress, ícone de upload concluído)`
- `4) banner.container.background-color.success (OutlookSkillPanel).`

#### 139. `warning` — ❌ **INADEQUADO**

| | |
|---|---|
| **valor** | light `#F59E0B` · dark `#FBBF24` |
| **usos** | 27 |
| **propriedades** | bg: 27 (inclui variantes hover:/light:/hover:light: do mesmo elemento contadas à parte no dossiê). |
| **nome sugerido** | `badge.container.background-color.warning` |
| **classe** | `bg-badge-container-background-color-warning` |
| **risco** | Pixel-idêntico nos 3 splits — preserva #F59E0B (light) / #FBBF24 (dark) por tema, só muda identificador/classe. |

**Onde está aplicado.** (1) BADGE (maior cluster) — `FileDownloadCard/index.jsx:76` e `GeneratedFileCard.jsx:13,19` (badge PPT na paleta de tipo-arquivo), `ToolsSelector.jsx:208,268` (tag 'Needs Setup' com ícone, default+hover, 2 sites praticamente idênticos dentro do seletor de ferramentas de job agendado), `VariableRow/index.jsx:66` (pill do tipo default/'outro'), `LogRow/index.jsx:93` (pill de evento 'update'). (2) BANNER — `GMailSkillPanel/index.jsx:122` (aviso multi-usuário), `FileSystemSkillPanel/index.jsx:268-270` (componente literalmente chamado `WarningBanner()`), `Introduction/index.jsx:38` (aviso de importação privada no Community Hub), `AgentSkill.jsx:50` (aviso de confiança ao importar skill). (3) LIST-ROW — `FileSystemSkillPanel/index.jsx:294-300` (`SubSkillRow`, linha inteira destacada em âmbar quando `isWriteOperation` é true, dentro de uma lista de sub-skills).

**Por quê.** Mesmo defeito de formato (variante pura). 3 owners incompatíveis medidos (badge, banner, list-row) — quebra obrigatória. Valor também diverge por tema (light #F59E0B / dark #FBBF24), o que não muda o veredito de naming, só reforça que renomear precisa preservar os 2 valores por tema tal como estão.

**⚠ Precisa QUEBRAR** — serve owners incompatíveis (§5.1):

- `1) badge.container.background-color.warning (+ .hover — dominante: FileDownloadCard, GeneratedFileCard, ToolsSelector, VariableRow, LogRow)`
- `2) banner.container.background-color.warning (GMailSkillPanel, FileSystemSkillPanel WarningBanner, Introduction, AgentSkill)`
- `3) list-row.container.background-color.warning (FileSystemSkillPanel SubSkillRow).`

<details><summary>o que a refutação derrubou neste grupo</summary>

- **`cockpit-calls-primary`** — Citação de evidência errada: o texto diz que o mesmo `iconBgColor` também usa `bg-success` na 'linha 232, csv/xlsx' de Attachments/index.jsx. A Linha 232 real do arquivo é o case `pdf` com `bg-magenta`, não `bg-success`. O case csv/xlsx com bg-success está 8 linhas abaixo.
  - evidência: `src/components/WorkspaceChat/ChatContainer/PromptInput/Attachments/index.jsx:232 → `return { iconBgColor: "bg-magenta", Icon: FileText };` (case "pdf"). O `bg-success` real (case csv/xlsx) está na Linha 240.`
  - correção: Trocar a citação para Linha 240 (`return { iconBgColor: "bg-success", Icon: FileSpreadsheet };`). O veredito de mérito (PENDENTE, owner=attachment, decisão de vocabulário para paleta categórica) continua de pé — o defeito é só a citação de linha desta evidência auxiliar.
- **`destructive`** — `ondeEstaAplicado` cita `DesignSystem/index.tsx:477,513` como se fossem 2 sites de consumo distintos dentro do mesmo arquivo. Hoje só existe 1 ocorrência de `destructive` nesse arquivo (grep -c = 1). A Linha 477 atual não contém nada relacionado — é `{n.title}` de um link de navegação da sidebar da própria página DesignSystem.
  - evidência: `grep -c "destructive" src/pages/DesignSystem/index.tsx → 1. A única ocorrência real (`bg-destructive/20` na caixa de alerta 'Variantes sem conhecimento declarado') está na Linha 513. A Linha 477 tem `{n.title}` (nav.map), sem relação com o `
  - correção: Citar apenas a Linha 513 para DesignSystem. Não muda o cluster `banner.container.background-color.destructive` (ainda é 1 site real nesse arquivo + RunDetailPage ErrorSection), só corrige a contagem/evidência — a citação dupla infla artificialmente os '29 usos' e é evidência stale (provável line-dri
- **`destructive`** — Citação secundária menos grave: `FileUploadProgress/index.jsx:76,101` aponta para a linha de abertura do template literal multiline do `className` (`isFadingOut ? ... : ...`), não para a linha onde o literal `bg-destructive` de fato aparece.
  - evidência: `Linhas 76/101 do arquivo hoje contêm `isFadingOut ? "file-upload-fadeout" : "file-upload"`; o texto `bg-destructive/40` está 2 linhas abaixo, nas Linhas 78 e 103.`
  - correção: Citar Linhas 78 e 103 (onde `bg-destructive`/`light:border-destructive` aparecem literalmente), não a linha de abertura do JSX multiline.
- **`info`** — `Obsidian/index.jsx:96` citado para o banner `bg-info/30`, mas a linha real no arquivo atual é 100.
  - evidência: `grep -n "bg-info" src/components/Modals/ManageWorkspace/DataConnectors/Connectors/Obsidian/index.jsx → 100 (não 96).`
  - correção: Corrigir a citação para Linha 100. Não afeta o cluster `banner.container.background-color.info` (ainda é o mesmo site real, só a linha está errada — provável drift do arquivo desde a leitura original).
- **`premium`** — Duas das três citações de linha estão erradas: `ChatPromptSettings/index.jsx:210` (real = 219) e `DefaultSystemPrompt/index.jsx:247` (real = 248).
  - evidência: `grep -n "bg-premium" nos dois arquivos: src/pages/WorkspaceSettings/ChatSettings/ChatPromptSettings/index.jsx:219 e src/pages/Admin/DefaultSystemPrompt/index.jsx:248 — ambos usam `highlightClassName="bg-premium/20 ..."`. A contagem total de`
  - correção: Corrigir para Linha 219 (ChatPromptSettings) e Linha 248 (DefaultSystemPrompt). O veredito PENDENTE em si (premium como 5º par estrutural, aguardando aprovação de vocabulário) permanece bem fundamentado — confirmei em tokens/color.tokens.json:4290-4305 que `pair.premium`/`pair.premium-foreground` já
- **`success`** — Repete o mesmo erro do token `cockpit-calls-primary`: cita `Attachments/index.jsx:232 (bg-success, csv/xlsx)`, mas a Linha 232 real é o case `pdf` com `bg-magenta`. Além disso, `FileDownloadCard/index.jsx:99,106` (badges XLS/CSV) estão erradas — as linhas reais são 105 e 112 (off-by-6, mesmo padrão de deslocamento visto nos outros tokens desse arquivo).
  - evidência: `Attachments/index.jsx:232 = `bg-magenta` (pdf); bg-success real está na Linha 240. FileDownloadCard/index.jsx: grep -n "badgeBg" mostra XLS na Linha 105 e CSV na Linha 112, não 99/106.`
  - correção: Corrigir para Attachments/index.jsx:240 e FileDownloadCard/index.jsx:105,112. Os demais sites do cluster `success` (GeneratedFileCard 43/49/55, LogRow:103, VariableRow:56, ModelTable:131, FileUploadProgress:137, OutlookSkillPanel:510) foram todos conferidos e batem exatamente com o código atual — o 
- **`warning`** — Três citações de linha erradas no mesmo arquivo/padrão: `FileDownloadCard/index.jsx:76` (real = 82, badge PPT), `GeneratedFileCard.jsx:12,18` (real = 13,19) e `ToolsSelector.jsx:208,268` (real = 212,272).
  - evidência: `grep -n "bg-warning" nos 3 arquivos confirma: FileDownloadCard badge PPT está na Linha 82 (não 76); GeneratedFileCard.jsx tem `bg-warning/15` nas Linhas 13 e 19 (não 12/18); ToolsSelector.jsx tem a tag 'Needs Setup' nas Linhas 212 e 272 (nã`
  - correção: Corrigir as 3 citações para 82, 13/19 e 212/272 respectivamente. Todos os demais sites do cluster warning (VariableRow:66, LogRow:93, GMailSkillPanel:122, FileSystemSkillPanel WarningBanner:268-270 e SubSkillRow:291-299, Introduction:38, AgentSkill:50) foram conferidos e batem exatamente.

</details>
