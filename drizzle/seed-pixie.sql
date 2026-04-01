-- Insert Pixie system bot user (idempotent)
INSERT INTO users (username, name, email, password_hash, avatar_url, is_online, is_system)
VALUES (
  'pixie',
  'Pixie',
  'pixie@system.local',
  '$argon2id$v=19$m=65536,t=3,p=4$SYSTEM_BOT_NO_LOGIN$0000000000000000000000000000000000000000000',
  '/avatars/pixie.svg',
  true,
  true
)
ON CONFLICT (username) DO UPDATE SET
  is_system = true,
  is_online = true,
  avatar_url = '/avatars/pixie.svg';

-- Auto-befriend Pixie with all existing users who don't already have a friendship
INSERT INTO friendships (user_id, friend_id, status)
SELECT p.id, u.id, 'accepted'
FROM users p, users u
WHERE p.username = 'pixie'
  AND u.username != 'pixie'
  AND u.is_deleted = false
  AND u.is_system = false
  AND NOT EXISTS (
    SELECT 1 FROM friendships f
    WHERE (f.user_id = p.id AND f.friend_id = u.id)
       OR (f.user_id = u.id AND f.friend_id = p.id)
  );
