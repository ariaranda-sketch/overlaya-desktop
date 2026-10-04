# Overlaya Studio (desktop)

Stream overlays for TikTok LIVE: social plug, chat, and shoutouts with automatic triggers.
Users type their TikTok username, customize their overlays, and paste the links into
TikTok LIVE Studio, OBS or Streamlabs. No account keys or extra apps needed.

## For users

1. Download `Overlaya-Studio-Setup-x.y.z.exe` from the **Releases** page and run it.
   Windows may say "Windows protected your PC". Click **More info**, then **Run anyway**.
2. Open **Overlaya Studio**, pick your platforms, and type your handles.
3. In **Connections**, type your TikTok username and press **Connect to LIVE**.
4. Copy each overlay link and add it to:
   - **TikTok LIVE Studio:** Add source, then Link
   - **OBS:** Sources, +, Browser, untick Local file, paste into URL
   - **Streamlabs:** Sources, +, Browser Source, paste into URL
5. Keep Overlaya Studio open (minimized is fine) while you're live.

Links never change. Edits appear on stream by themselves.

## Publishing a new version (for the maintainer)

1. Change `"version"` in `package.json` (for example `0.1.0` to `0.2.0`) and commit.
2. Create a release tag: on GitHub, open **Releases**, then **Draft a new release**,
   type a new tag such as `v0.2.0`, and click **Publish release**.
3. The **Actions** tab builds the Windows installer (about 5 to 10 minutes) and attaches it
   to that release automatically.

To build without a release, open **Actions**, choose **Build Windows installer**,
then **Run workflow**. The installer appears under that run's **Artifacts**.

## Running it on your own PC (optional)

    npm install
    npm start                 # the full app
    npm run test-server       # studio in your browser with a fake LIVE, at http://127.0.0.1:21510/studio

## Notes

- The TikTok connection is unofficial (it uses the open-source TikTok-Live-Connector library),
  so it can stop working when TikTok changes things. Updating the library and publishing a new
  version usually fixes it.
- Settings are stored on each user's PC. Nothing is sent to the maintainer.
