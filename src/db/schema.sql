-- ====================================================================
-- AETHERIA: PERSISTENT AI-POWERED VIRTUAL CIVILIZATION & SOCIAL SIMULATOR
-- MASTER POSTGRESQL SCHEMA (59 RELATIONAL TABLES)
-- ====================================================================

-- 1. USERS & AUTHENTICATION
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(100),
  role VARCHAR(30) DEFAULT 'player', -- 'player', 'moderator', 'admin', 'system'
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_auth_providers (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL, -- 'google', 'local_demo'
  provider_user_id VARCHAR(255) NOT NULL,
  profile_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider, provider_user_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  ip_address VARCHAR(45),
  user_agent TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. UNIVERSE HIERARCHY: GALAXY -> PLANET -> COUNTRY -> REGION -> CITY -> COMMUNITY
CREATE TABLE IF NOT EXISTS galaxies (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  coordinates VARCHAR(50) DEFAULT '0,0,0',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS planets (
  id SERIAL PRIMARY KEY,
  galaxy_id INTEGER NOT NULL REFERENCES galaxies(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  currency_name VARCHAR(50) DEFAULT 'Credits',
  currency_symbol VARCHAR(10) DEFAULT '₡',
  population INTEGER DEFAULT 0,
  is_discovered BOOLEAN DEFAULT TRUE,
  discovery_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  day_cycle INTEGER DEFAULT 24, -- hours
  world_year INTEGER DEFAULT 2185,
  world_day INTEGER DEFAULT 142,
  timeline_status VARCHAR(50) DEFAULT 'Golden Age of Expansion',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS countries (
  id SERIAL PRIMARY KEY,
  planet_id INTEGER NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(10) NOT NULL,
  description TEXT,
  capital_city VARCHAR(100),
  tax_rate NUMERIC(5,2) DEFAULT 8.50, -- percentage
  treasury_balance NUMERIC(16,2) DEFAULT 500000.00,
  government_type VARCHAR(50) DEFAULT 'Constitutional Technocracy',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(planet_id, name)
);

CREATE TABLE IF NOT EXISTS regions (
  id SERIAL PRIMARY KEY,
  country_id INTEGER NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  climate VARCHAR(50) DEFAULT 'Temperate Neo-Urban',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cities (
  id SERIAL PRIMARY KEY,
  region_id INTEGER NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
  country_id INTEGER NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  population INTEGER DEFAULT 1000,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS communities (
  id SERIAL PRIMARY KEY,
  city_id INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. AVATARS & CHARACTERS
CREATE TABLE IF NOT EXISTS avatars (
  id SERIAL PRIMARY KEY,
  style VARCHAR(50) DEFAULT 'cyber_pixel',
  hair VARCHAR(50) DEFAULT 'neon_blue_bob',
  skin VARCHAR(50) DEFAULT 'tone_2',
  eye_color VARCHAR(50) DEFAULT 'cyber_amber',
  clothing VARCHAR(50) DEFAULT 'titanium_jacket',
  accessories VARCHAR(50) DEFAULT 'holographic_visors',
  sprite_url TEXT DEFAULT '/img/avatars/default.png',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS player_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  planet_id INTEGER NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  country_id INTEGER NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  city_id INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  character_name VARCHAR(100) NOT NULL,
  username VARCHAR(50) UNIQUE NOT NULL,
  avatar_id INTEGER REFERENCES avatars(id) ON DELETE SET NULL,
  gender VARCHAR(30) DEFAULT 'Non-binary',
  virtual_age INTEGER DEFAULT 19,
  life_stage VARCHAR(30) DEFAULT 'Early Adulthood', -- 'Childhood', 'Primary Education', 'Teenage Life', 'University/Early Adulthood', 'Career/Adult', 'Senior Life', 'Elder Life'
  bio TEXT DEFAULT 'Citizen of the Frontier.',
  reputation INTEGER DEFAULT 100,
  experience_points INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  birth_mode VARCHAR(20) DEFAULT 'custom', -- 'custom' or 'random'
  is_online BOOLEAN DEFAULT FALSE,
  last_active_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS character_stats (
  id SERIAL PRIMARY KEY,
  profile_id INTEGER NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE UNIQUE,
  health INTEGER DEFAULT 100,
  energy INTEGER DEFAULT 100,
  happiness INTEGER DEFAULT 85,
  intellect INTEGER DEFAULT 50,
  charisma INTEGER DEFAULT 50,
  strength INTEGER DEFAULT 50,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS skills (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  category VARCHAR(50) NOT NULL, -- 'Technical', 'Social', 'Scientific', 'Artistic', 'Leadership'
  description TEXT,
  max_level INTEGER DEFAULT 100
);

CREATE TABLE IF NOT EXISTS player_skills (
  id SERIAL PRIMARY KEY,
  profile_id INTEGER NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  skill_id INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  level INTEGER DEFAULT 1,
  current_xp INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(profile_id, skill_id)
);

-- 4. FAMILY SYSTEM & HOUSEHOLDS
CREATE TABLE IF NOT EXISTS families (
  id SERIAL PRIMARY KEY,
  planet_id INTEGER NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  country_id INTEGER NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  family_name VARCHAR(100) NOT NULL,
  motto VARCHAR(255) DEFAULT 'Per Aspera Ad Astra',
  wealth_tier VARCHAR(50) DEFAULT 'Middle Class',
  accepting_children BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS family_members (
  id SERIAL PRIMARY KEY,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  profile_id INTEGER NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'Member', -- 'Parent', 'Guardian', 'Child', 'Sibling'
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(family_id, profile_id)
);

CREATE TABLE IF NOT EXISTS relationships (
  id SERIAL PRIMARY KEY,
  profile_id_1 INTEGER NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  profile_id_2 INTEGER NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  relationship_type VARCHAR(50) NOT NULL, -- 'Friend', 'Best Friend', 'Partner', 'Spouse', 'Rival', 'Mentor'
  status VARCHAR(30) DEFAULT 'active', -- 'pending', 'active', 'ended'
  closeness INTEGER DEFAULT 50, -- 0 to 100
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(profile_id_1, profile_id_2)
);

-- 5. EDUCATION & ACADEMIES
CREATE TABLE IF NOT EXISTS education_institutions (
  id SERIAL PRIMARY KEY,
  city_id INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'Primary School', 'Academy of Sciences', 'Polytechnic University', 'Arts Conservatory'
  description TEXT,
  tuition_fee NUMERIC(12,2) DEFAULT 0.00,
  reputation INTEGER DEFAULT 80,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS enrollments (
  id SERIAL PRIMARY KEY,
  profile_id INTEGER NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  institution_id INTEGER NOT NULL REFERENCES education_institutions(id) ON DELETE CASCADE,
  program_name VARCHAR(100) NOT NULL,
  status VARCHAR(30) DEFAULT 'enrolled', -- 'enrolled', 'graduated', 'dropped'
  grade_average NUMERIC(4,2) DEFAULT 88.50,
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- 6. CAREERS & EMPLOYMENT
CREATE TABLE IF NOT EXISTS jobs (
  id SERIAL PRIMARY KEY,
  country_id INTEGER NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  title VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL, -- 'Engineering', 'Medical', 'Governance', 'Commerce', 'Science', 'Arts'
  min_skill_level INTEGER DEFAULT 5,
  base_salary NUMERIC(12,2) NOT NULL DEFAULT 250.00,
  description TEXT,
  icon VARCHAR(50) DEFAULT 'bi-briefcase',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employment (
  id SERIAL PRIMARY KEY,
  profile_id INTEGER NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  business_id INTEGER, -- Optional: employed at private business
  status VARCHAR(30) DEFAULT 'active', -- 'active', 'resigned', 'promoted'
  salary NUMERIC(12,2) NOT NULL,
  performance INTEGER DEFAULT 75,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP WITH TIME ZONE
);

-- 7. BUSINESSES & COMMERCE
CREATE TABLE IF NOT EXISTS businesses (
  id SERIAL PRIMARY KEY,
  planet_id INTEGER NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  country_id INTEGER NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  city_id INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  owner_profile_id INTEGER NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  category VARCHAR(50) NOT NULL, -- 'Technology', 'Retail', 'Hospitality', 'Media', 'Manufacturing', 'Finance'
  description TEXT,
  capital NUMERIC(16,2) DEFAULT 5000.00,
  revenue NUMERIC(16,2) DEFAULT 0.00,
  reputation INTEGER DEFAULT 50,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS business_employees (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  profile_id INTEGER NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  position VARCHAR(100) DEFAULT 'Associate',
  wage NUMERIC(12,2) DEFAULT 150.00,
  hired_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(business_id, profile_id)
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  category VARCHAR(50) NOT NULL,
  description TEXT,
  cost_price NUMERIC(12,2) DEFAULT 10.00,
  selling_price NUMERIC(12,2) DEFAULT 25.00,
  stock_quantity INTEGER DEFAULT 100,
  quality_rating NUMERIC(3,1) DEFAULT 4.5,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS marketplace_listings (
  id SERIAL PRIMARY KEY,
  seller_profile_id INTEGER NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  planet_id INTEGER NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  title VARCHAR(150) NOT NULL,
  description TEXT,
  price NUMERIC(12,2) NOT NULL,
  quantity INTEGER DEFAULT 1,
  status VARCHAR(30) DEFAULT 'active', -- 'active', 'sold', 'cancelled'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. ECONOMY, WALLETS & LEDGER
CREATE TABLE IF NOT EXISTS wallets (
  id SERIAL PRIMARY KEY,
  profile_id INTEGER NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  planet_id INTEGER NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  balance NUMERIC(16,2) NOT NULL DEFAULT 500.00 CHECK (balance >= 0.00),
  is_locked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(profile_id, planet_id)
);

CREATE TABLE IF NOT EXISTS bank_accounts (
  id SERIAL PRIMARY KEY,
  profile_id INTEGER NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  planet_id INTEGER NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  account_number VARCHAR(50) UNIQUE NOT NULL,
  balance NUMERIC(16,2) NOT NULL DEFAULT 0.00 CHECK (balance >= 0.00),
  savings_rate NUMERIC(5,2) DEFAULT 2.50,
  loan_balance NUMERIC(16,2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  planet_id INTEGER NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  from_wallet_id INTEGER REFERENCES wallets(id) ON DELETE SET NULL,
  to_wallet_id INTEGER REFERENCES wallets(id) ON DELETE SET NULL,
  amount NUMERIC(16,2) NOT NULL CHECK (amount > 0),
  transaction_type VARCHAR(50) NOT NULL, -- 'transfer', 'salary', 'purchase', 'tax', 'reward', 'business_revenue'
  reference_type VARCHAR(50), -- 'marketplace', 'job', 'mission', 'direct'
  reference_id INTEGER,
  description TEXT,
  status VARCHAR(30) DEFAULT 'completed', -- 'completed', 'failed', 'refunded'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. GOVERNMENT & ELECTIONS
CREATE TABLE IF NOT EXISTS governments (
  id SERIAL PRIMARY KEY,
  country_id INTEGER NOT NULL REFERENCES countries(id) ON DELETE CASCADE UNIQUE,
  leader_profile_id INTEGER REFERENCES player_profiles(id) ON DELETE SET NULL,
  leader_name VARCHAR(100) DEFAULT 'Supreme Council',
  form VARCHAR(50) DEFAULT 'Democratic Technocracy',
  term_start TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  term_end TIMESTAMP WITH TIME ZONE,
  budget NUMERIC(16,2) DEFAULT 1000000.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS political_parties (
  id SERIAL PRIMARY KEY,
  country_id INTEGER NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  abbreviation VARCHAR(10) NOT NULL,
  ideology VARCHAR(100) DEFAULT 'Technological Progress & Civil Unity',
  leader_profile_id INTEGER REFERENCES player_profiles(id) ON DELETE SET NULL,
  members_count INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS elections (
  id SERIAL PRIMARY KEY,
  country_id INTEGER NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  title VARCHAR(150) NOT NULL,
  position VARCHAR(100) DEFAULT 'President of the Republic',
  status VARCHAR(30) DEFAULT 'active', -- 'scheduled', 'active', 'tallied', 'concluded'
  start_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  end_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS votes (
  id SERIAL PRIMARY KEY,
  election_id INTEGER NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  voter_profile_id INTEGER NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  candidate_profile_id INTEGER NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(election_id, voter_profile_id)
);

CREATE TABLE IF NOT EXISTS laws (
  id SERIAL PRIMARY KEY,
  country_id INTEGER NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  title VARCHAR(150) NOT NULL,
  description TEXT,
  category VARCHAR(50) DEFAULT 'Civil Rights', -- 'Economic', 'Civil Rights', 'Education', 'Public Works', 'Technology'
  status VARCHAR(30) DEFAULT 'enacted', -- 'proposed', 'voting', 'enacted', 'repealed'
  passed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. SOCIAL MEDIA & REAL-TIME COMMS
CREATE TABLE IF NOT EXISTS social_posts (
  id SERIAL PRIMARY KEY,
  profile_id INTEGER NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  planet_id INTEGER NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  hashtags TEXT[] DEFAULT '{}',
  is_npc BOOLEAN DEFAULT FALSE,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS post_media (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type VARCHAR(50) DEFAULT 'image/png',
  file_size INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  profile_id INTEGER NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_npc BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reactions (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  profile_id INTEGER NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  reaction_type VARCHAR(30) DEFAULT 'like', -- 'like', 'love', 'insightful', 'quantum'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(post_id, profile_id)
);

CREATE TABLE IF NOT EXISTS friendships (
  id SERIAL PRIMARY KEY,
  profile_id_1 INTEGER NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  profile_id_2 INTEGER NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  status VARCHAR(30) DEFAULT 'accepted', -- 'pending', 'accepted', 'blocked'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(profile_id_1, profile_id_2)
);

CREATE TABLE IF NOT EXISTS follows (
  id SERIAL PRIMARY KEY,
  follower_profile_id INTEGER NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  following_profile_id INTEGER NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(follower_profile_id, following_profile_id)
);

CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  type VARCHAR(30) DEFAULT 'direct', -- 'direct', 'channel', 'group'
  title VARCHAR(150),
  planet_id INTEGER REFERENCES planets(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conversation_members (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  profile_id INTEGER NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  role VARCHAR(30) DEFAULT 'member',
  last_read_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(conversation_id, profile_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_profile_id INTEGER REFERENCES player_profiles(id) ON DELETE SET NULL,
  sender_name VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  message_type VARCHAR(30) DEFAULT 'text',
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lounges (
  id SERIAL PRIMARY KEY,
  planet_id INTEGER NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  city_id INTEGER REFERENCES cities(id) ON DELETE SET NULL,
  name VARCHAR(150) NOT NULL,
  category VARCHAR(50) DEFAULT 'Cyber Lounge', -- 'Cyber Lounge', 'Science Hub', 'Traders Guild', 'Speakeasy'
  description TEXT,
  is_private BOOLEAN DEFAULT FALSE,
  pass_code VARCHAR(50),
  capacity INTEGER DEFAULT 50,
  current_occupants INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lounge_members (
  id SERIAL PRIMARY KEY,
  lounge_id INTEGER NOT NULL REFERENCES lounges(id) ON DELETE CASCADE,
  profile_id INTEGER NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(lounge_id, profile_id)
);

CREATE TABLE IF NOT EXISTS community_members (
  id SERIAL PRIMARY KEY,
  community_id INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  profile_id INTEGER NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  role VARCHAR(30) DEFAULT 'resident',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(community_id, profile_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  profile_id INTEGER NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  title VARCHAR(150) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'info', -- 'social', 'economic', 'government', 'achievement', 'info'
  action_url VARCHAR(255) DEFAULT '/dashboard.html',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. MISSIONS & ACHIEVEMENTS
CREATE TABLE IF NOT EXISTS achievements (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  title VARCHAR(150) NOT NULL,
  description TEXT,
  category VARCHAR(50) DEFAULT 'General',
  icon VARCHAR(50) DEFAULT 'bi-trophy-fill',
  points INTEGER DEFAULT 50,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS player_achievements (
  id SERIAL PRIMARY KEY,
  profile_id INTEGER NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  achievement_id INTEGER NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(profile_id, achievement_id)
);

CREATE TABLE IF NOT EXISTS missions (
  id SERIAL PRIMARY KEY,
  category VARCHAR(50) NOT NULL, -- 'Education', 'Employment', 'Social', 'Family', 'Business', 'Exploration', 'Government'
  title VARCHAR(150) NOT NULL,
  description TEXT NOT NULL,
  requirements JSONB DEFAULT '{}',
  xp_reward INTEGER DEFAULT 100,
  currency_reward NUMERIC(12,2) DEFAULT 50.00,
  rep_reward INTEGER DEFAULT 10,
  achievement_id INTEGER REFERENCES achievements(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS player_missions (
  id SERIAL PRIMARY KEY,
  profile_id INTEGER NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  mission_id INTEGER NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  progress INTEGER DEFAULT 0,
  target INTEGER DEFAULT 1,
  status VARCHAR(30) DEFAULT 'active', -- 'active', 'completed', 'claimed'
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(profile_id, mission_id)
);

-- 12. AI NPCS & MEMORY ARCHITECTURE
CREATE TABLE IF NOT EXISTS npc_characters (
  id SERIAL PRIMARY KEY,
  planet_id INTEGER NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  country_id INTEGER REFERENCES countries(id) ON DELETE SET NULL,
  city_id INTEGER REFERENCES cities(id) ON DELETE SET NULL,
  name VARCHAR(100) NOT NULL,
  age INTEGER DEFAULT 35,
  gender VARCHAR(30) DEFAULT 'Female',
  occupation VARCHAR(100) NOT NULL,
  personality TEXT NOT NULL,
  background TEXT NOT NULL,
  goals TEXT NOT NULL,
  schedule_json JSONB DEFAULT '{}',
  avatar_url TEXT DEFAULT '/img/avatars/npc_default.png',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS npc_memories (
  id SERIAL PRIMARY KEY,
  npc_id INTEGER NOT NULL REFERENCES npc_characters(id) ON DELETE CASCADE,
  profile_id INTEGER REFERENCES player_profiles(id) ON DELETE SET NULL,
  memory_type VARCHAR(50) DEFAULT 'interaction', -- 'conversation', 'transaction', 'event'
  context TEXT NOT NULL,
  emotional_impact INTEGER DEFAULT 5, -- 1 to 10
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS npc_relationships (
  id SERIAL PRIMARY KEY,
  npc_id INTEGER NOT NULL REFERENCES npc_characters(id) ON DELETE CASCADE,
  profile_id INTEGER NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  relationship_type VARCHAR(50) DEFAULT 'Acquaintance',
  affinity INTEGER DEFAULT 50, -- 0 to 100
  trust INTEGER DEFAULT 50,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(npc_id, profile_id)
);

-- 13. WORLD SIMULATION, DISCOVERY & HISTORY
CREATE TABLE IF NOT EXISTS world_events (
  id SERIAL PRIMARY KEY,
  planet_id INTEGER NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  title VARCHAR(150) NOT NULL,
  description TEXT NOT NULL,
  event_type VARCHAR(50) DEFAULT 'economic', -- 'economic', 'diplomatic', 'scientific', 'cultural', 'discovery'
  severity VARCHAR(30) DEFAULT 'normal', -- 'minor', 'normal', 'historic'
  impacts_json JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS historical_records (
  id SERIAL PRIMARY KEY,
  planet_id INTEGER NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  world_year INTEGER NOT NULL,
  world_day INTEGER NOT NULL,
  category VARCHAR(50) NOT NULL, -- 'government', 'economy', 'discovery', 'culture', 'milestone'
  headline VARCHAR(200) NOT NULL,
  article TEXT NOT NULL,
  participants_json JSONB DEFAULT '[]',
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS discoveries (
  id SERIAL PRIMARY KEY,
  planet_id INTEGER NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  discovery_type VARCHAR(50) NOT NULL, -- 'interplanetary', 'technology', 'resource', 'ancient_ruins'
  title VARCHAR(150) NOT NULL,
  description TEXT NOT NULL,
  discovered_by_profile_id INTEGER REFERENCES player_profiles(id) ON DELETE SET NULL,
  discovered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 14. MODERATION, SECURITY & AUDIT
CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  reporter_profile_id INTEGER NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  reported_profile_id INTEGER NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  target_type VARCHAR(50) DEFAULT 'profile', -- 'profile', 'post', 'comment', 'chat_message'
  target_id INTEGER,
  reason VARCHAR(100) NOT NULL,
  details TEXT,
  status VARCHAR(30) DEFAULT 'pending', -- 'pending', 'reviewed', 'resolved', 'dismissed'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS moderation_actions (
  id SERIAL PRIMARY KEY,
  admin_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL, -- 'warning', 'mute', 'suspension', 'ban'
  reason TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  profile_id INTEGER REFERENCES player_profiles(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(50),
  ip_address VARCHAR(45),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- INDEXES FOR MAXIMUM QUERY PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON player_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON player_profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_planet_id ON player_profiles(planet_id);
CREATE INDEX IF NOT EXISTS idx_wallets_profile_planet ON wallets(profile_id, planet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_wallets ON transactions(from_wallet_id, to_wallet_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_planet ON social_posts(planet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_notifications_profile ON notifications(profile_id, is_read);
CREATE INDEX IF NOT EXISTS idx_npc_memories_npc ON npc_memories(npc_id, profile_id);
CREATE INDEX IF NOT EXISTS idx_historical_records_planet ON historical_records(planet_id, recorded_at DESC);

