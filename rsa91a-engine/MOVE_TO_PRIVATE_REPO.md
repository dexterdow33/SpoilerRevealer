# Moving RSA91A-Engine to a private repository

The GitHub connection Claude uses cannot create repositories. Two steps are yours; the rest is prepared.

## 1. Create the empty private repo (you)

GitHub > New repository:
- Owner: dexterdow33
- Name: `rsa91a-engine`
- Visibility: **Private**
- Do not add a README, .gitignore or license (the history already has them).

## 2. Push the prepared history (you, or Claude once the repo exists)

The branch `rsa91a-engine-only` in this checkout holds only the `rsa91a-engine/` folder's history, rewritten to the repo root. The same history is also saved as `dist/rsa91a-engine_history_v1_2026-09-30.bundle` in case the checkout is gone.

From this checkout:

```
git push https://github.com/dexterdow33/rsa91a-engine.git rsa91a-engine-only:main
```

From the bundle, on any machine:

```
git clone rsa91a-engine_history_v1_2026-09-30.bundle rsa91a-engine
cd rsa91a-engine
git checkout -b main rsa91a-engine-only
git remote set-url origin https://github.com/dexterdow33/rsa91a-engine.git
git push -u origin main
```

Or tell Claude "the repo exists" and it will run the push and open the first pull request there.

## 3. Remove the code from the public repo

Granite-State-Report (formerly SpoilerRevealer) is public, and the merged pull request #4 put the full source on `master`. After the private repo is up:

```
git rm -r rsa91a-engine
git commit -m "Move RSA91A-Engine to private repository"
git push
```

That removes it from the tip of `master` only. The two commits with the source stay in the public history and in the closed pull request, and GitHub keeps them reachable. If that matters, the only fixes are to make Granite-State-Report private or to delete it and recreate it without those commits. Anyone who cloned in the meantime has a copy either way.
