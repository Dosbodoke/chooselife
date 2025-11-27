## Deploy on Vercel

This project is part of a monorepo. To deploy the Next.js application (`chooselife-web`) on Vercel, follow these steps:

1.  **Import Project:** Import the repository into Vercel.
2.  **Framework Preset:** Select **Next.js**.
3.  **Build Command:** Override the build command: `npx turbo run build --filter=chooselife-web`
4.  **Output Directory:** Override the output directory to: `next/.next`
5.  **Environment Variables:** Add any necessary environment variables (e.g., Supabase keys) in the Vercel dashboard.
