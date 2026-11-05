import express from 'express';
import { query, transaction } from '../db/db.js';
import { authenticate, requireCharacter } from '../middleware/auth.js';
import { getIO, sendNotificationToProfile } from '../services/socket.service.js';
import { uploadMedia } from '../middleware/upload.js';
import { actionLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

/**
 * Get Planetary Social Feed (Paginated)
 */
router.get('/feed', authenticate, requireCharacter, async (req, res) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    const offset = (page - 1) * limit;

    const postsRes = await query(`
      SELECT sp.*, p.character_name, p.username, a.sprite_url,
             (SELECT COUNT(*) FROM comments c WHERE c.post_id = sp.id) AS comments_count,
             EXISTS(SELECT 1 FROM reactions r WHERE r.post_id = sp.id AND r.profile_id = $1) AS user_liked
      FROM social_posts sp
      JOIN player_profiles p ON p.id = sp.profile_id
      LEFT JOIN avatars a ON a.id = p.avatar_id
      WHERE sp.planet_id = $2
      ORDER BY sp.created_at DESC
      LIMIT $3 OFFSET $4;
    `, [req.user.profile_id, req.user.planet_id || 1, limit, offset]);

    return res.json({
      posts: postsRes.rows,
      page,
      hasMore: postsRes.rows.length === limit
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch social feed: ' + err.message });
  }
});

/**
 * Create Social Post (With optional hashtags and media)
 */
router.post('/posts', authenticate, requireCharacter, actionLimiter, async (req, res) => {
  try {
    const { content, hashtags = [] } = req.body;
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Post content cannot be empty.' });
    }

    // Extract hashtags from content if not explicitly sent
    const extractedTags = hashtags.length > 0 
      ? hashtags 
      : (content.match(/#[a-z0-9_]+/gi) || []).map(t => t.slice(1));

    const insertRes = await query(`
      INSERT INTO social_posts (profile_id, planet_id, content, hashtags, is_npc)
      VALUES ($1, $2, $3, $4, FALSE)
      RETURNING *;
    `, [req.user.profile_id, req.user.planet_id || 1, content.trim(), extractedTags]);

    const post = insertRes.rows[0];

    // Award initial mission progress if active
    await query(`
      UPDATE player_missions 
      SET progress = progress + 1 
      WHERE profile_id = $1 AND status = 'active' AND mission_id IN (
        SELECT id FROM missions WHERE requirements->>'type' = 'post'
      );
    `, [req.user.profile_id]).catch(() => {});

    // Broadcast new post via Socket.IO
    const io = getIO();
    if (io) {
      io.to(`planet_${req.user.planet_id || 1}`).emit('new_social_post', {
        id: post.id,
        character_name: req.user.character_name,
        username: req.user.username,
        content: post.content,
        hashtags: post.hashtags,
        created_at: post.created_at,
        likes_count: 0,
        comments_count: 0,
        user_liked: false
      });
    }

    return res.status(201).json({ success: true, post });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create post: ' + err.message });
  }
});

/**
 * Comment on Post
 */
router.post('/posts/:id/comment', authenticate, requireCharacter, actionLimiter, async (req, res) => {
  try {
    const postId = parseInt(req.params.id, 10);
    const { content } = req.body;
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Comment cannot be empty.' });
    }

    const commentRes = await query(`
      INSERT INTO comments (post_id, profile_id, content)
      VALUES ($1, $2, $3)
      RETURNING *;
    `, [postId, req.user.profile_id, content.trim()]);

    await query('UPDATE social_posts SET comments_count = comments_count + 1 WHERE id = $1;', [postId]);

    // Notify post author if different
    const postAuthorRes = await query('SELECT profile_id FROM social_posts WHERE id = $1;', [postId]);
    const authorId = postAuthorRes.rows[0]?.profile_id;
    if (authorId && authorId !== req.user.profile_id) {
      const notifRes = await query(`
        INSERT INTO notifications (profile_id, title, message, type, action_url)
        VALUES ($1, 'New Comment', $2, 'social', '/social.html')
        RETURNING *;
      `, [authorId, `${req.user.character_name} commented on your broadcast.`]);
      sendNotificationToProfile(authorId, notifRes.rows[0]);
    }

    return res.json({
      success: true,
      comment: {
        ...commentRes.rows[0],
        character_name: req.user.character_name,
        username: req.user.username
      }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to comment.' });
  }
});

/**
 * React / Like a Post
 */
router.post('/posts/:id/react', authenticate, requireCharacter, async (req, res) => {
  try {
    const postId = parseInt(req.params.id, 10);
    const { reactionType = 'like' } = req.body;

    const existing = await query(`
      SELECT id FROM reactions WHERE post_id = $1 AND profile_id = $2;
    `, [postId, req.user.profile_id]);

    let liked = false;
    if (existing.rows.length > 0) {
      // Remove reaction
      await query('DELETE FROM reactions WHERE id = $1;', [existing.rows[0].id]);
      await query('UPDATE social_posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = $1;', [postId]);
      liked = false;
    } else {
      // Add reaction
      await query(`
        INSERT INTO reactions (post_id, profile_id, reaction_type)
        VALUES ($1, $2, $3);
      `, [postId, req.user.profile_id, reactionType]);
      await query('UPDATE social_posts SET likes_count = likes_count + 1 WHERE id = $1;', [postId]);
      liked = true;
    }

    return res.json({ success: true, liked });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to react to post.' });
  }
});

/**
 * List Friends and Social Connections
 */
router.get('/friends', authenticate, requireCharacter, async (req, res) => {
  try {
    const friendsRes = await query(`
      SELECT p.id, p.character_name, p.username, p.level, p.is_online, p.virtual_age,
             a.sprite_url, f.status, f.created_at AS friendship_date
      FROM friendships f
      JOIN player_profiles p ON (
        CASE 
          WHEN f.profile_id_1 = $1 THEN f.profile_id_2 = p.id
          ELSE f.profile_id_1 = p.id
        END
      )
      LEFT JOIN avatars a ON a.id = p.avatar_id
      WHERE (f.profile_id_1 = $1 OR f.profile_id_2 = $1)
        AND f.status = 'accepted';
    `, [req.user.profile_id]);

    const pendingRes = await query(`
      SELECT f.id AS request_id, p.id AS requester_profile_id, p.character_name, p.username, a.sprite_url
      FROM friendships f
      JOIN player_profiles p ON p.id = f.profile_id_1
      LEFT JOIN avatars a ON a.id = p.avatar_id
      WHERE f.profile_id_2 = $1 AND f.status = 'pending';
    `, [req.user.profile_id]);

    return res.json({
      friends: friendsRes.rows,
      pendingRequests: pendingRes.rows
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch friends.' });
  }
});

/**
 * Send Friend Request
 */
router.post('/friends/request', authenticate, requireCharacter, async (req, res) => {
  try {
    const { targetProfileId } = req.body;
    const targetId = parseInt(targetProfileId, 10);

    if (targetId === req.user.profile_id) {
      return res.status(400).json({ error: 'Cannot friend yourself.' });
    }

    const check = await query(`
      SELECT id, status FROM friendships 
      WHERE (profile_id_1 = $1 AND profile_id_2 = $2)
         OR (profile_id_1 = $2 AND profile_id_2 = $1);
    `, [req.user.profile_id, targetId]);

    if (check.rows.length > 0) {
      return res.status(400).json({ error: `Connection already exists with status: ${check.rows[0].status}` });
    }

    await query(`
      INSERT INTO friendships (profile_id_1, profile_id_2, status)
      VALUES ($1, $2, 'pending');
    `, [req.user.profile_id, targetId]);

    // Send notification
    const notifRes = await query(`
      INSERT INTO notifications (profile_id, title, message, type, action_url)
      VALUES ($1, 'Friend Request', $2, 'social', '/friends.html')
      RETURNING *;
    `, [targetId, `${req.user.character_name} sent you a connection request.`]);
    sendNotificationToProfile(targetId, notifRes.rows[0]);

    return res.json({ success: true, message: 'Friend request sent.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to send friend request: ' + err.message });
  }
});

/**
 * Accept Friend Request
 */
router.post('/friends/accept', authenticate, requireCharacter, async (req, res) => {
  try {
    const { requestId } = req.body;
    await query(`
      UPDATE friendships 
      SET status = 'accepted', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND profile_id_2 = $2;
    `, [requestId, req.user.profile_id]);

    return res.json({ success: true, message: 'Connection established!' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to accept friend request.' });
  }
});

/**
 * Report Content / User (Section 18)
 */
router.post('/report', authenticate, requireCharacter, async (req, res) => {
  try {
    const { reportedProfileId, targetType, targetId, reason, details } = req.body;
    await query(`
      INSERT INTO reports (reporter_profile_id, reported_profile_id, target_type, target_id, reason, details)
      VALUES ($1, $2, $3, $4, $5, $6);
    `, [req.user.profile_id, reportedProfileId, targetType || 'profile', targetId, reason, details]);

    return res.json({ success: true, message: 'Report submitted securely to planetary moderation authorities.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to submit report.' });
  }
});

export default router;
