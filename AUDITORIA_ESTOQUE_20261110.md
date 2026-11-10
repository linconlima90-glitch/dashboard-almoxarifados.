# Atualizacao da fotografia ERP em 10/11/2026

Fonte: `Estoques_analitico(5).xlsx` — emissao 10/11/2026 12:54:13. SHA256: 852f4cad45f3a7dda460da861c84ab68e410fded8039ea8d45f58bd173842edc.

- Posicao anterior (09/11/2026 10:29:10): 4.380 registros, R$ 2.292.215,23.
- Posicao atual (10/11/2026 12:54:13): **4.381 registros, R$ 2.291.690,05**.
- Diferenca de valor: **-R$ 525,18**.
- Comparacao por empresa fiscal + local + codigo do produto + unidade: **6 removidos, 7 adicionados, 78 alterados e 4.296 inalterados**.
- 9 almoxarifados. Posicoes positivas, sem chaves duplicadas, soma dos custos totais validada centavo a centavo.
- A atualizacao substitui a fotografia de saldo. **Nao descontar baixas historicas novamente**: manter o historico de movimentos pelo campo Dt.Neg. ate 09/11 e recalcular indicadores sobre o estoque novo.
- Estoque sem baixa depende do mesmo historico de 22.019 baixas e passa a avaliar dinamicamente apenas as posicoes com saldo na foto de 10/11. Padrao: ausencia de baixa em toda a rede; consulta opcional por almoxarifado.
- Estoque minimo permanece com 2 meses de cobertura e 22 meses completos (2025 + janeiro-outubro/2026) para a media.
