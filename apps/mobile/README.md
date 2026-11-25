# PagaMOZ: app móvel

Expo (React Native) com Expo Router. Usa a mesma API Django da web.

## Correr

1. Ligue a API (`.\tasks.ps1 demo` na raiz, ou o servidor `api`).
2. Para um telemóvel na mesma rede Wi-Fi, a API tem de aceitar o IP do computador. Em `apps/api/.env`:
   ```
   ALLOWED_HOSTS=localhost,127.0.0.1,192.168.1.50
   ```
   e arranque-a em `0.0.0.0:8000` (`manage.py runserver 0.0.0.0:8000`).
3. Nesta pasta:
   ```
   npm install
   npx expo start
   ```
   Leia o QR com a app **Expo Go** (Android) ou com a câmara (iPhone).

A app descobre a API sozinha (o IP do computador que corre o Expo, porta 8000).
Para outra morada: `EXPO_PUBLIC_API_URL=https://api.exemplo.mz npx expo start`.

Para ver no browser: `npx expo start --web` (porta 8081; a API já aceita essa origem em desenvolvimento).

## Ecrãs

- **Início:** pesquisa, assuntos, mais usados (electricidade, recarga, TV), acompanhar um pagamento.
- **Serviços:** lista por assunto; serviços do mesmo tema num só cartão com escolha da operadora ou fornecedor.
- **Pagar:** 3 passos (dados, confirmar, pagar) com M-Pesa, e-Mola, mKesh, cartão (3-D Secure), referência bancária e QR.
- **Pagamento:** estado ao vivo, código de entrega (ex.: Credelec), referência para o banco, QR e comprovativo PDF.
- **Verificar:** autenticidade de um comprovativo pelo código.
- **Conta:** entrar por SMS (código de 6 algarismos) e ver o histórico.

O número completo do cartão e o CVV nunca saem do telemóvel: só seguem a marca, os últimos 4 algarismos e um token.

## Verificar antes de entregar

```
npx tsc --noEmit
npx expo export --platform android
```

## Ícone e ecrã de abertura

Gerados a partir do logótipo da web (o "P" com o visto vermelho) em `assets/`.
Os logótipos das marcas estão em `assets/logos` (cópia de `apps/web/public/logos`).
