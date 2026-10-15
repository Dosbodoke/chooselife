# SlackData catalog images

Researched October 15, 2026 against the read-only SlackData checkout at `/Users/juangsandrade/Projects/slackdata`, commit `dd8a2bb8a6e856ca659d13744da93b0846d94f1e`, and one live image HEAD request.

Choose Life can locate the image files today, but the repository does not grant permission to reuse them. Keep the current image-free catalog picker until there is permission for the intended image use and an agreed hosting arrangement.

## What is available

- The image resolver uses `brandAbbrev + "_" + slugified product name` to look up filenames in `frontend/src/data/gearImages.json`. It constructs `${VITE_IMAGE_BASE_URL}/gear-images/${gearType}/${filename}`; the base defaults to the site root. This is a frontend manifest convention, not an image URL returned by the webbing API. [Resolver, lines 10–41](https://github.com/International-Slackline-Association/SlackData/blob/dd8a2bb8a6e856ca659d13744da93b0846d94f1e/frontend/src/utils/images.ts#L10-L41), [public webbing model, lines 26–117](https://github.com/International-Slackline-Association/SlackData/blob/dd8a2bb8a6e856ca659d13744da93b0846d94f1e/slack_data/models/webbing.py#L26-L117).
- The checked-out manifest has 251 webbing keys and 487 filenames. The corresponding `frontend/public/gear-images/webbings/` directory has 487 files. These local counts establish availability, not permission or complete product coverage. For example, `raed_parsec` maps to `raed_parsec.jpg` and `raed_parsec-2.jpg`. [Manifest example, lines 1593–1596](https://github.com/International-Slackline-Association/SlackData/blob/dd8a2bb8a6e856ca659d13744da93b0846d94f1e/frontend/src/data/gearImages.json#L1593-L1596), [image directory](https://github.com/International-Slackline-Association/SlackData/tree/dd8a2bb8a6e856ca659d13744da93b0846d94f1e/frontend/public/gear-images/webbings).
- An anonymous `HEAD` of [the Parsec image](https://slackdata.org/gear-images/webbings/raed_parsec.jpg) returned `200 OK`, `Content-Type: image/jpeg`, `Content-Length: 51750`, and `Cache-Control: public,max-age=31536000,immutable`. The response dated October 15, 2026 at 12:46:14 GMT included `Server: AmazonS3` and CloudFront headers. That establishes current public HTTP access. It does not establish permission to hotlink, a supported external image service, or future URL availability. No image body was downloaded by this check.

## What permission is missing

The catalog's CC BY-SA license expressly excludes gear and manufacturer images in `frontend/public/`, states that their respective owners retain them, and directs catalog reusers to source their own images. The software's MIT license does not override that exception. [LICENSE-DATA, lines 4–34](https://github.com/International-Slackline-Association/SlackData/blob/dd8a2bb8a6e856ca659d13744da93b0846d94f1e/LICENSE-DATA#L4-L34).

The public manufacturer submission terms ask submitters to authorize SlackData to display their images on slackdata.org. They do not state a grant to Choose Life or other downstream apps. The implementation plan describes this same SlackData display permission. Neither document supplies the missing downstream authorization. [Manufacturer API terms, lines 207–239](https://github.com/International-Slackline-Association/SlackData/blob/dd8a2bb8a6e856ca659d13744da93b0846d94f1e/MANUFACTURER_API.md#L207-L239), [implementation plan, lines 248–254](https://github.com/International-Slackline-Association/SlackData/blob/dd8a2bb8a6e856ca659d13744da93b0846d94f1e/MANUFACTURER_API_PLAN.md#L248-L254).

There are separate decisions to resolve:

| Question | What Choose Life needs |
| --- | --- |
| May Choose Life display, resize, cache, or host an image? | Permission or an applicable license from the image owner covering those uses. Confirm whether any SlackData permission can be passed downstream. |
| May Choose Life load images directly from slackdata.org? | An agreement with the hosting operator about external use, bandwidth, supported URLs, caching, changes, and failures, alongside the image rights. |
| Does an ordinary public image request require infrastructure credentials? | The checked endpoint answered anonymously. Infrastructure administration access is unnecessary for that request. Access to source code does not establish authority to change the operator's deployment or storage. |

These are practical integration requirements based on the explicit terms, not a ruling on copyright exceptions or hotlinking law.

## Recommended next step

Keep catalog cards image-free and retain users' personal photos for their physical webbings. No upstream code or deployment change is required for this choice.

For a later thumbnail feature, obtain approved images and record their owner, permission scope, source, attribution, and removal contact. Prefer Choose Life's own CDN when hosting and thumbnail transformations are authorized. Maintain an optional image mapping keyed by source, gear type, catalog ID, and image version, keeping the text-only card when an image is missing or fails. Avoid deriving permanent identity from product names. SlackData itself describes its IDs as stable but subject to change. [Manufacturer API identity guidance, lines 241–246](https://github.com/International-Slackline-Association/SlackData/blob/dd8a2bb8a6e856ca659d13744da93b0846d94f1e/MANUFACTURER_API.md#L241-L246).

For a supported integration with SlackData's hosted service, propose an optional image descriptor or manifest keyed by gear type and catalog ID, including image URL, version, attribution, and allowed uses. Agree with the image owners and hosting operator on that contract. A source-code PR can implement it in the open repository; the operator still needs to review and deploy it to slackdata.org. Choose Life does not need the operator's cloud credentials. Self-hosting separately approved images on Choose Life's CDN avoids that deployment dependency.

Alternatively, use SlackData-hosted images only after downstream image rights and a documented hosted-image contract are settled. A successful public request alone settles neither.

This research changed only this note. No catalog scrape, image mirror, upstream edit, commit, infrastructure change, deployment, or maintainer contact was performed.
