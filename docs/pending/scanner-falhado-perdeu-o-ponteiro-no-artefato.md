---
title: o artefato não nomeia mais QUAL scanner falhou — só que a corrida não é exaustiva
status: aberto
quem_resolve: dono
severidade: media
bloqueia: nada; degrada o diagnóstico de uma corrida não-exaustiva
fonte: .claude/skills/tokenize-design-system/scripts/lib/axis-discovery.mjs:705
citacao: 'scannerResults.every('
updated: 2026-08-01
---

Consequência declarada de uma correção de 2026-08-01, apontada pelo review
adversarial no mesmo dia.

Antes, um scanner com status `failed` chegava a `uncoveredOccurrenceKinds` —
então o artefato **nomeava** o kind cujo scanner quebrou. A correção fez a
cobertura classificar só os kinds descobertos (exigência do contrato,
`artifact-contract.mjs:1331`), e o sinal do scanner passou a ser lido da fonte
dentro de `exhaustive`. Isso é mais forte para DECIDIR — vale mesmo quando o
kind não aparece — e mais fraco para DIAGNOSTICAR: agora resta só
`exhaustive: false`, sem causa nomeada dentro do artefato.

`$defs.axisDiscovery` não tem campo para `scannerResults` e é
`unevaluatedProperties: false`, então acrescentá-lo é **emenda de schema** — e
schema é contrato, não detalhe de implementação. Por isso isto é sua decisão e
não um conserto que eu faça sozinho.

## As opções

**A — emendar o schema com `failedScanners: string[]`.**
O artefato volta a nomear a causa, e quem lê o journal seis meses depois sabe o
que quebrou sem reproduzir a corrida. Custo: schema é versionado e consumido por
`createArtifactValidator`; toda corrida antiga passa a ter um campo a menos que
o schema novo não exige (é opcional, então não invalida nada).

**B — deixar como está.**
`exhaustive: false` já impede a corrida de se declarar completa, que é a
propriedade de SEGURANÇA. Quem quiser a causa roda o `discover-axes` de novo e
lê o stdout. Custo: o diagnóstico depende de reproduzir, e reprodução exige a
mesma árvore — que pode não existir mais.

**Minha recomendação: A.** O argumento é o mesmo que sustenta o resto deste
repositório: artefato existe para que a conclusão sobreviva sem a máquina que a
produziu. Um `false` sem causa obriga a refazer o trabalho para saber por quê, e
é exatamente o tipo de silêncio que o contrato existe para evitar. O custo é uma
chave opcional.
