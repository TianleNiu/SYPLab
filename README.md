# SYPLab — GitHub Pages

Static adaptation of the original Django SYPLab design for a personal research showcase.

## Before publishing

1. Copy **SYPLab-logo-white(1).png** from the original Django project `static/images/` to this site's `static/images/`. The ZIP cannot contain the logo because it was not provided in the chat.
2. Replace the placeholder descriptions in `index.html` with your real research, publications, and approved public experiments.
3. Put public downloadable documents in a new `resources/` folder and add relative links such as `<a href="./resources/experiment-guide.pdf" download>Download guide</a>` (download behavior may vary across browsers).
4. Upload the site's root files to the **public** GitHub repo `TianleNiu/SYPLab` (not the existing private Django repo).
5. Repo **Settings → Pages → Deploy from a branch → main / (root)**. Site URL: `https://tianleniu.github.io/SYPLab/`.
6. Once direct access is tested, configure the custom domain `syplab.cn` in Pages settings and update the DNS appropriately. **Do not point the new website DNS to the old Hong Kong server.**

Do not upload `.production.env`, `db.sqlite3`, `production.py`, secrets, private research data, or files not approved for public release. GitHub Pages is static only.
