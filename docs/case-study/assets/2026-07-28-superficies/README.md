# Evidência renderizada — ocorrências dos tokens de superfície

Coleção de assets do relatório
[2026-07-28-relatorio-superficies-componente-a-componente.md](../../2026-07-28-relatorio-superficies-componente-a-componente.md).

**34 PNGs** — 17 rotas × 2 temas, viewport 1440×900, autenticado. Cada ocorrência
de token de superfície está contornada; a cor do contorno é fixa por token e a
legenda está embutida no canto inferior direito de cada imagem.

**Só o consumo PROVADO é contornado** — elemento cuja classe/estilo nomeia o
token. Por isso quase nada aparece marcado: das 531 ocorrências de casamento de
valor, apenas **2** são consumo direto. Ver a retratação no §3 do relatório.

`hover:bg-surface-hover` (182 no DOM) e `hover:bg-surface-destructive-tint` (44)
só existem com o cursor sobre o elemento e não aparecem numa captura em repouso.

`findings.json` traz os 531 registros com rota, tema, token, propriedade, tag,
classes, texto, retângulo e a cadeia de containers.

Regerar:

```bash
cd frontend && node tests/visual/capture-surface-occurrences.mjs
```
