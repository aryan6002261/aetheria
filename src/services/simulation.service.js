import { query, transaction } from '../db/db.js';
import { generateNewspaperArticle } from './ai.service.js';
import { getIO } from './socket.service.js';

export async function advanceWorldTick() {
  try {
    // 1. Advance Planet Calendar (Day / Year progression)
    const planetsRes = await query(`
      SELECT id, name, world_year, world_day 
      FROM planets 
      WHERE is_discovered = TRUE;
    `);

    for (const planet of planetsRes.rows) {
      let nextDay = planet.world_day + 1;
      let nextYear = planet.world_year;
      if (nextDay > 365) {
        nextDay = 1;
        nextYear += 1;
      }

      await query(`
        UPDATE planets 
        SET world_day = $1, world_year = $2 
        WHERE id = $3;
      `, [nextDay, nextYear, planet.id]);

      // Broadcast world calendar tick via Socket.IO
      const io = getIO();
      if (io) {
        io.to(`planet_${planet.id}`).emit('world_tick', {
          planetId: planet.id,
          worldYear: nextYear,
          worldDay: nextDay,
        });
      }
    }

    // 2. Autonomous NPC Social Simulation
    // Pick an active NPC to occasionally post a status or insight
    const randomNpcRes = await query(`
      SELECT id, name, occupation, personality 
      FROM npc_characters 
      ORDER BY RANDOM() 
      LIMIT 1;
    `);

    if (randomNpcRes.rows.length > 0) {
      const npc = randomNpcRes.rows[0];
      const npcPosts = [
        `${npc.name} (${npc.occupation}): Observational telemetry indicates optimal atmospheric stability over Solaris Basin today. #VeridiaLife`,
        `${npc.name}: Conducting research updates at the central laboratory. Innovation waits for no one. #ScienceAndProgress`,
        `${npc.name}: Great turnout at the morning civic forum in Aethel City. The future of our technocracy is citizen-powered. #NeoArcadia`,
        `${npc.name}: New commercial listings look promising on the exchange. Support your local independent manufacturers! #OpenMarket`
      ];

      const postContent = npcPosts[Math.floor(Math.random() * npcPosts.length)];
      
      // Look up admin/system profile to author the NPC post
      const sysProfileRes = await query(`SELECT id, planet_id FROM player_profiles LIMIT 1;`);
      if (sysProfileRes.rows.length > 0) {
        const profile = sysProfileRes.rows[0];
        const postRes = await query(`
          INSERT INTO social_posts (profile_id, planet_id, content, hashtags, is_npc, likes_count)
          VALUES ($1, $2, $3, '{"Civilization", "VeridiaDaily"}', TRUE, FLOOR(RANDOM() * 20 + 5))
          RETURNING *;
        `, [profile.id, profile.planet_id, postContent]);

        const io = getIO();
        if (io) {
          io.to(`planet_${profile.planet_id}`).emit('new_social_post', {
            id: postRes.rows[0].id,
            authorName: npc.name,
            content: postContent,
            isNpc: true,
            createdAt: new Date().toISOString()
          });
        }
      }
    }

    // 3. Periodic AI World Newspaper Check
    // If there are un-newspapered historical records or periodically, generate an article
    const recentEventsRes = await query(`
      SELECT category, headline, article 
      FROM historical_records 
      ORDER BY recorded_at DESC 
      LIMIT 4;
    `);

    if (recentEventsRes.rows.length > 0) {
      // Newspaper is refreshed and stored in cache/DB
      const article = await generateNewspaperArticle({ events: recentEventsRes.rows });
      // Record summary event
      await query(`
        INSERT INTO historical_records (planet_id, world_year, world_day, category, headline, article)
        VALUES (1, 2185, (SELECT world_day FROM planets WHERE id = 1), 'culture', $1, $2);
      `, [article.headline, `${article.lead} \n\n ${article.body}`]).catch(() => {});
    }

  } catch (err) {
    console.error('[SIMULATION] Error during world simulation tick:', err);
  }
}

let tickInterval = null;
export function startSimulationWorker(intervalMs = 60000) {
  if (tickInterval) clearInterval(tickInterval);
  console.log(`[SIMULATION] Starting persistent world simulation worker (interval: ${intervalMs / 1000}s)...`);
  tickInterval = setInterval(advanceWorldTick, intervalMs);
}

export function stopSimulationWorker() {
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
    console.log('[SIMULATION] Simulation worker stopped.');
  }
}

export default {
  advanceWorldTick,
  startSimulationWorker,
  stopSimulationWorker,
};

