# Blog da Informação

Blog estático responsivo com 21 jornadas e painel administrativo com autenticação no servidor. Destino: GitHub → build Netlify.

## Estrutura

- `public/`: páginas, fotos, estilos e painel `/admin/`.
- `netlify/functions/api.mjs`: API e redirecionamento global.
- `netlify/lib/core.mjs`: autenticação, autorização, validação e sessões.
- `tests/admin.test.mjs`: testes do fluxo administrativo.
- `netlify.toml`: publicação de `public/`, bundler e funções.

## Publicar

1. Enviar este projeto para o repositório `blogdainformacao` no GitHub, sem o arquivo `.env`.
2. Na Netlify, importar o repositório e usar a configuração de `netlify.toml`.
3. Configurar `ADMIN_USERNAME`, `ADMIN_PASSWORD_SALT` e `ADMIN_PASSWORD_HASH` como variáveis de ambiente das Functions; os valores preparados ficam apenas no `.env` local ignorado pelo Git. A senha não é armazenada em texto puro nem incluída nos arquivos públicos.
4. Executar o deploy e definir o nome do site como `blogdainformacao`, se estiver disponível.
5. Entrar em `/admin/` e salvar o link oficial.

Não publicar só a pasta `public/` por upload estático: o painel requer Netlify Functions, Netlify Blobs e as variáveis de ambiente.

## Atualização global

O painel salva um único endereço HTTPS no armazenamento persistente do site (Netlify Blobs). Todos os botões de chamada para o programa consultam `/api/config` e encaminham para `/go`, que lê o destino atual no servidor. Navegação interna e referências editoriais não são substituídas.

O armazenamento é compartilhado entre deploys do mesmo site, com consistência forte. Nenhum link é configurado inicialmente. O painel mostra mensagem de sucesso somente após confirmação do servidor.

## Autenticação

Verificação de senha via scrypt com salt, comparação de hash, sessão de oito horas em cookie `HttpOnly`, `Secure`, `SameSite=Strict`, token aleatório persistido somente como hash, proteção de origem em alterações e limitação de tentativas de login. Não há senha embutida no JavaScript público.

## Verificar

`npm run check` executa validação de sintaxe e testes para rejeição de alterações sem login, origem indevida, login, atualização global, redirecionamento, logout, destinos inválidos e limitação de tentativas.

O link oficial permanece pendente. As narrativas são ilustrativas; o site não se apresenta como órgão oficial e não realiza inscrições.
