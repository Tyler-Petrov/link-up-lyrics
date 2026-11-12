<script lang="ts">
	// TODO(Tyler): register this address as the DMCA designated agent (U.S. Copyright Office).
	const contact = 'copyright@linkuplyrics.com';
</script>

<svelte:head>
	<title>Terms and copyright · Link Up Lyrics</title>
</svelte:head>

<h1 class="page-title">Terms and copyright</h1>

<article class="legal mx-auto mt-8 flex max-w-2xl flex-col gap-8 rounded-2xl bg-card p-6 sm:p-8">
	<section>
		<h2>Your songs are yours</h2>
		<p>
			You keep ownership of everything you write or type into Link Up Lyrics. You give us only a
			limited, non-exclusive license to store it, show it, and send it to the people in your jam
			sessions so the app can work. That license ends when you delete it. We don’t claim your songs,
			sublicense them, or train anything on them.
		</p>
	</section>

	<section>
		<h2>Songs that belong to someone else</h2>
		<p>
			Typing out a song is making a copy, and singing it in worship doesn’t cover that. When you add
			someone else’s song, you’re telling us you have the rights your use needs, usually through
			your church’s CCLI Church Copyright License. Link Up Lyrics isn’t the licensee: the license
			belongs to your church. A subscription pays for the tool, never for any rights to the songs.
		</p>
		<p>
			There’s no public song catalog. Your library is private, and the people in your jam session
			see only what you put on its setlist.
		</p>
	</section>

	<section>
		<h2>Copyright takedowns</h2>
		<p>
			If you own a song and believe it’s here without permission, email
			<a href="mailto:{contact}">{contact}</a> with:
		</p>
		<ul>
			<li>the work you own, and the link where it appears;</li>
			<li>your name, address, phone number and email;</li>
			<li>
				a statement that you believe in good faith the use isn’t authorized by you, your agent, or
				the law;
			</li>
			<li>
				a statement, under penalty of perjury, that your notice is accurate and you own the work or
				may act for the owner;
			</li>
			<li>your physical or electronic signature.</li>
		</ul>
		<p>
			We remove the material promptly and tell the person who added it, who can send a
			counter-notice if they think we got it wrong. We close the accounts of people who repeatedly
			infringe.
		</p>
	</section>
</article>

<style>
	.legal h2 {
		margin-bottom: 0.5rem;
		font-size: 1.125rem;
		font-weight: 650;
	}
	.legal p,
	.legal li {
		color: var(--muted-foreground);
		line-height: 1.65;
	}
	.legal p + p {
		margin-top: 0.75rem;
	}
	.legal ul {
		margin: 0.75rem 0;
		padding-left: 1.25rem;
		list-style: disc;
	}
	.legal a {
		color: var(--primary);
		text-underline-offset: 4px;
	}
	.legal a:hover {
		text-decoration: underline;
	}
</style>
