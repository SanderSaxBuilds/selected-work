import { CALENDARS, parseDateKey, safeStoredEvents } from './daybreak-model.mjs';

export function readBackup(text) {
  if (typeof text !== 'string' || text.length > 2 * 1024 * 1024) throw new Error('Choose a Daybreak JSON backup smaller than 2 MB.');
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('This file is not valid JSON. The current plan has not changed.'); }
  if (!data || data.kind !== 'daybreak-plan' || data.schemaVersion !== 1 || !Array.isArray(data.events) || data.events.length > 5000) throw new Error('Unsupported Daybreak backup. Use schema 1 with at most 5,000 blocks.');
  if (!parseDateKey(data.selectedDate)) throw new Error('The backup has an invalid selected date.');
  if (!['day','week'].includes(data.view)) throw new Error('The backup has an invalid planner view.');
  if (!Array.isArray(data.filters) || data.filters.some(name => !CALENDARS.includes(name)) || new Set(data.filters).size !== data.filters.length) throw new Error('The backup has invalid calendar filters.');
  if (data.events.some(event => !event || typeof event.id !== 'string' || event.id.length < 1 || event.id.length > 100 || typeof event.protected !== 'boolean' || typeof event.duration !== 'number')) throw new Error('The backup has an invalid block identity, protection flag or duration.');
  const checked = safeStoredEvents(data.events);
  if (checked.length !== data.events.length) throw new Error('The backup contains invalid or duplicate blocks. The current plan has not changed.');
  const events = checked.map(({id,date,title,start,duration,calendar,protected:protectedTime}) => ({id,date,title,start,duration,calendar,protected:protectedTime}));
  return {events,selectedDate:data.selectedDate,view:data.view,filters:[...data.filters]};
}

export function writeBackup(state) {
  const payload = {kind:'daybreak-plan',schemaVersion:1,exportedAt:new Date().toISOString(),events:state.events,selectedDate:state.selectedDate,view:state.view,filters:state.filters};
  const checked = readBackup(JSON.stringify(payload));
  return JSON.stringify({...payload,...checked},null,2);
}
