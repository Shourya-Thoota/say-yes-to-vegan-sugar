# Share message translations — review status

Production site URL appended to every published message:
`https://say-yes-to-vegan-sugar-production.up.railway.app/`

## Published in the public UI

- **English (`en`) — REVIEWED, published.** The only language rendered by
  `ShareSection` today. Every other language code falls back to English
  explicitly; the UI never silently shows English under another language's name.

## Pending qualified review — NOT in the public UI

The drafts below are **unreviewed candidate wordings**. They are documented
here only so a qualified reviewer can correct them. Do not copy them into
`lib/share.ts`, `components/share-section.tsx`, or any public page until each
language has been reviewed by a fluent reader for tone, accuracy, and cultural
appropriateness.

Review bar for each language before publication:

1. Fluent reader confirms the limited claim is preserved: *some* sugar is
   processed using animal-derived aids, and the *specific product* should be
   checked — no blanket claims about brands, no health promises, no religious
   rulings, no endorsements.
2. Tone is respectful and encouraging; temples and devotees are not shamed.
3. "Temple Initiative" and "Say Yes to Vegan Sugar" remain recognizable.
4. The production site URL is appended unchanged.
5. Text wraps without horizontal overflow at 320px in the existing share card.

When a language passes, set `reviewed: true` for that code in
`lib/share.ts` (`SHARE_LANGUAGES`) and add behavior tests covering the new
published message.

### Candidate draft — Hindi (`hi`) — UNREVIEWED, DO NOT PUBLISH

> Temple Initiative का “Say Yes to Vegan Sugar” अभियान मंदिर समुदायों से आग्रह करता है कि प्रसाद, भोग और सामुदायिक भोजन के लिए चीनी चुनते समय उत्पाद-विशिष्ट लेबल और निर्माता की जानकारी जाँचें। क्या देखना है, यह जानें और यह संदेश साझा करें:

Status: needs fluent Hindi reviewer. Check respectful address, correct
"product-specific" phrasing, and consistent campaign naming.

### Candidate draft — Telugu (`te`) — UNREVIEWED, DO NOT PUBLISH

> దేవాలయ సమాజాలు ప్రసాదం, నైవేద్యం మరియు సామూహిక భోజనాల కోసం చక్కెరను ఎంచుకునేటప్పుడు ఉత్పత్తి-నిర్దిష్ట లేబుల్‌లు మరియు తయారీదారు సమాచారాన్ని పరిశీలించాలని Temple Initiative “Say Yes to Vegan Sugar” ప్రచారం కోరుతోంది. ఏమి చూడాలో తెలుసుకోండి మరియు ఈ సందేశాన్ని పంచుకోండి:

Status: needs fluent Telugu reviewer. Verify respectful tone, accurate
"product-specific labeling" rendering, and campaign name handling.

### Candidate draft — Tamil (`ta`) — UNREVIEWED, DO NOT PUBLISH

> பிரசாதம், படையல் மற்றும் சமூக உணவுகளுக்கான சர்க்கரையைத் தேர்ந்தெடுக்கும்போது தயாரிப்பு சார்ந்த முத்திரைகளையும் உற்பத்தியாளர் தகவலையும் சரிபார்க்குமாறு கோயில் சமூகங்களை Temple Initiative “Say Yes to Vegan Sugar” பிரச்சாரம் அழைக்கிறது. எதைக் கவனிக்க வேண்டும் என்பதை அறிந்து இந்தச் செய்தியைப் பகிருங்கள்:

Status: needs fluent Tamil reviewer. Verify respectful tone and accurate
"product-specific" phrasing.

### Candidate draft — Gujarati (`gu`) — UNREVIEWED, DO NOT PUBLISH

> પ્રસાદ, ધરાવ અને સામૂહિક ભોજન માટે ખાંડ પસંદ કરતી વખતે ઉત્પાદન-વિશિષ્ટ લેબલ અને ઉત્પાદકની માહિતી તપાસવા Temple Initiativeનું “Say Yes to Vegan Sugar” અભિયાન મંદિર સમુદાયોને વિનંતી કરે છે. શું જોવું તે જાણો અને આ સંદેશ શેર કરો:

Status: needs fluent Gujarati reviewer. Verify respectful tone and accurate
"product-specific" phrasing.
