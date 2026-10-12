# garrett-thomas.github.io

My portfolio: a single static page with my projects, served by GitHub Pages.

Plain HTML and CSS, with no framework and no build step.

## Develop

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

## Check before pushing

```bash
node scripts/check-site.mjs               # links, alt text, card count, privacy scan
node --test scripts/check-site.test.mjs   # tests for the check itself
```

The check fails on local links that git isn't tracking (including wrong-case filenames, which work on macOS but break on Pages), images without alt text, and leaks like IP addresses or home-directory paths in any tracked text file. Extra private terms can go in a git-ignored `.private-terms` file, one per line.
