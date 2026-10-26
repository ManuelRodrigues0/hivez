# API audit image samples

These images are local test fixtures for the Hivez API audit. They were not posted to Hivez or uploaded to Cloudinary. Both were visually reviewed and downloaded from Wikimedia Commons; both source pages list CC0.

| Local file | Test subject | Attribution and source |
|---|---|---|
| `images/pothole-local-road.jpg` | Pothole / damaged road | Computerfan0, [Pothole on local Road in County Monaghan.jpg](https://commons.wikimedia.org/wiki/File:Pothole_on_local_Road_in_County_Monaghan.jpg), CC0 |
| `images/overflowing-bin.jpg` | Overflowing waste bins | Mateusz Konieczny, [Overflowing paper bin.jpg](https://commons.wikimedia.org/wiki/File:Overflowing_paper_bin.jpg), CC0 |

The pothole image was sent to the deployed `/api/verify-report` and `/api/gemini-verify` endpoints with a synthetic `broken_road` category. The overflowing-bin image was sent to `/api/gemini-verify` with a synthetic `garbage` category. Synthetic data was used throughout; no real user content was submitted.

The report file [`../../API_AND_OMNIROUTE_AUDIT_REPORT.md`](../../API_AND_OMNIROUTE_AUDIT_REPORT.md) contains provider results, OmniRoute findings, and the limits of the local model smoke test.
