<#macro page title>
<!doctype html>
<html lang="en" class="light" data-theme="light">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="color-scheme" content="light">
    <title>${title} · PocketLedger</title>
    <link rel="icon" href="${url.resourcesPath}/pocketledger-mark.svg" type="image/svg+xml">
    <link rel="stylesheet" href="${url.resourcesPath}/css/pocketledger.css">
    <script src="${url.resourcesPath}/preview.js" defer></script>
</head>
<body>
<div class="page-shell">
    <a class="skip-link" href="#main-content">Skip to content</a>
    <header class="page-header"><div class="brand"><img class="brand-mark" src="${url.resourcesPath}/pocketledger-mark.svg" alt="" width="36" height="36">PocketLedger</div></header>
    <main id="main-content" tabindex="-1" class="account-layout">
        <section class="intro" aria-labelledby="intro-heading">
            <span class="eyebrow">A LITTLE CLARITY, EVERY DAY</span>
            <div id="intro-heading" class="intro-title">More life.<br>Less money<br> <span>on your mind.</span></div>
            <p>A calmer place for your everyday spending.<br class="desktop-break"> Start with a little clarity. Build from there.</p>
            <div class="intro-rule"></div>
            <p class="intro-note"><span aria-hidden="true">↗</span> Small steps. A clearer picture.</p>
        </section>
        <section class="account-card" aria-labelledby="form-heading"><#nested></section>
    </main>
    <footer class="page-footer"><span>Your everyday budget, one day at a time.</span><span>Made for a little more peace of mind.</span></footer>
</div>
</body>
</html>
</#macro>
