import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { tournaments, tournamentParticipants, users, tournamentInvites } from '$lib/server/db/schema';
import { eq, sql, desc, or, inArray } from 'drizzle-orm';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(302, '/login');

	const userId = Number(locals.user.id);

	// Collect IDs of private tournaments this user is invited to
	const invitedRows = await db
		.select({ id: tournamentInvites.tournament_id })
		.from(tournamentInvites)
		.where(eq(tournamentInvites.invited_user_id, userId));

	// Collect IDs of tournaments this user is already participating in
	const participantRows = await db
		.select({ id: tournamentParticipants.tournament_id })
		.from(tournamentParticipants)
		.where(eq(tournamentParticipants.user_id, userId));

	// Merge into one set of allowed private tournament IDs
	const allowedPrivateIds = [
		...invitedRows.map(r => r.id),
		...participantRows.map(r => r.id),
	];

	const rows = await db
		.select({
			id: tournaments.id,
			name: tournaments.name,
			status: tournaments.status,
			maxPlayers: tournaments.max_players,
			speedPreset: tournaments.speed_preset,
			winScore: tournaments.win_score,
			createdBy: tournaments.created_by,
			creatorUsername: users.username,
			winnerId: tournaments.winner_id,
			isPrivate: tournaments.is_private,
			startedAt: tournaments.started_at,
			finishedAt: tournaments.finished_at,
			createdAt: tournaments.created_at,
			participantCount: sql<number>`(
				SELECT count(*) FROM tournament_participants
				WHERE tournament_id = ${tournaments.id}
			)::int`,
			winnerUsername: sql<string | null>`(
				SELECT username FROM users
				WHERE id = ${tournaments.winner_id}
			)`,
			winnerAvatarUrl: sql<string | null>`(
				SELECT avatar_url FROM users
				WHERE id = ${tournaments.winner_id}
			)`,
			myPlacement: sql<number | null>`(
				SELECT placement FROM tournament_participants
				WHERE tournament_id = ${tournaments.id} AND user_id = ${userId}
			)`,
			myXpEarned: sql<number | null>`(
				SELECT xp_earned FROM tournament_participants
				WHERE tournament_id = ${tournaments.id} AND user_id = ${userId}
			)`,
		})
		.from(tournaments)
		.innerJoin(users, eq(users.id, tournaments.created_by))
		.where(
			or(
				// Public tournaments — everyone sees them
				eq(tournaments.is_private, false),
				// User's own tournaments (they created it)
				eq(tournaments.created_by, userId),
				// Invited to or participating in the private tournament
				allowedPrivateIds.length > 0
					? inArray(tournaments.id, allowedPrivateIds)
					: undefined,
			),
		)
		.orderBy(desc(tournaments.created_at))
		.limit(50);

	// Find if user is currently in an active tournament
	const myActiveTournament = await db
		.select({
			id: tournaments.id,
			name: tournaments.name,
			status: tournaments.status,
		})
		.from(tournamentParticipants)
		.innerJoin(tournaments, eq(tournaments.id, tournamentParticipants.tournament_id))
		.where(eq(tournamentParticipants.user_id, userId))
		.then(rows => rows.find(r => r.status === 'in_progress') ?? null);

	return {
		tournaments: rows,
		userId,
		myActiveTournament,
	};
};