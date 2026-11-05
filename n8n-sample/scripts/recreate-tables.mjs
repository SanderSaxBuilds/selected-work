import { signIn, rest, personalProjectId, tableIds, TABLES } from './lib.mjs';
await signIn();
const p = await personalProjectId();
const t = await tableIds(p);
for (const id of Object.values(t)) console.log('delete', (await rest('DELETE', `/rest/projects/${p}/data-tables/${id}`)).status);
for (const [name, columns] of Object.entries(TABLES)) {
  const r = await rest('POST', `/rest/projects/${p}/data-tables`, { name, columns: columns.map((c) => { const [n, type = 'string'] = c.split(':'); return { name: n, type }; }) });
  console.log(name, r.status);
}
