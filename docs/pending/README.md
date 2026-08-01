# `docs/pending/` — o backlog como artefato

Esta pasta responde a uma pergunta que antes só tinha resposta refazendo o
trabalho: **o que ainda está aberto neste repositório?**

## Por que ela existe

`docs/SCHEMA.md` §3 classifica o **documento** — `status: canon | active |
superseded | historico | proposta`. Não existia vocabulário para o **item**: um
doc `active` pode carregar vinte pendências e a constituição não vê nenhuma.
`docs_wiki_lint.py` só valida (órfão, naming, referência); nada colhia.

O resultado media-se: as pendências viviam em prosa espalhada por
`docs/plans/*.md` e num `docs/ESTADO.md` escrito à mão, que nascia velho porque
nada o obrigava a acompanhar o código. Toda sessão que precisava saber "o que
falta" reabria os quatro planos e reconstruía a lista — e uma dessas
reconstruções chegou a perguntar ao dono uma decisão que a lei já tinha tomado.

## O contrato

**Uma pendência = um arquivo** `docs/pending/<id>.md`, `<id>` em kebab-case.

```yaml
---
title: frase imperativa curta — o que precisa acontecer
status: aberto | bloqueado          # resolver NÃO é mudar status, é apagar o arquivo
quem_resolve: dono | agente
severidade: bloqueante | alta | media | baixa
bloqueia: <o que fica travado enquanto isto não fecha, ou "nada">
fonte: <path relativo à raiz>:<linha>
citacao: "trecho textual da fonte que sustenta o item"
updated: YYYY-MM-DD
---

O corpo explica o item. Se ele exige decisão humana, traga o bloco de decisão
completo (comportamento · exemplo aplicado bom · exemplo aplicado ruim · quando
escolher), porque pergunta seca ao dono é proibida.
```

**Resolver é apagar o arquivo.** Não existe `status: resolvido` — um backlog que
acumula itens fechados deixa de ser lido. O git guarda o histórico, que é a
política de `docs/SCHEMA.md` ("git é o arquivo").

## O índice e o guard

```bash
python3 tools/gates/pending_index.py            # regenera docs/pending/index.md
python3 tools/gates/pending_index.py --check    # não escreve; falha se stale ou podre
python3 tools/gates/pending_index.py --json     # o backlog como dado
```

`index.md` é **gerado** — editar à mão é perda de trabalho, o próximo comando
sobrescreve.

A checagem que justifica o guard é a de **ponteiro podre**: cada item declara a
`fonte` e a `citacao` textual dela, e o `--check` confere que aquela citação
ainda existe no arquivo. Quando a fonte muda, o item é sinalizado para
**re-auditoria** em vez de continuar sendo afirmado — porque backlog cheio de
item já resolvido é pior que backlog nenhum: ele faz o agente perguntar ao dono
o que a lei já respondeu. A linha declarada tolera deriva de até 4 linhas (texto
inserido acima não invalida o ponteiro); sumiço da citação, não.

## O que NÃO entra aqui

- Defeito já corrigido. Os documentos deste repo são densos em cicatriz
  (`✅ RESOLVED`, `✔ DRIFT FIXED`) — isso é história, não pendência.
- Item sem `fonte` verificável. Sem path e linha não há como auditar se fechou.
- Tarefa do app-alvo. Este repo define a lei e o processo; o valor de cada token
  é trabalho de quem consome (ver `docs/law/design_system_template.json`).
