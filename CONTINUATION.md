# Estado de continuidade

## Alteração concluída em 08/09/2026

- `src/components/ShoppingListSection.tsx` concentra a interface de **Planejar** e **Mercado**.
- Em **Planejar**, clicar no card apenas abre seus detalhes. As ações explícitas ao lado são: balança para o comparador e `+` para incluir o produto na lista do Mercado.
- Em **Mercado**, o card aberto mostra preço mínimo, médio e último, além de média mensal, média por compra e frequência dos hábitos.
- Em **Histórico**, a lista de produtos mostra média mensal e frequência; no detalhe do produto, os três indicadores de hábitos respeitam o filtro de datas selecionado.
- Em **Relatórios**, o detalhe expandido de cada produto na análise por categoria mostra os mesmos três indicadores, calculados para o período filtrado.
- **Hábitos** foi consolidado em **Histórico**: a visão padrão é a lista de hábitos por produto e, ao abrir um produto, a aba inicial é Hábitos; a aba secundária preserva preços e compras detalhadas. A navegação inferior agora dá acesso direto a Comprar.
- Em **Planejar**, após adicionar um produto pelo `+`, a seção “Na lista” oferece “Usar média” como ação explícita para aplicar a quantidade média por compra. Nenhuma quantidade é sugerida ou gravada automaticamente.

## Segurança dos dados

Nenhum schema, chave de armazenamento ou registro histórico foi alterado. Os indicadores de hábitos usam `calcPurchaseHabitStats` e são calculados somente em memória a partir de `purchases`; portanto, não escrevem no Firebase, no localStorage nem nas compras existentes.

## Verificação

`npm run build` passou em 08/09/2026. O `npm run lint` ainda falha por uma regra preexistente em `src/context/AppContext.tsx:294` (`react-refresh/only-export-components`), sem relação com esta alteração.
