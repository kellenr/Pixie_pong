import type { LayoutServerLoad } from './$types';
import { db } from '$lib/server/db';
import { friendships, users } from '$lib/server/db/schema';
import { getFriendProfiles } from '$lib/server/db/helpers_queries';
import { eq, and, or } from 'drizzle-orm';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) {
		return { user: null, friends: [], notificationPrefs: null };
	}

	const userId = Number(locals.user.id);

	let friends: Array<{
		id: number;
		username: string;
		avatar_url: string | null;
		is_online: boolean | null;
	}> = [];

	try {
		friends = await getFriendProfiles(userId);
	} catch (error) {
		// friendships table might not exist yet
	}

	// Fetch notification preferences
	let notificationPrefs = {
		friendRequests: true,
		gameInvites: true,
		matchResults: true,
	};

	try {
		const [userRow] = await db
			.select({ notification_prefs: users.notification_prefs })
			.from(users)
			.where(eq(users.id, userId));

		if (userRow?.notification_prefs) {
			notificationPrefs = {
				...notificationPrefs,
				...(userRow.notification_prefs as Record<string, boolean>),
			};
		}
	} catch {
		// Use defaults if query fails
	}
	
	return {
		user: locals.user,
		friends,
		notificationPrefs,
	};
};