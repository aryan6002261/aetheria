import express from 'express';
import { query, transaction } from '../db/db.js';
import { authenticate, requireCharacter } from '../middleware/auth.js';
import { transferFunds } from '../services/economy.service.js';
import { sendNotificationToProfile } from '../services/socket.service.js';

const router = express.Router();

/**
 * Browse Marketplace Listings
 */
router.get('/listings', authenticate, requireCharacter, async (req, res) => {
  try {
    const planetId = req.user.planet_id || 1;
    const listingsRes = await query(`
      SELECT ml.*, p.name AS product_name, p.category AS product_category, p.quality_rating,
             prof.character_name AS seller_name, prof.username AS seller_username,
             b.name AS business_name
      FROM marketplace_listings ml
      LEFT JOIN products p ON p.id = ml.product_id
      LEFT JOIN player_profiles prof ON prof.id = ml.seller_profile_id
      LEFT JOIN businesses b ON b.id = p.business_id
      WHERE ml.planet_id = $1 AND ml.status = 'active' AND ml.quantity > 0
      ORDER BY ml.created_at DESC;
    `, [planetId]);

    return res.json({ listings: listingsRes.rows });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch marketplace listings: ' + err.message });
  }
});

/**
 * Purchase Marketplace Item (Server-Authoritative Atomic Transaction)
 */
router.post('/buy/:id', authenticate, requireCharacter, async (req, res) => {
  try {
    const listingId = parseInt(req.params.id, 10);
    const planetId = req.user.planet_id || 1;

    // Fetch listing
    const listingRes = await query('SELECT * FROM marketplace_listings WHERE id = $1 AND status = $2;', [listingId, 'active']);
    if (listingRes.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found or no longer available.' });
    }
    const listing = listingRes.rows[0];

    if (listing.seller_profile_id === req.user.profile_id) {
      return res.status(400).json({ error: 'Cannot purchase your own listing.' });
    }

    if (listing.quantity < 1) {
      return res.status(400).json({ error: 'This item is out of stock.' });
    }

    const price = parseFloat(listing.price);

    // Execute atomic wallet transfer
    await transferFunds({
      planetId,
      fromProfileId: req.user.profile_id,
      toProfileId: listing.seller_profile_id,
      amount: price,
      transactionType: 'purchase',
      referenceType: 'marketplace',
      referenceId: listing.id,
      description: `Purchase of "${listing.title}"`
    });

    // Update listing quantity
    await query(`
      UPDATE marketplace_listings 
      SET quantity = quantity - 1, 
          status = CASE WHEN quantity - 1 <= 0 THEN 'sold' ELSE 'active' END 
      WHERE id = $1;
    `, [listingId]);

    // If linked to product, update product stock
    if (listing.product_id) {
      await query(`
        UPDATE products 
        SET stock_quantity = GREATEST(stock_quantity - 1, 0) 
        WHERE id = $1;
      `, [listing.product_id]);
    }

    // Notify seller
    const notifRes = await query(`
      INSERT INTO notifications (profile_id, title, message, type, action_url)
      VALUES ($1, 'Item Sold', $2, 'economic', '/wallet.html')
      RETURNING *;
    `, [listing.seller_profile_id, `Your listing "${listing.title}" was purchased for ₡${price.toFixed(2)} by ${req.user.character_name}.`]);
    sendNotificationToProfile(listing.seller_profile_id, notifRes.rows[0]);

    return res.json({
      success: true,
      message: `Successfully purchased "${listing.title}" for ₡${price.toFixed(2)}!`
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

export default router;

