# Seu risco de câncer de mama (Outubro Rosa)

Ferramenta educativa para ações de extensão. A participante responde a 4 blocos de perguntas e recebe:

- uma pontuação de 0 a 100 e a categoria de risco (baixo, moderado, aumentado, alto);
- **quando fazer a mamografia** (com linha do tempo por idade e prazo conforme a última mamografia);
- se **faz sentido conversar sobre teste genético** (BRCA1, BRCA2 e outros genes), com os critérios que ela atingiu;
- se precisa **aumentar a atividade física**, **emagrecer**, **reduzir o álcool**, parar de fumar ou reavaliar hormônios;
- o que mais pesou no resultado e o que já protege.

Tudo roda no navegador (HTML, CSS e JavaScript puros, sem build). Os dados são enviados, só com consentimento e sem identificação, para uma planilha do Google.

## Estrutura

```
index.html          telas do questionário e do resultado
style.css           visual em tons de rosa
app.js              cálculo do risco, plano personalizado, envio dos dados
config.js           URL do Apps Script, token e identificador do evento
apps-script/Code.gs script que grava na planilha
```

## 1. Publicar no GitHub Pages

1. Crie um repositório e envie os arquivos `index.html`, `style.css`, `app.js` e `config.js` (a pasta `apps-script` pode ficar no repositório como referência).
2. Em **Settings > Pages**, escolha **Deploy from a branch**, branch `main`, pasta `/ (root)`.
3. O endereço será `https://SEU-USUARIO.github.io/NOME-DO-REPO/`.
4. Para identificar cada evento na planilha sem mudar o código, use `?evento=NOME`, por exemplo `.../?evento=ufs-extensao-2026`. Gere um QR Code com esse endereço para o estande.

## 2. Configurar a planilha (Google Sheets)

1. Crie uma planilha nova no Google Drive.
2. **Extensões > Apps Script**, apague o conteúdo e cole `apps-script/Code.gs`.
3. Troque `TOKEN` por uma frase sua (ex.: `rosa-2026-abc123`).
4. No editor, escolha a função `setup` e clique em **Executar**. Autorize o acesso. Serão criadas as abas **Respostas** (com cabeçalho rosa) e **Resumo** (indicadores com fórmulas, atualizados sozinhos).
5. **Implantar > Nova implantação > Tipo: App da Web**
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
6. Copie a URL terminada em `/exec`.
7. Em `config.js`, cole a URL em `SHEETS_URL` e use o mesmo valor de `TOKEN`. Faça commit.
8. Teste: abra a URL `/exec` no navegador (deve mostrar `{"ok":true,...}`), responda o questionário marcando o consentimento e confira se uma linha apareceu em **Respostas**.

> Depois de qualquer mudança no `Code.gs`, use **Implantar > Gerenciar implantações > editar > Nova versão**. Sem isso a URL continua executando a versão antiga.

### Por que este desenho de gravação

| Decisão | Motivo |
|---|---|
| Apps Script + Google Sheets | Gratuito, sem servidor, a equipe já sabe usar planilha e o resultado vira relatório de extensão com poucos cliques. Cobre com folga um evento (centenas a poucos milhares de respostas). |
| Envio `POST` com `text/plain` e `mode: no-cors` | O Apps Script não envia cabeçalhos CORS; esse formato evita o pré-voo e funciona a partir do GitHub Pages. O app não consegue ler a resposta, por isso a confirmação é otimista. |
| Fila no navegador (`localStorage`) | Wi-Fi de evento falha. Se não houver conexão, a resposta fica guardada e é reenviada quando a internet voltar. |
| `id` único por resposta | Reenvios não geram linhas duplicadas: o servidor ignora ids repetidos. |
| `LockService` | Várias participantes enviando ao mesmo tempo não corrompem a planilha. |
| Validação no servidor + `TOKEN` | O endereço do script fica visível no código do site. O token barra envios aleatórios e a validação (idade, pontuação, categoria, tamanho dos campos) barra lixo. O token **não é segredo**. |
| Neutralização de `=`, `+`, `-`, `@` | Evita injeção de fórmulas em campos de texto. |

Limites do Apps Script (documentação do Google, sujeitos a mudança): 30 execuções simultâneas por usuário e 90 minutos de tempo total por dia em conta Gmail comum (6 horas em Workspace). Cada gravação leva poucos segundos, então a fila e o bloqueio dão conta de um pico de evento. Se o projeto crescer para campanhas com milhares de respostas por dia, migrar para Supabase ou Firebase (com regras de acesso) é o caminho.

### Dados coletados (minimização e LGPD)

- **Não** coleta nome, CPF, e-mail, telefone, endereço, IP nem texto livre.
- Não grava peso nem altura: só o IMC com uma casa decimal e a idade em anos.
- Envio somente se a participante marcar a autorização na tela inicial; o resultado aparece de qualquer forma.
- São dados de saúde (dados pessoais sensíveis, art. 11 da LGPD). Mesmo sem identificação direta, trate a planilha como confidencial: compartilhe apenas com a equipe, nunca com link público, e faça uma cópia de segurança ao final do evento.
- Se for **publicar os resultados** (artigo, resumo em congresso), submeta o projeto ao Comitê de Ética em Pesquisa antes de coletar e inclua o TCLE. Para ação de extensão sem publicação, registre-a pela rotina da instituição.
- Edite o texto de consentimento em `index.html` conforme o parecer da sua instituição.

## 3. Como o risco é calculado

Modelo **simplificado e educativo**: multiplica riscos relativos publicados para cada fator, em relação a um perfil de referência. A escala de 0 a 100 é logarítmica (100 equivale a risco 5 vezes maior que a referência).

| Fator | Risco relativo usado | Fonte |
|---|---|---|
| 1 parente de 1º grau / 2 ou mais | 1,8 / 2,9 | Collaborative Group, Lancet 2001 |
| Hiperplasia atípica / biópsia benigna comum | 4,2 / 1,3 | Hartmann, NEJM 2005 |
| Densidade mamária A, B, C, D | 0,8 / 1,0 / 1,3 / 1,6 (aprox.) | Boyd, NEJM 2007; BCSC |
| Menarca precoce | +5% por ano mais cedo | Collaborative Group, Lancet Oncol 2012 |
| Menopausa tardia | +2,9% por ano mais tarde | idem |
| Nuliparidade; idade ao 1º filho; nº de filhos | 1,25; 0,9 a 1,3; −7% por filho | literatura reprodutiva; Collaborative Group, Lancet 2002 |
| Amamentação | −4,3% a cada 12 meses | Collaborative Group, Lancet 2002 |
| Pílula (uso atual, 1 a 4 anos, 5 a 9 anos após parar) | 1,24 / 1,16 / 1,07 | Collaborative Group, Lancet 1996 |
| Terapia hormonal (combinada <5 / ≥5 anos; só estrogênio) | 1,6 / 2,1; 1,2 a 1,3 | Collaborative Group, Lancet 2019 |
| Álcool | +7,1% a cada 10 g/dia (1 dose = 14 g) | Collaborative Group, Br J Cancer 2002 |
| IMC após a menopausa | +12% a cada 5 kg/m² acima de 25 | Renehan, Lancet 2008 |
| Atividade física ≥150 min/semana | 0,88 | Wu, Breast Cancer Res Treat 2013; OMS 2020 |
| Tabagismo atual | 1,1 | Gaudet, JNCI 2013 |

**Sinais que elevam a categoria independentemente do número:** mutação conhecida (BRCA1/2 e outras), radioterapia no tórax antes dos 30 anos, hiperplasia atípica/CLIS, 2 ou mais parentes de 1º grau com câncer de mama (risco alto); câncer de mama antes dos 50 anos, bilateral, de ovário, masculino ou de pâncreas/próstata metastático na família (risco pelo menos aumentado e indicação de conversar sobre genética).

**Pontos de corte das categorias:** baixo (RR < 1,5), moderado (1,5 a 2,5), aumentado (2,5 a 4), alto (≥ 4 ou sinal acima). São pragmáticos, não derivados de validação.

**Quem fica de fora:** mulheres que já tiveram câncer de mama recebem aviso para manter o acompanhamento com a equipe assistente.

### Recomendações de rastreamento no app

- Ministério da Saúde: mamografia pelo SUS a partir dos 40 anos, por decisão compartilhada com o profissional (anunciado em setembro de 2025); rastreamento organizado a cada 2 anos de 50 a 74 anos.
- SBM, CBR e FEBRASGO: mamografia anual a partir dos 40 anos.
- Risco alto: consulta com mastologista, rastreamento anual mais precoce, frequentemente com ressonância, definido pelo especialista.
- Teste genético: critérios de encaminhamento para aconselhamento genético baseados em histórico familiar (padrão de NCCN e sociedades brasileiras), com orientação de testar primeiro a parente afetada, quando possível.

> **Antes do evento, confira.** Os riscos relativos acima são valores arredondados a partir das publicações e as diretrizes brasileiras mudam (o Congresso aprovou projeto de lei sobre mamografia a partir dos 40 anos no SUS). Revise os números com as fontes originais e atualize `mamoCard` em `app.js` se algo mudou. Para uso em pesquisa, o modelo precisa ser comparado com Gail (BCRAT), Tyrer-Cuzick (IBIS) ou CanRisk em uma amostra antes de qualquer afirmação de acurácia.

## 4. Personalização rápida

- **Cores:** variáveis no início de `style.css` (`--framboesa`, `--coral`, `--rosa-cha`, `--algodao`).
- **Logotipo da instituição:** adicione uma `<img>` no `<header class="top">` de `index.html`.
- **Texto de consentimento e rodapé:** `index.html`.
- **Evento padrão:** `EVENT_ID` em `config.js`.
- **Testar sem gravar dados:** deixe `SHEETS_URL` vazio (a tela avisa "Modo de teste").

## Aviso

Ferramenta educativa. Não faz diagnóstico, não substitui consulta, exame clínico das mamas nem mamografia.
