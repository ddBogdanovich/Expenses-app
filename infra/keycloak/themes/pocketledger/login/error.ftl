<#import "pocketledger.ftl" as layout>
<@layout.page title="Try again">
    <span class="eyebrow">YOUR ACCOUNT</span>
    <h1 id="form-heading" tabindex="-1" data-form-error>Let’s try that again.</h1>
    <p class="form-intro">We couldn’t complete this step. Return to login and try again.</p>
    <#if (client.baseUrl)?has_content>
        <a class="button button--primary primary-action" href="${client.baseUrl}">Back to login <span aria-hidden="true">→</span></a>
    <#else>
        <p class="form-intro">Open PocketLedger to start a new login.</p>
    </#if>
</@layout.page>
