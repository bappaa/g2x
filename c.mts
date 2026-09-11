import {createClient} from "@libsql/client";
const db=createClient({url:"file:./g2x.db"});
console.log((await db.execute("SELECT code FROM orders ORDER BY created_at DESC LIMIT 1")).rows[0].code);
