// One time setup of the local instance: create the local owner, then the data tables.
import { ownerLogin, rest, signIn, personalProjectId, tableIds, TABLES } from './lib.mjs';

const login = ownerLogin();
const setup = await rest('POST', '/rest/owner/setup', login);
console.log('owner setup', setup.status);
await signIn();
const projectId = await personalProjectId();
const existing = await tableIds(projectId);

for (const [name, columns] of Object.entries(TABLES)) {
  if (existing[name]) {
    console.log('table exists', name);
    continue;
  }
  const r = await rest('POST', `/rest/projects/${projectId}/data-tables`, {
    name,
    columns: columns.map((c) => {
      const [columnName, type = 'string'] = c.split(':');
      return { name: columnName, type };
    }),
  });
  console.log('table', name, r.status, r.status >= 300 ? JSON.stringify(r.json).slice(0, 200) : '');
}
