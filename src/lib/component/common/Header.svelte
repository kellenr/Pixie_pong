<script lang="ts">
	import logo from '$lib/assets/favicon.ico';
	import Logout from './Logout.svelte';
	import UserAvatar from './UserAvatar.svelte';
	import { isConnected } from '$lib/stores/socket.svelte';
	import { toggleChat, getTotalUnread } from '$lib/stores/chat.svelte';
	//chat
	//notifications

	type Props = {
		user: {
			id: string;
			username: string;
			email: string;
			name: string;
			avatar_url: string | null;
			is_online: boolean;
		} | null;
	};

	let { user }: Props = $props();
	let dropdownOpen = $state(false);
	let mobileMenuOpen = $state(false);

	function toggleDropdown() {
		dropdownOpen = !dropdownOpen;
	}

	function closeDropdown() {
		dropdownOpen = false;
	}

	function toggleMobileMenu() {
		mobileMenuOpen = !mobileMenuOpen;
	}

	function closeMobileMenu() {
		mobileMenuOpen = false;
	}

	function handleClickOutside(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target.closest('.dropdown-wrapper')) {
			closeDropdown();
		}
		if (!target.closest('.hamburger') && !target.closest('.mobile-menu')) {
			closeMobileMenu();
		}
	}
</script>

<svelte:window onclick={handleClickOutside} />

<header>
	<div class="border-b">
		<nav class="header-nav">
			<a href="/" class="brand" onclick={closeDropdown}>
				<img src={logo} alt="PONG logo" class="brand-logo" />
				<span class="brand-name">PONG</span>
			</a>

			<div class="nav-links">
				{#if user}
					<a href="/play" class="nav-link">Play</a>
					<a href="/leaderboard" class="nav-link">Leaderboard</a>
					<a href="/tournaments" class="nav-link">Tournaments</a>
					<a href="/friends" class="nav-link">Friends</a>
				{:else}
					<a href="/instructions" class="nav-link">Instructions</a>
					<a href="/about" class="nav-link">About</a>
				{/if}
			</div>

			<div class="header-right">
				{#if user}
					<!-- Chat button -->
					<button class="chat-trigger" onclick={toggleChat} aria-label="Open chat" >
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
							<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
						</svg>
						{#if getTotalUnread() > 0}
							<span class="chat-badge">{getTotalUnread()}</span>
						{/if}
					</button>

					<div class="dropdown-wrapper">
						<button
							class="avatar-trigger"
							onclick={toggleDropdown}
							aria-expanded={dropdownOpen}
							aria-haspopup="true"
						>
							<span class="avatar-name">{user.name || user.username}</span>
							<UserAvatar
								username={user.username}
								displayName={user.name}
								avatarUrl={user.avatar_url}
								size="lg"
								status={isConnected() ? 'online' : 'offline'}
							/>
						</button>
						{#if dropdownOpen}
							<div class="dropdown-menu" role="menu">
								<!-- User info at top of dropdown -->
								<div class="dropdown-user-info">
									<p class="dropdown-username">{user.name || user.username}</p>
									<p class="dropdown-email">{user.email}</p>
								</div>

								<hr class="dropdown-divider" />
								<!-- Menu items — each closes dropdown on click -->
								<a href="/profile" class="dropdown-item" role="menuitem" onclick={closeDropdown}>
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
										<circle cx="12" cy="7" r="4" />
									</svg>
									Profile
								</a>

								<a href="/settings" class="dropdown-item" role="menuitem" onclick={closeDropdown}>
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<circle cx="12" cy="12" r="3" />
										<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
									</svg>
									Settings
								</a>
								<hr class="dropdown-divider" />
								<Logout class="dropdown-item logout-item">
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
										<polyline points="16 17 21 12 16 7" />
										<line x1="21" y1="12" x2="9" y2="12" />
									</svg>
									Logout
								</Logout>
							</div>
						{/if}
					</div>

				{:else}
					<a href="/login" class="btn-login">Login</a>
					<a href="/register" class="btn-signup">Sign Up</a>
				{/if}

				<!-- Hamburger (mobile only) -->
				<button class="hamburger" onclick={toggleMobileMenu} aria-label="Toggle menu" aria-expanded={mobileMenuOpen}>
					{#if mobileMenuOpen}
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
							<line x1="18" y1="6" x2="6" y2="18" />
							<line x1="6" y1="6" x2="18" y2="18" />
						</svg>
					{:else}
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
							<line x1="3" y1="6" x2="21" y2="6" />
							<line x1="3" y1="12" x2="21" y2="12" />
							<line x1="3" y1="18" x2="21" y2="18" />
						</svg>
					{/if}
				</button>
			</div>
		</nav>
	</div>

	<!-- Mobile menu -->
	{#if mobileMenuOpen}
		<div class="mobile-menu">
			{#if user}
				<a href="/play" class="mobile-link" onclick={closeMobileMenu}>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3" /></svg>
					Play
				</a>
				<a href="/leaderboard" class="mobile-link" onclick={closeMobileMenu}>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20V10M18 20V4M6 20v-4" stroke-linecap="round" /></svg>
					Leaderboard
				</a>
				<a href="/tournaments" class="mobile-link" onclick={closeMobileMenu}>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 22V2h4v20" stroke-linecap="round" stroke-linejoin="round" /></svg>
					Tournaments
				</a>
				<a href="/friends" class="mobile-link" onclick={closeMobileMenu}>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
					Friends
				</a>
				<a href="/instructions" class="mobile-link" onclick={closeMobileMenu}>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" /></svg>
					Instructions
				</a>
			{:else}
				<a href="/instructions" class="mobile-link" onclick={closeMobileMenu}>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" /></svg>
					Instructions
				</a>
				<a href="/about" class="mobile-link" onclick={closeMobileMenu}>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
					About
				</a>
			{/if}
		</div>
	{/if}
</header>

<style>
	.chat-trigger {
		position: relative;
		background: none;
		border: none;
		color: #9ca3af;
		cursor: pointer;
		padding: 0.4rem;
		border-radius: 0.4rem;
		transition: color 0.15s;
	}

	.chat-trigger:hover {
		color: #e5e7eb;
	}

	.chat-badge {
		position: absolute;
		top: -4px;
		right: -6px;
		background: #ff6b9d;
		color: white;
		font-size: 0.6rem;
		padding: 0.05rem 0.35rem;
		border-radius: 999px;
		font-weight: 700;
		min-width: 16px;
		text-align: center;
	}
</style>