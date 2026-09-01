# Brugui

Sistema web de planejamento do casal, pensado para namoro a distância. Duas contas, um espaço
compartilhado: o que um escreve, o outro vê na hora.

Node.js puro — **sem nenhuma dependência externa**, sem framework, sem build. O front é
JavaScript com módulos ES nativos e os dados ficam em um único arquivo JSON.

---

## Como rodar

Precisa apenas do Node.js 18 ou mais novo.

```bash
node servidor.js
```

Ou, se preferir: `npm start`. Depois abra `http://localhost:3300`.
Para trocar a porta: `PORTA=8080 node servidor.js`.

## Como duas pessoas entram no mesmo espaço

1. A primeira cria a conta deixando o campo **código de convite vazio** — isso cria o espaço.
2. O sistema gera um código de 6 letras, visível em **Ajustes → Nosso espaço**.
3. A segunda cria a conta **usando esse código**. Pronto: as duas compartilham tudo.

Cada espaço aceita no máximo duas pessoas.

## O que tem dentro

| Página | Para quê |
| --- | --- |
| **Painel** | O Norte do casal, contagem do próximo encontro, check-in de humor, pergunta do dia, metas, cofrinho, datas chegando e pendências |
| **Metas** | Três camadas: o **Norte** (um objetivo principal por vez), as metas de vocês dois e as de cada um, com vínculo entre elas, campo "como seu par pode ajudar" e semáforo de prazo |
| **Linha do tempo** | Metas, encontros, cofrinhos e datas num eixo só, mais a revisão mensal de cada um |
| **Cofrinho** | Metas de dinheiro com depósitos, quanto cada um colocou, ritmo mensal necessário e vínculo com a meta |
| **Encontros** | Presenciais e virtuais, com despesas por pessoa e o saldo de quem pagou mais |
| **Distância** | Dias sem se ver, recorde de tempo separados, melhor hora para se falar (cruza os horários livres dos dois, com fuso) e o plano para acabar com a distância |
| **Dia a dia** | Mural de recados, termômetro semanal, pedido da semana, mapa de humor de 14 dias, perguntas e o histórico do que cada um mexeu |
| **Combinados** | Acordos que só valem quando os dois aceitam e a pauta da próxima conversa |
| **Listas** | Filmes, lugares e desejos — com modo surpresa |
| **Memórias** | Álbum com foto e as cápsulas do tempo |
| **Datas** | Aniversários e datas que se repetem, com contagem regressiva |
| **Retrospectiva** | "Nosso ano" em números e listas, pronto para salvar em PDF |
| **Ajustes** | Tema, perfil, horários livres e fuso, nome do espaço, convite e senha |

## Detalhes que valem nota

- **Guarda sozinho.** Check-in, termômetro, pedido da semana, revisão do mês e a resposta do
  dia não têm botão de salvar: gravam ao marcar ou enquanto se digita, com um selo discreto
  mostrando o horário do último salvamento.
- **Tempo real.** Cada aba mantém um canal aberto (Server-Sent Events). Quando uma pessoa
  registra algo, a tela da outra se atualiza sozinha — e espera, se ela estiver no meio de
  uma frase.
- **Histórico legível.** Toda mexida vira uma linha em português ("guardou R$ 300,00 em
  Passagem de dezembro"). Edições seguidas no mesmo registro são agrupadas.
- **Segredos filtrados no servidor.** Uma cápsula do tempo chega ao destinatário sem título
  nem texto até a data de abertura; um presente marcado como surpresa aparece para quem vai
  ganhar como se ainda não tivesse sido comprado.
- **Dois temas** (roxo e preto / verde e preto), escolhidos por pessoa.

## Estrutura

```
servidor.js     servidor HTTP, rotas, arquivos estáticos e o canal de tempo real
api.js          regras de negócio (filtro por casal, Norte único, segredos)
atividades.js   histórico do que cada um mexeu, em frases
auth.js         senhas (scrypt), sessões e cookie
esquema.js      campos aceitos em cada coleção — nada fora daqui entra no banco
dados.js        leitura e escrita do banco em JSON, com escrita atômica
perguntas.js    banco das perguntas do dia
dados/          dados.json (criado sozinho na primeira execução, fora do versionamento)
publico/        interface: index.html, entrar.html, css/estilo.css e js/
```

## Backup

Todo o conteúdo fica em `dados/dados.json`. Copiar esse arquivo é o backup completo;
restaurar é colocá-lo de volta e reiniciar o servidor. Essa pasta está no `.gitignore` —
os dados do casal nunca sobem para o repositório.

## Hospedagem

1. Suba os arquivos em um serviço com Node (Render, Railway, Fly.io ou uma VPS).
2. Rode `npm start` com a porta que o serviço informar (variável `PORTA`).
3. Use HTTPS na frente e defina `HTTPS=1` no ambiente — isso marca o cookie de sessão
   como `Secure`.
4. Aponte um domínio.

Sem HTTPS o sistema funciona, mas a senha trafega em texto aberto na rede.

## Ainda dá para fazer

- Tarefas com responsável e prazo, e hábitos em dupla com sequência.
- Aviso por e-mail ou push quando uma data importante estiver chegando.
- Aplicativo Android empacotado a partir do mesmo endereço.

---

Projeto pessoal. Sem licença de uso — todos os direitos reservados.
