import adapter from '@sveltejs/adapter-vercel';

/** @type {import('@sveltejs/kit').Config} */
const config = {
    kit: {
        adapter: adapter(),
		alias: {
			$components: "./src/components",
			$lib: "./src/lib",
			$convex: "./src/convex",
			$shadcn: "./src/components/ui",
			$routes: "./src/routes",
			$src: "./src",
		},
    },
    compilerOptions: {
        experimental: {
            async: true
        }
    }
};

export default config;
