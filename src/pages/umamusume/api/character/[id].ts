import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { lookupSession, readCookie } from '../../../../lib/auth';
import { getCharacter, getRecommendations, cards } from '../../../../lib/uma/data';

export const prerender = false;

export const GET: APIRoute = async ({ params, request }) => {
  const sessionId = readCookie(request);
  const sess = sessionId ? await lookupSession(env.AUTH_DB, sessionId) : null;
  if (!sess) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }
  const characterId = params.id;
  if (!characterId) {
    return new Response(JSON.stringify({ error: 'id required' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }
  const character = getCharacter(characterId);
  if (!character) {
    return new Response(JSON.stringify({ error: 'unknown character' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    });
  }
  const recommendations = getRecommendations(characterId);

  // Resolver card IDs → objetos completos (con icon + nombre) para el cliente.
  const cardByGame8Id = new Map(cards.map((c) => [c.game8Id, c]));
  const resolve = (ids: string[]) =>
    ids.map((id) => cardByGame8Id.get(id)).filter((c): c is NonNullable<typeof c> => c != null);

  const payload = recommendations
    ? {
        character,
        recommendations: {
          scenario: recommendations.scenario,
          main: resolve(recommendations.main),
          budget: resolve(recommendations.budget),
          alternates: {
            speed: resolve(recommendations.alternates.speed),
            power: resolve(recommendations.alternates.power),
            wit: resolve(recommendations.alternates.wit),
          },
        },
      }
    : { character, recommendations: null };

  return new Response(JSON.stringify(payload), {
    headers: { 'content-type': 'application/json' },
  });
};