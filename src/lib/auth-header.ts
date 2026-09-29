/**
 * Header interno com o id do usuário já validado pelo middleware (auth.getUser).
 * O middleware apaga qualquer valor vindo do navegador antes de gravar o seu,
 * então o servidor pode confiar nele e pular a segunda ida à Auth.
 */
export const AUTH_USER_ID_HEADER = "x-sama-auth-user-id";
