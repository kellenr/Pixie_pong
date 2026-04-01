/**
 * pixie.ts — Pixie bot: core utilities + interactive command processor
 *
 * Pixie is the friendly (and slightly sassy) system bot that greets new users,
 * answers stat queries, and keeps the app feeling alive.
 */

import { db } from '$lib/server/db';
import { users, friendships, messages, games } from '$lib/server/db/schema';
import { eq, and, or, desc, sql } from 'drizzle-orm';
import { emitToUser } from '$lib/server/socket/emitters';
import { authLogger } from '$lib/server/logger';
import { getFriendProfiles } from '$lib/server/db/helpers_queries';

// ─────────────────────────────────────────────────────────────────────────────
// Cached Pixie user ID
// ─────────────────────────────────────────────────────────────────────────────

let _pixieUserId: number | null = null;

/**
 * Return Pixie's user ID.
 * Looks up the system user with username 'pixie'. Creates if missing (failsafe).
 * Result is cached in memory for the lifetime of the process.
 */
export async function getPixieUserId(): Promise<number> {
	if (_pixieUserId !== null) return _pixieUserId;

	const [existing] = await db
		.select({ id: users.id })
		.from(users)
		.where(eq(users.username, 'pixie'))
		.limit(1);

	if (existing) {
		_pixieUserId = existing.id;
		return _pixieUserId;
	}

	// Failsafe: auto-create Pixie if not seeded
	authLogger.warn('Pixie user not found — creating now (seed script should handle this)');
	const [created] = await db
		.insert(users)
		.values({
			username: 'pixie',
			name: 'Pixie',
			email: 'pixie@system.internal',
			password_hash: 'not-a-real-hash',
			is_system: true,
			is_online: true,
		})
		.returning({ id: users.id });

	_pixieUserId = created.id;
	return _pixieUserId;
}

/**
 * Return true if the given userId belongs to Pixie.
 */
export async function isPixieUser(userId: number): Promise<boolean> {
	const pixieId = await getPixieUserId();
	return userId === pixieId;
}

// ─────────────────────────────────────────────────────────────────────────────
// Friendship
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create an accepted friendship between Pixie and the given user.
 * Silently skips if the friendship already exists.
 */
export async function befriendPixie(userId: number): Promise<void> {
	const pixieId = await getPixieUserId();

	// Check for an existing row (either direction)
	const [existing] = await db
		.select({ id: friendships.id })
		.from(friendships)
		.where(
			or(
				and(eq(friendships.user_id, pixieId), eq(friendships.friend_id, userId)),
				and(eq(friendships.user_id, userId), eq(friendships.friend_id, pixieId))
			)
		)
		.limit(1);

	if (existing) return;

	await db.insert(friendships).values({
		user_id: pixieId,
		friend_id: userId,
		status: 'accepted',
	});
}

// ─────────────────────────────────────────────────────────────────────────────
// Messaging
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Save a Pixie → user message to the database and push it via websocket.
 */
export async function sendPixieMessage(recipientId: number, content: string): Promise<void> {
	const pixieId = await getPixieUserId();

	const [msg] = await db
		.insert(messages)
		.values({
			sender_id: pixieId,
			recipient_id: recipientId,
			type: 'chat',
			content,
		})
		.returning();

	// Fetch Pixie's avatar for the payload
	const [pixieUser] = await db
		.select({ avatar_url: users.avatar_url, username: users.username, name: users.name })
		.from(users)
		.where(eq(users.id, pixieId))
		.limit(1);

	emitToUser(recipientId, 'chat:message', {
		id: msg.id,
		senderId: pixieId,
		senderUsername: pixieUser?.username ?? 'pixie',
		senderAvatar: pixieUser?.avatar_url ?? null,
		recipientId,
		content: msg.content,
		createdAt: msg.created_at instanceof Date ? msg.created_at.toISOString() : String(msg.created_at),
		gameId: null,
	});
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup for new users
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fire-and-forget: befriend the new user and send them a welcome message.
 * Called right after account creation — errors are logged, never thrown.
 */
export function setupPixieForNewUser(userId: number, username: string): void {
	(async () => {
		await befriendPixie(userId);
		await sendPixieMessage(
			userId,
			`Hey ${username}! I'm Pixie 🏓 — your in-game assistant. ` +
			`Type 'help' to see what I can do, or just challenge someone to a match. Let's go!`
		);
	})().catch((err) => {
		authLogger.error({ err, userId }, 'setupPixieForNewUser failed');
	});
}

// ─────────────────────────────────────────────────────────────────────────────
// Interactive command processor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inspect an incoming message from `userId` and, if it matches a Pixie command,
 * reply and return `true`. Returns `false` if no command matched (caller
 * should treat the message as a normal chat message to Pixie).
 */
export async function processPixieCommand(userId: number, content: string): Promise<boolean> {
	const text = content.trim().toLowerCase();

	if (/\b(stats?|score|record)\b/.test(text)) {
		await handleStats(userId);
		return true;
	}

	if (/\b(rank|leaderboard|top)\b/.test(text)) {
		await handleRank(userId);
		return true;
	}

	if (/\b(online|who)\b/.test(text)) {
		await handleOnline(userId);
		return true;
	}

	if (/last\s+(game|match)|history/.test(text)) {
		await handleLastGame(userId);
		return true;
	}

	if (/\b(help|commands|\?)\b/.test(text)) {
		await handleHelp(userId);
		return true;
	}

	if (/\b(hello|hi|hey|sup|yo)\b/.test(text)) {
		await handleGreeting(userId);
		return true;
	}

	if (/\bgg\b|good\s+game/.test(text)) {
		await handleGG(userId);
		return true;
	}

	if (/\b(thanks?|thank\s+you|thx|ty)\b/.test(text)) {
		await handleThanks(userId);
		return true;
	}

	// Fallback
	await sendPixieMessage(userId, "Not sure what you mean. Type 'help' to see what I can do.");
	return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Command handlers
// ─────────────────────────────────────────────────────────────────────────────

async function handleStats(userId: number): Promise<void> {
	const [user] = await db
		.select({
			username: users.username,
			wins: users.wins,
			losses: users.losses,
			games_played: users.games_played,
		})
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);

	if (!user) {
		await sendPixieMessage(userId, "Hmm, I couldn't find your stats. That's weird.");
		return;
	}

	const { wins, losses, games_played } = user;

	if (!games_played || games_played === 0) {
		await sendPixieMessage(userId, '0 games played. The paddles are waiting.');
		return;
	}

	const winRate = Math.round((wins! / games_played) * 100);
	let commentary: string;

	if (winRate > 70) {
		commentary = "You're kind of a problem.";
	} else if (winRate < 30) {
		commentary = "Hey, at least you're consistent.";
	} else {
		commentary = 'Solid. Keep it up.';
	}

	await sendPixieMessage(
		userId,
		`📊 Stats for ${user.username}: ${wins} wins / ${losses} losses / ${games_played} games played (${winRate}% win rate). ${commentary}`
	);
}

async function handleRank(userId: number): Promise<void> {
	// User's rank by wins (among non-system, non-deleted users)
	const rankResult = await db.execute(
		sql`
			SELECT rank
			FROM (
				SELECT id, RANK() OVER (ORDER BY wins DESC) AS rank
				FROM users
				WHERE is_deleted = false AND is_system = false
			) ranked
			WHERE id = ${userId}
		`
	);

	const userRank = (rankResult[0] as { rank: string | number } | undefined)?.rank;

	// Top 3 players
	const top3 = await db
		.select({
			username: users.username,
			wins: users.wins,
		})
		.from(users)
		.where(and(eq(users.is_deleted, false), eq(users.is_system, false)))
		.orderBy(desc(users.wins))
		.limit(3);

	const topList = top3
		.map((p, i) => `${i + 1}. ${p.username} (${p.wins} wins)`)
		.join('\n');

	const rankLine = userRank != null
		? `You're ranked #${userRank}.`
		: "I couldn't find your rank right now.";

	await sendPixieMessage(
		userId,
		`🏆 ${rankLine}\n\nTop players:\n${topList}`
	);
}

async function handleOnline(userId: number): Promise<void> {
	const friends = await getFriendProfiles(userId);

	// Exclude system users and offline friends
	const onlineFriends = friends.filter(
		(f) => f.is_online && !(f as unknown as { is_system?: boolean }).is_system
	);

	if (onlineFriends.length === 0) {
		await sendPixieMessage(userId, "Nobody's online right now. Guess it's just you and me.");
		return;
	}

	const nameList = onlineFriends.map((f) => f.username).join(', ');
	await sendPixieMessage(
		userId,
		`🟢 Friends online right now: ${nameList}`
	);
}

async function handleLastGame(userId: number): Promise<void> {
	const [game] = await db
		.select({
			id: games.id,
			player1_id: games.player1_id,
			player2_id: games.player2_id,
			player1_score: games.player1_score,
			player2_score: games.player2_score,
			winner_id: games.winner_id,
			player2_name: games.player2_name,
			finished_at: games.finished_at,
		})
		.from(games)
		.where(
			and(
				eq(games.status, 'finished'),
				or(
					eq(games.player1_id, userId),
					eq(games.player2_id, userId)
				)
			)
		)
		.orderBy(desc(games.finished_at))
		.limit(1);

	if (!game) {
		await sendPixieMessage(userId, "No finished games on record yet. Go play one!");
		return;
	}

	const won = game.winner_id === userId;
	const outcome = won ? 'You won' : 'You lost';

	// Determine scores from user's perspective
	const isPlayer1 = game.player1_id === userId;
	const myScore = isPlayer1 ? game.player1_score : game.player2_score;
	const theirScore = isPlayer1 ? game.player2_score : game.player1_score;

	// Opponent name: try to look them up, fall back to player2_name
	let opponentName = game.player2_name ?? 'Guest';
	const opponentId = isPlayer1 ? game.player2_id : game.player1_id;
	if (opponentId) {
		const [opp] = await db
			.select({ username: users.username })
			.from(users)
			.where(eq(users.id, opponentId))
			.limit(1);
		if (opp) opponentName = opp.username;
	}

	const when = game.finished_at
		? new Date(game.finished_at).toLocaleDateString()
		: 'recently';

	await sendPixieMessage(
		userId,
		`🎮 Last game (${when}): ${outcome} against ${opponentName} — ${myScore}–${theirScore}.`
	);
}

async function handleHelp(userId: number): Promise<void> {
	await sendPixieMessage(
		userId,
		`Here's what I can help with:\n\n` +
		`• stats / score / record — your win/loss record\n` +
		`• rank / leaderboard / top — player rankings\n` +
		`• online / who — see which friends are online\n` +
		`• last game / history — your most recent match result\n` +
		`• hello / hi / hey — just say hi\n` +
		`• gg / good game — celebrate a good match\n` +
		`• help — show this list`
	);
}

async function handleGreeting(userId: number): Promise<void> {
	const greetings = [
		'Hey! Ready to play? 🏓',
		"What's up! Challenge someone — don't just lurk.",
		'Yo! The tables are open.',
		"Hey there! I'm here if you need anything.",
		'Hi! Type "help" if you want to see what I can do.',
	];
	await sendPixieMessage(userId, pick(greetings));
}

async function handleGG(userId: number): Promise<void> {
	const reactions = [
		'GG! Now go win another one. 🏆',
		'gg ez — just kidding. Good game though!',
		'GG! The rematch is always waiting.',
		"GG! That's the spirit — win or lose, show up.",
		'GG! 🏓 Keep playing, keep improving.',
	];
	await sendPixieMessage(userId, pick(reactions));
}

async function handleThanks(userId: number): Promise<void> {
	const responses = [
		"Any time! That's what I'm here for.",
		"No problem! Now go beat someone. 🏓",
		"Don't mention it. Seriously, I'm a bot — it's my job.",
		"You're welcome! Type 'help' if you need more.",
		'Happy to help! 👾',
	];
	await sendPixieMessage(userId, pick(responses));
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
	return arr[Math.floor(Math.random() * arr.length)];
}
