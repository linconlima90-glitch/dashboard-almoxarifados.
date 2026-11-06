# Regra de datas para baixas - 06/11/2026

## Regra operacional aprovada

- **Data de referência da baixa:** coluna `Dt.Neg.` (data de negociação), não `Dt.Movimento`.
- Quando a negociação e a movimentação estão em meses diferentes, atribuir o consumo ao **mês da negociação**, inclusive em mudanças de ano.
- Para as telas de baixas, as visualizações por local, por grupo e de "todas as baixas juntas" devem usar a mesma competência da negociação.
- Para médias e estoque mínimo, manter o escopo vigente: 2024 para consulta histórica; 2025 e 2026 pelos meses completos; cobertura de 2 meses; excluir pneus, câmaras e cimento somente do cálculo de estoque mínimo.
- Novos arquivos históricos completos **substituem a base histórica anterior**; jamais somar a mesma baixa duas vezes. Validar unicidade por `Nro.Unico` + `Seq.`.
- Preservar `Dt.Movimento` para conferência contábil, mas não usá-la como competência da baixa.
- O campo de custo permanece `Custo_Total`, quando disponível. A correção de data não deve alterar estoque físico nem saída do ERP.

## Arquivo recebido e auditado

- Fonte: `Conferencia_de_custo_X_baixas_(Fora_a_Transferencia)(10).xlsx`
- Emissão: 06/11/2026 09:55:05
- SHA-256: `a068fc42ae4e5ce17378da97351d98b1ad1c99fefdc3af26a0b6c795e493f897`
- Registros: **21.792**, com primeira negociação em 14/03/2024 e última em 06/11/2026.
- Datas movimento/negociação diferentes: **3.157**.
- Registros que mudam de mês ou de ano: **950**, dos quais **27** mudam de ano.
- Negociação posterior à movimentação: **49** registros a conferir.
- Custo total ERP: **R$ 2.546.848,92**.
- Unicidade de `Nro.Unico` + `Seq.`: **sem repetições**.

## Situação de integração

**Regra e auditoria documentadas; a substituição da base histórica em produção ainda não foi efetuada.** A planilha íntegra não está armazenada neste repositório. Antes de publicar os novos totais, importar a versão processada pela data de negociação, reconstruir séries mensais e histórico detalhado e executar os testes de reconciliação. Não afirmar que os gráficos do Cloudflare já usam esta fonte até essa substituição ser concluída.
