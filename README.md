# GeoPrivacy Clue Viewer — static export

A static web viewer for 25 randomly sampled runs. Built for GitHub Pages.

## Contents

```
index.html          # entry point
style.css           # warm washi-paper theme
app.js              # viewer logic (vanilla JS, no build)
index.json          # list of samples
examples/
  <sample_id>/
    original.jpg    # source image (downscaled to ≤1600px wide)
    data.json       # reasoning + clue metadata
    masks/*.png     # per-clue binary masks (matched to original.jpg size)
```

## Run locally

It will NOT work from `file://` (browsers block `fetch()` of local files). Use any HTTP server:

```bash
cd web_export
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deploy to GitHub Pages

1. Push the contents of `web_export/` to the root (or a subfolder) of a repo.
2. Repo **Settings → Pages → Source**: pick the branch and folder.
3. Open the provided URL. Done.

## Interaction

- **Thumbnail strip** at the top — click to switch sample.
- **Clue list** on the right — hover a clue to preview its segmentation, click to pin.
- **Display panel** — opacity slider + "show all clues at once" toggle.
- **Reasoning panel** under the image shows the full VLM reasoning plus meta (predicted region, confidence, ground truth, clue count).
