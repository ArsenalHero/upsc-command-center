# Publish your UPSC website on GitHub Pages

This package contains the complete, already-built website. No Node.js installation or local build is needed. It has not yet been published to your GitHub account.

## Publish through GitHub's website

1. Sign in to GitHub and open https://github.com/new.
2. Name the repository `upsc-command-center`, choose **Public** for free GitHub Pages hosting, select **Add a README file**, and create the repository.
3. Extract `upsc-github-pages.zip` on your computer.
4. In your repository, choose **Add file → Upload files**. Drag in the contents of the extracted folder, including the `assets` folder. Upload the files, not the ZIP and not the enclosing folder. Include `.nojekyll` if your file manager shows it. Choose **Commit changes** to save to `main`.
5. Check that `index.html` and the `assets` folder are directly at the repository root.
6. Open **Settings → Pages**. Under **Build and deployment**, select **Deploy from a branch**. Select **main** and **/ (root)**, then click **Save**.
7. When GitHub finishes publishing, the Pages settings show the live website address. For this repository name it is normally `https://YOUR_USERNAME.github.io/upsc-command-center/`. Use the exact address GitHub displays.

This prebuilt package uses **Deploy from a branch**. The separate full-source `upsc-command-center.zip` uses the GitHub Actions workflow described in its README.

## Use the app

Open the published website in a browser. Complete the setup wizard, skip it, or explore the clearly labeled fictional demo data. All study records are stored in that browser. Use **Settings → Export Data · JSON** to make backups and **Import Data** to transfer them to another browser or device.

The build uses relative asset paths and hash routes, so repository subdirectories and page refreshes work without changing the repository name in the code. The app includes its install manifest and offline service worker.

## Later changes

The website runs entirely from these compiled files. To change the app, edit the separate full source project, run `npm ci` and `npm run build`, then replace this repository's website files with the new contents of `dist/`. Keep `.nojekyll`. Changes to the publishing branch trigger another deployment.

## If the site does not appear

- Confirm `index.html` is at the repository root and `assets` was uploaded with all its files.
- Confirm Pages uses **main / (root)** and **Deploy from a branch**.
- Check the repository's **Actions** tab for the Pages build and deployment result.
- Use the published GitHub Pages address, rather than the repository's code address.

Official GitHub instructions: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
