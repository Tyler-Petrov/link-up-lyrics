<script lang="ts">
	// The QR target's own minimal layout: no header, dark always (plan §9, §14.5).
	let { children } = $props();
</script>

<div class="dark min-h-dvh bg-background text-foreground">
	{@render children()}
</div>
