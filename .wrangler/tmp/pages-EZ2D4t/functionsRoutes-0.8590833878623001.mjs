import { onRequestPost as __api_signin_ts_onRequestPost } from "/Users/chloedu/Game 1/functions/api/signin.ts"
import { onRequestPost as __api_signup_ts_onRequestPost } from "/Users/chloedu/Game 1/functions/api/signup.ts"

export const routes = [
    {
      routePath: "/api/signin",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_signin_ts_onRequestPost],
    },
  {
      routePath: "/api/signup",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_signup_ts_onRequestPost],
    },
  ]