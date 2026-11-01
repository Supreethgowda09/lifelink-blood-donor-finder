# LifeLink Blood Donor Finder

A responsive local prototype for a community blood network. It includes a dashboard overview, donor and facility directories, compatible donor search, opt-in location sorting and phone sharing, request response/expiry tracking, editable blood-stock estimates, donation logging, and blood camp listings.

## Run locally

```sh
npm install
npm run dev
```

Create a production build with `npm run build`.
Run the code-quality check with `npm run lint`.

## Data and scope

Donors, the local donor profile, blood requests, facility entries, stock counts, donation records, and blood camps are saved in this browser's `localStorage`. The directory includes sample donor records and illustrative starting stock figures. Sample distances are approximate city-center estimates; precise distances are calculated only for profiles that have opted to save browser coordinates. Location permission is optional. Contact buttons appear only for a non-sample donor who has explicitly opted to share a number.

This remains a front-end prototype, not a live donor registry or emergency service. Data and donor responses do not synchronize across users or devices. Donor identity and facility details are not independently verified. Map searches open an external maps service. LifeLink does not notify donors, hospitals, or emergency services. Contact the hospital blood bank directly for urgent needs, and confirm eligibility and compatibility with qualified healthcare professionals. Clearing this browser's site data removes locally saved records.
