import { db } from "@/db";
import { handleApi } from "@/server/http";

export const dynamic = "force-dynamic";

const handler = (req: Request) => handleApi(req, db);
export { handler as GET, handler as POST };
