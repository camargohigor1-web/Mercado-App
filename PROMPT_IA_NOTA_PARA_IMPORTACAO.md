# Prompt para transformar nota fiscal em compras importáveis

Use este prompt junto com:

1. As fotos da nota fiscal.
2. Um **backup atual** exportado na área `Backup` do Mercado App. O backup fornece o catálogo de produtos e mercados existentes, com seus IDs.

> Não use um JSON de exportação de uma única compra como catálogo: ele pode não conter todos os produtos que já existem no app.

---

Copie o texto abaixo para a IA escolhida e anexe os arquivos indicados.

```text
Você vai converter as fotos de uma nota fiscal em um arquivo JSON para importar no Mercado App.

Arquivos anexados:
- Fotos da nota fiscal: fonte dos dados da compra.
- Backup atual do Mercado App: fonte obrigatória do catálogo em `items` e dos mercados em `markets`.

Objetivo:
Produzir EXCLUSIVAMENTE um JSON válido do tipo `purchases_export`, pronto para importação. Ele deve conter uma única compra em `purchases` e, em `items` e `markets`, apenas os objetos do backup usados por essa compra.

REGRA MAIS IMPORTANTE — NÃO CRIAR PRODUTOS:
- Nunca crie, renomeie, resuma, corrija ou “melhore” nomes de produtos.
- Para cada item da nota, encontre um produto existente no array `items` do backup.
- Quando encontrar, copie o objeto inteiro desse produto sem alterar NADA, inclusive `id`, `name`, `type`, unidades, categoria e demais propriedades.
- A linha da compra deve apontar para o `id` original desse produto.
- Use o nome impresso na nota somente para buscar o produto correspondente; ele não deve virar um novo cadastro.
- Faça a correspondência por marca, tamanho, sabor/variação e tipo de embalagem. Não associe produtos parecidos, mas diferentes.
- Se qualquer item da nota não tiver uma correspondência segura e exata no catálogo, NÃO gere um JSON de importação parcial e NÃO invente um produto. Em vez disso, responda somente com uma lista chamada `ITENS_SEM_CORRESPONDENCIA`, explicando qual item da nota precisa ser cadastrado manualmente no app. Pare a resposta nesse ponto.

MERCADO:
- Use um mercado existente no array `markets` do backup e copie seu objeto completo sem alterar seu `id` ou `name`.
- Se o mercado da nota não existir com segurança, responda somente com `MERCADO_SEM_CORRESPONDENCIA` e não gere JSON importável.

FORMATO OBRIGATÓRIO DA RESPOSTA BEM-SUCEDIDA:
- Responda apenas com o conteúdo de um JSON, sem Markdown, comentários ou explicações.
- Estrutura obrigatória:
{
  "_version": 3,
  "_exportedAt": "DATA-HORA-ISO-ATUAL",
  "_type": "purchases_export",
  "purchases": [ ...uma compra... ],
  "items": [ ...somente produtos usados, copiados do backup... ],
  "markets": [ ...somente o mercado usado, copiado do backup... ]
}

REGRAS DA COMPRA:
- `date`: data da nota no formato AAAA-MM-DD. Se a data não estiver legível, pare e peça confirmação.
- `marketId`: ID exato do mercado escolhido no backup.
- `note`: string vazia, salvo se houver uma observação clara e útil na nota.
- Use um novo `id` alfanumérico para a compra.
- Todas as linhas devem ter: `itemId`, `numPkgs`, `pricePerPkg`, `pricePerPkgAfterDiscount`, `discountTotal`, `discountPerPkg`, `total`, `brand` e `note`.
- `numPkgs` pode ser decimal para produtos vendidos por peso.
- Produtos `type: "packaged"`:
  - `pricePerInternal = pricePerPkgAfterDiscount / pkgSize`
  - não inclua `pkgQty`, `totalQty` ou `pricePerUnit`.
- Produtos `type: "bulk"`:
  - use `pkgQty` como a quantidade de cada embalagem na unidade-base do produto;
  - `totalQty = numPkgs * pkgQty`;
  - `pricePerUnit = pricePerPkgAfterDiscount / pkgQty`.
- Não use `type: "weight"`; no formato atual do app, produtos vendidos por peso usam `type: "bulk"` e devem manter exatamente o objeto correspondente do backup.
- Sem desconto: `discountTotal` e `discountPerPkg` devem ser `0`, e `pricePerPkgAfterDiscount` deve ser igual a `pricePerPkg`.
- Com desconto: calcule `discountTotal`, `discountPerPkg = discountTotal / numPkgs` e `pricePerPkgAfterDiscount = pricePerPkg - discountPerPkg`.
- `total = (numPkgs * pricePerPkg) - discountTotal`, arredondado a duas casas decimais.
- `purchase.total` deve ser a soma das linhas, arredondada a duas casas decimais.
- Preserve as quantidades e preços da nota; não estime valores ilegíveis. Peça esclarecimento quando necessário.

Antes de responder, confira silenciosamente:
1. Todo `itemId` das linhas existe no array `items` de saída.
2. Cada item de saída é uma cópia literal de um item do backup.
3. Todo `marketId` existe no array `markets` de saída.
4. A soma das linhas é igual a `purchase.total`.
5. Não existe produto criado, renomeado ou aproximado.
```

Depois de receber o JSON, importe-o em **Compras → Importar**, selecione a compra e faça a revisão final antes de salvar.
