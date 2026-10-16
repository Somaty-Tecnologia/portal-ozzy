---
name: "economia-de-tokens"
description: "Use em tarefas grandes (planilhas, varredura de código, análises) para repassar o trabalho braçal a ajudantes em modelo mais leve e economizar tokens."
---

# Economia de tokens

O usuário (Heitor) autoriza, por esta skill, que ajudantes (ferramenta Agent) rodem em modelo mais leve conforme a tabela abaixo.

## Quando repassar para um ajudante
- Ler ou resumir planilhas, PDFs e exportações grandes (ex.: Eclética, extratos OFX).
- Procurar onde algo está no código, listar arquivos, contar ocorrências.
- Conferir números, cruzar duas listas, montar CSV de importação.
- Tarefas repetitivas e bem definidas.

## Qual modelo usar
- `haiku`: leitura, busca, contagem, resumo, conversão de formato.
- `sonnet`: ajuste simples de tela, script de importação, conferência com alguma lógica.
- Modelo da própria conversa (forte): decisões, regras de dinheiro, banco de dados (migrations, permissões), desenho de telas novas, revisão final.

## Como pedir ao ajudante
- Dê caminho exato dos arquivos e o que devolver.
- Peça só o resumo (números, lista curta, trechos com arquivo:linha), nunca o conteúdo inteiro.
- Para planilhas grandes, peça que leia por script (Python/pandas) e devolva só os totais.

## Regras
- Não repasse tarefa que mexe em dinheiro ou no banco de produção sem revisar o resultado.
- Se o pedido inteiro for pequeno, faça direto: abrir ajudante custa mais que resolver.
- Ao terminar, diga em uma linha o que foi repassado e para qual modelo.
