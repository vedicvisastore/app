import { adminRouter } from "./routers/admin";
import { accountRouter, authRouter, cartRouter, catalogRouter, checkoutRouter, pincodeRouter, trackRouter } from "./routers/store";
import { createCallerFactory, router } from "./trpc";

export const appRouter = router({
  auth: authRouter,
  catalog: catalogRouter,
  cart: cartRouter,
  pincode: pincodeRouter,
  account: accountRouter,
  checkout: checkoutRouter,
  track: trackRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
export const createCaller = createCallerFactory(appRouter);
