# Tempo download site design

## Goal

Create a public, one-page Tempo download site that always sends a Mac user to
the newest Apple-silicon DMG published from this repository.

## Audience and outcome

The audience is a Mac user evaluating Tempo. The primary outcome is one clear
action: download the latest Tempo DMG. The page also establishes that Tempo is
an offline-first, local-data task manager and time tracker.

## Delivery model

The public page is hosted through Sites at its default public URL. GitHub
Releases remains the authoritative source for signed release artifacts.

The primary button links to this stable redirect:

`https://github.com/PurvarajG/TaskManager/releases/latest/download/Tempo-latest-arm64.dmg`

Every release uploads its Apple-silicon disk image using that exact filename.
GitHub resolves `releases/latest` to the newest release, so the page does not
need a redeploy for each new app version.

## Page

- A compact hero that introduces Tempo as a native Mac task manager and time
  tracker.
- A primary “Download for Apple Silicon” button using the stable release URL.
- A short trust line: local PGlite data, no account, and no web service needed.
- A concise requirements/support section: Apple Silicon Mac, macOS download,
  and a link to the source repository.
- A visual system drawn from Tempo’s existing blue mark, warm neutral surface,
  and editorial typography. No decorative generated imagery is required.

The page is static. It makes no GitHub API calls, has no authentication, and
stores no user data.

## Release automation

A GitHub Actions release workflow runs on a version tag. It builds the macOS
Apple-silicon DMG, verifies the build command succeeds, and uploads
`Tempo-latest-arm64.dmg` to that tag’s GitHub Release. Replacing the stable
filename across distinct releases is safe because each release owns its own
asset; the stable `latest/download` redirect selects the newest release.

## Failure handling

- If a release is unavailable, GitHub presents its normal release-not-found
  page rather than the site claiming a download succeeded.
- The page labels the download as Apple Silicon only, so it does not imply Intel
  Mac support.
- The source repository link provides release history and installation context.

## Validation

- The static site builds successfully and its primary download URL is present.
- A release workflow definition uploads the stable DMG filename.
- The public Sites deployment loads the landing page and its button resolves to
  the GitHub latest-release path.
