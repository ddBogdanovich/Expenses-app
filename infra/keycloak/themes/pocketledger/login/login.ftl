<#import "pocketledger.ftl" as layout>
<@layout.page title="Log in">
    <span class="eyebrow">YOUR ACCOUNT</span>
    <h1 id="form-heading">Log in</h1>
    <p class="form-intro">See what you’ve spent today.</p>
    <#if message?has_content>
        <p class="notice notice--danger" role="alert" tabindex="-1" data-form-error>The email or password is incorrect. Try again.</p>
    </#if>
    <form class="ledger-form" action="${url.loginAction}" method="post">
        <div class="textfield" data-required="true">
            <label class="label" for="username">Email address</label>
            <input class="input input--primary ledger-input" id="username" name="username" type="text" inputmode="email" autocomplete="username" autocapitalize="none" spellcheck="false" enterkeyhint="next" value="${(login.username)!''}" placeholder="you@example.com" required>
        </div>
        <div class="textfield" data-required="true">
            <label class="label" for="password">Password</label>
            <div class="password-input">
                <input class="input input--primary ledger-input" id="password" name="password" type="password" autocomplete="current-password" autocapitalize="none" spellcheck="false" enterkeyhint="go" placeholder="Enter your password" required>
                <button class="button button--ghost button--sm password-toggle" type="button" data-password-toggle aria-controls="password" aria-label="Show password" aria-pressed="false">Show</button>
            </div>
        </div>
        <input type="hidden" name="credentialId" value="${(auth.selectedCredential)!''}">
        <button class="button button--primary primary-action" type="submit" data-pending-label="Logging in…">Log in <span aria-hidden="true">↗</span></button>
    </form>
    <#if realm.registrationAllowed><p class="form-footnote">New to PocketLedger? <a class="account-link" href="${url.registrationUrl}">Create an account</a></p></#if>
</@layout.page>
