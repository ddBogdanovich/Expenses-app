<#import "pocketledger.ftl" as layout>
<@layout.page title="Log out">
    <span class="eyebrow">YOUR ACCOUNT</span>
    <h1 id="form-heading">Log out</h1>
    <p class="form-intro">Finish signing out of PocketLedger.</p>
    <form class="ledger-form" action="${url.logoutConfirmAction}" method="post">
        <input type="hidden" name="session_code" value="${logoutConfirm.code}">
        <button class="button button--primary primary-action" name="confirmLogout" type="submit" data-pending-label="Logging out…">Log out</button>
    </form>
</@layout.page>
