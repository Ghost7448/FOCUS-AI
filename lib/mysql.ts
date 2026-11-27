import mysql, { type Pool, type PoolOptions } from "mysql2/promise";
declare global { var focusMysqlPool: Pool | undefined; }
function createPool() {
  const common: PoolOptions = { waitForConnections:true, connectionLimit:Number(process.env.DB_CONNECTION_LIMIT || 10), queueLimit:0, charset:"utf8mb4", timezone:"Z", decimalNumbers:true };
  const uri=process.env.DATABASE_URL;
  if(uri){
    const parsed=new URL(uri);
    if(parsed.protocol!=="mysql:" && parsed.protocol!=="mysql2:") throw new Error("DATABASE_URL must use mysql://.");
    return mysql.createPool({...common,host:parsed.hostname,port:Number(parsed.port||3306),user:decodeURIComponent(parsed.username),password:decodeURIComponent(parsed.password),database:decodeURIComponent(parsed.pathname.replace(/^\//,"")),ssl:process.env.DB_SSL==="true"?{rejectUnauthorized:true}:undefined});
  }
  const host=process.env.DB_HOST, user=process.env.DB_USER, database=process.env.DB_NAME;
  if(!host||!user||!database) throw new Error("MySQL is not configured. Set DATABASE_URL or DB_HOST, DB_USER and DB_NAME.");
  return mysql.createPool({...common,host,port:Number(process.env.DB_PORT||3306),user,password:process.env.DB_PASSWORD||"",database,ssl:process.env.DB_SSL==="true"?{rejectUnauthorized:true}:undefined});
}
export const db=globalThis.focusMysqlPool??createPool();
if(process.env.NODE_ENV!=="production") globalThis.focusMysqlPool=db;
