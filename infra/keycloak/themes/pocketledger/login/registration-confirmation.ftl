<#import "pocketledger.ftl" as layout>
<@layout.page title="Account created">
    <div class="success-content" role="status" tabindex="-1" data-confirmation>
        <span class="success-mark" aria-hidden="true">✓</span>
        <span class="eyebrow">A FRESH START</span>
        <h1 id="form-heading">You’re all set.</h1>
        <p>Your account has been created for <strong>${confirmationEmail}</strong>.</p>
        <form class="ledger-form" action="${url.loginAction}" method="post">
            <input type="hidden" name="continue" value="true">
            <button class="button button--primary primary-action" type="submit" data-pending-label="Opening your spending…">View today’s spending <span aria-hidden="true">→</span></button>
        </form>
    </div>
</@layout.page>
