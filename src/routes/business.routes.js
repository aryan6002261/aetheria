import express from 'express';
import { query, transaction } from '../db/db.js';
import { authenticate, requireCharacter } from '../middleware/auth.js';
import { deductFunds } from '../services/economy.service.js';

const router = express.Router();

/**
 * Get Businesses Owned by Player & Directory
 */
router.get('/my-businesses', authenticate, requireCharacter, async (req, res) => {
  try {
    const myBizRes = await query(`
      SELECT b.*, c.name AS country_name, ci.name AS city_name,
             (SELECT COUNT(*) FROM products p WHERE p.business_id = b.id) AS products_count,
             (SELECT COUNT(*) FROM business_employees be WHERE be.business_id = b.id) AS employees_count
      FROM businesses b
      JOIN countries c ON c.id = b.country_id
      JOIN cities ci ON ci.id = b.city_id
      WHERE b.owner_profile_id = $1
      ORDER BY b.created_at DESC;
    `, [req.user.profile_id]);

    const allBizRes = await query(`
      SELECT b.*, p.character_name AS owner_name, ci.name AS city_name
      FROM businesses b
      JOIN player_profiles p ON p.id = b.owner_profile_id
      JOIN cities ci ON ci.id = b.city_id
      WHERE b.is_active = TRUE
      ORDER BY b.revenue DESC
      LIMIT 20;
    `);

    return res.json({
      myBusinesses: myBizRes.rows,
      directory: allBizRes.rows
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch businesses: ' + err.message });
  }
});

/**
 * Register New Business (Requires 500 Credits registration capital)
 */
router.post('/register', authenticate, requireCharacter, async (req, res) => {
  try {
    const { name, category, description, cityId } = req.body;
    if (!name || !category) {
      return res.status(400).json({ error: 'Business name and category are required.' });
    }

    const regFee = 500.00;
    const planetId = req.user.planet_id || 1;

    // Deduct registration capital from wallet
    await deductFunds({
      planetId,
      fromProfileId: req.user.profile_id,
      amount: regFee,
      transactionType: 'business_registration',
      description: `Registration fee for business: ${name}`
    });

    const cityRes = await query('SELECT id, country_id FROM cities WHERE id = $1;', [cityId || req.user.city_id || 1]);
    const countryId = cityRes.rows[0]?.country_id || 1;
    const finalCityId = cityRes.rows[0]?.id || 1;

    const bizRes = await query(`
      INSERT INTO businesses (
        planet_id, country_id, city_id, owner_profile_id, name, category, description, capital
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 1000.00)
      RETURNING *;
    `, [
      planetId,
      countryId,
      finalCityId,
      req.user.profile_id,
      name.trim(),
      category,
      description || 'A forward-thinking commercial enterprise.'
    ]);

    // Update mission progress if active
    await query(`
      UPDATE player_missions 
      SET progress = progress + 1 
      WHERE profile_id = $1 AND status = 'active' AND mission_id IN (
        SELECT id FROM missions WHERE requirements->>'type' = 'market'
      );
    `, [req.user.profile_id]).catch(() => {});

    return res.status(201).json({
      success: true,
      message: `Corporation "${name}" registered successfully!`,
      business: bizRes.rows[0]
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

/**
 * Create / Manufacture Virtual Product
 */
router.post('/:id/products', authenticate, requireCharacter, async (req, res) => {
  try {
    const bizId = parseInt(req.params.id, 10);
    const { name, category = 'General', description, costPrice, sellingPrice, stockQuantity = 20 } = req.body;

    const bizCheck = await query('SELECT id FROM businesses WHERE id = $1 AND owner_profile_id = $2;', [bizId, req.user.profile_id]);
    if (bizCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You do not own this business.' });
    }

    const prodRes = await query(`
      INSERT INTO products (
        business_id, name, category, description, cost_price, selling_price, stock_quantity
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `, [
      bizId,
      name.trim(),
      category,
      description || 'Quality engineered product.',
      parseFloat(costPrice) || 10.00,
      parseFloat(sellingPrice) || 25.00,
      parseInt(stockQuantity, 10) || 20
    ]);

    // Automatically list on marketplace
    await query(`
      INSERT INTO marketplace_listings (
        seller_profile_id, planet_id, product_id, title, description, price, quantity
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7);
    `, [
      req.user.profile_id,
      req.user.planet_id || 1,
      prodRes.rows[0].id,
      name.trim(),
      description,
      parseFloat(sellingPrice) || 25.00,
      parseInt(stockQuantity, 10) || 20
    ]);

    return res.status(201).json({
      success: true,
      message: `Product "${name}" manufactured and listed on Marketplace!`,
      product: prodRes.rows[0]
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create product: ' + err.message });
  }
});

export default router;
