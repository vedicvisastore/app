import { adminRouter } from "./routers/admin";
import { accountRouter, authRouter, cartRouter, catalogRouter, checkoutRouter, pincodeRouter } from "./routers/store";
import { createCallerFactory, router } from "./trpc";

export const appRouter = router({
  auth: authRouter,
  catalog: catalogRouter,
  cart: cartRouter,
  pincode: pincodeRouter,
  account: accountRouter,
  checkout: checkoutRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
export const createCaller = createCallerFactory(appRouter);
