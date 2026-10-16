import {DatabaseSync} from 'node:sqlite';
import {readFile,readdir} from 'node:fs/promises';
export async function localD1(filename=':memory:'){
 const sqlite=new DatabaseSync(filename);sqlite.exec('CREATE TABLE IF NOT EXISTS _local_migrations (name TEXT PRIMARY KEY)');
 for(const file of (await readdir(new URL('../drizzle/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort()){if(!sqlite.prepare('SELECT name FROM _local_migrations WHERE name=?').get(file)){sqlite.exec(await readFile(new URL('../drizzle/'+file,import.meta.url),'utf8'));sqlite.prepare('INSERT INTO _local_migrations(name) VALUES(?)').run(file);}}
 function statement(sql,args=[]){return {bind(...values){return statement(sql,values)},async run(){sqlite.prepare(sql).run(...args);return {success:true}},async all(){return {results:sqlite.prepare(sql).all(...args),success:true}}};}
 return {sqlite,prepare:sql=>statement(sql),batch:async queries=>{sqlite.exec('BEGIN');try{const results=await Promise.all(queries.map(q=>q.all()));sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
}
