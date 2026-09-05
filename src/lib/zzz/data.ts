import agentsData from '../../../data/zzz/agents.json';
import wEnginesData from '../../../data/zzz/w-engines.json';
import discSetsData from '../../../data/zzz/disc-sets.json';
import { isSpecialty } from './constants';

export interface ZzzAgent {
  id: string;
  game8Id: string;
  name: string;
  specialty: string;
  attribute?: string | null;
  rarity?: string | null;
  icon?: string | null;
}
export interface ZzzWEngine {
  id: string;
  game8Id: string;
  name: string;
  specialty: string;
  rarity: string;
  icon?: string | null;
}
export interface ZzzDiscSet {
  id: string;
  game8Id: string;
  name: string;
  icon?: string | null;
}

const agents = agentsData as ZzzAgent[];
const wEngines = wEnginesData as ZzzWEngine[];
const discSets = discSetsData as ZzzDiscSet[];

function assertCatalog<T extends { id: string; game8Id: string; name: string }>(
  entries: T[],
  label: string
): void {
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const entry of entries) {
    if (!entry.id.trim() || !entry.game8Id.trim() || !entry.name.trim()) {
      throw new Error(`${label} contiene una entrada incompleta`);
    }
    const normalizedName = entry.name.trim().toLowerCase();
    if (ids.has(entry.id) || names.has(normalizedName)) {
      throw new Error(`${label} contiene IDs o nombres duplicados`);
    }
    ids.add(entry.id);
    names.add(normalizedName);
  }
}

assertCatalog(agents, 'agents.json');
assertCatalog(wEngines, 'w-engines.json');
assertCatalog(discSets, 'disc-sets.json');
if (agents.some((a) => !isSpecialty(a.specialty)) || wEngines.some((w) => !isSpecialty(w.specialty))) {
  throw new Error('El catálogo ZZZ contiene una especialidad desconocida');
}

const agentById = new Map(agents.map((a) => [a.id, a]));
const agentByName = new Map(agents.map((a) => [a.name.trim().toLowerCase(), a]));
const wEngineById = new Map(wEngines.map((w) => [w.id, w]));
const wEngineByName = new Map(wEngines.map((w) => [w.name.trim().toLowerCase(), w]));
const discSetByName = new Map(discSets.map((d) => [d.name.trim().toLowerCase(), d]));
const discSetById = new Map(discSets.map((d) => [d.id, d]));

export function getAgentByName(name: string): ZzzAgent | undefined {
  return agentByName.get(name.trim().toLowerCase());
}
export function getAgentById(id: string): ZzzAgent | undefined {
  return agentById.get(id.trim());
}
export function getWEngineById(id: string): ZzzWEngine | undefined {
  return wEngineById.get(id.trim());
}
export function getWEngineByName(name: string): ZzzWEngine | undefined {
  return wEngineByName.get(name.trim().toLowerCase());
}
export function getDiscSetByName(name: string): ZzzDiscSet | undefined {
  return discSetByName.get(name.trim().toLowerCase());
}
export function getDiscSetById(id: string): ZzzDiscSet | undefined {
  return discSetById.get(id.trim());
}
export function listAgents(): ZzzAgent[] {
  return agents;
}
export function listWEngines(specialty?: string): ZzzWEngine[] {
  if (!specialty) return wEngines;
  return wEngines.filter((w) => w.specialty === specialty);
}
export function listDiscSets(): ZzzDiscSet[] {
  return discSets;
}
function score(q: string, name: string): number {
  const a = name.toLowerCase();
  const b = q.trim().toLowerCase();
  if (a === b) return 0;
  if (a.startsWith(b)) return 1;
  if (a.split(/\s+/).some((w) => w.startsWith(b))) return 2;
  if (a.includes(b)) return 3;
  return -1;
}
export function searchWEngines(query: string, specialty?: string, limit = 8): ZzzWEngine[] {
  let pool = specialty ? wEngines.filter((w) => w.specialty === specialty) : wEngines;
  if (!query.trim()) return pool.slice(0, limit);
  const ranked = pool
    .map((w) => ({ w, s: score(query, w.name) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => a.s - b.s || a.w.name.localeCompare(b.w.name))
    .slice(0, limit)
    .map((x) => x.w);
  return ranked;
}
export function searchDiscSets(query: string, limit = 8): ZzzDiscSet[] {
  if (!query.trim()) return discSets.slice(0, limit);
  return discSets
    .map((d) => ({ d, s: score(query, d.name) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => a.s - b.s || a.d.name.localeCompare(b.d.name))
    .slice(0, limit)
    .map((x) => x.d);
}
export function searchAgents(query: string, limit = 8): ZzzAgent[] {
  if (!query.trim()) return agents.slice(0, limit);
  return agents
    .map((a) => ({ a, s: score(query, a.name) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => a.s - b.s || a.a.name.localeCompare(b.a.name))
    .slice(0, limit)
    .map((x) => x.a);
}
