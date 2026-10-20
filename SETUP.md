# Macro Diary — setup (about 20 minutes, all free)

## 1. Supabase (database + login)
1. Go to supabase.com → **New project** (free plan). Pick the EU (Frankfurt) region.
2. **SQL Editor → New query** → paste all of `schema.sql` → **Run**.
3. **Authentication → Sign In / Providers → Email**: turn **off** "Confirm email"
   (otherwise you have to click a link in an email before your first sign-in).
4. **Project Settings → API**: copy the **Project URL** and the **anon / publishable key**.
5. Open `config.js` and paste both values in.

## 2. Hosting (GitHub Pages)
1. Create a new GitHub repo, e.g. `macro-diary` (public is fine — the key in
   `config.js` is designed to be public; row-level security keeps your data private).
2. Upload every file from this folder (including the two icon PNGs).
3. Repo **Settings → Pages → Source: Deploy from a branch → main / root** → Save.
4. After a minute your app is at `https://<your-username>.github.io/macro-diary/`.

(Want a private repo instead? Netlify or Vercel host private repos for free —
or drag the folder onto app.netlify.com/drop.)

## 3. On your phone
1. Open the URL → **Create account** with your email and a password → sign in.
2. Add to home screen (iPhone: Share → Add to Home Screen; Android: ⋮ → Install app).
3. On first sign-in the app loads your meal plan and 16 starting products.

## 4. Lock it down (after your account exists)
**Authentication → Sign In / Providers → Email**: turn off **"Allow new users to sign up"**,
so nobody else can make an account on your app.

## 5. First week
- **Products tab**: each starting product has a yellow **generic** tag. When you have
  the real thing in hand (your Rimi chicken, your bread, your cottage cheese), open it →
  **Scan** → check the values → **Save**. Your plan updates automatically.
- **Daily use**: each meal shows your plan. Tick/untick avocado or spinach, then
  **Eaten as planned**. Ate tortillas instead of potatoes? Tap the potato line →
  **Replace** → scan the tortillas → enter grams.
- **Settings**: targets are the Green Lift numbers (2163 kcal / 181 P / 190 C / 81 F / 26 fiber).
  Add your **maintenance kcal** if you know it to see an actual deficit number.

## Good to know
- Supabase pauses free projects after ~1 week of no use. If the app ever won't load
  after a break, open the Supabase dashboard and click **Restore**.
- To update the app later, replace the files in the GitHub repo; the phone picks up
  the new version on the next open.
